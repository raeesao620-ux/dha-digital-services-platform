import CryptoJS from "crypto-js";

// Security constants with strict validation
const getEncryptionKey = (): string => {
  const key = import.meta.env.VITE_ENCRYPTION_KEY;
  
  if (!key) {
    const errorMessage = 'CRITICAL SECURITY ERROR: VITE_ENCRYPTION_KEY environment variable is required';
    if (import.meta.env.PROD) {
      throw new Error(errorMessage);
    }
    console.warn(`WARNING: ${errorMessage} - Using development fallback`);
    // Generate a random key for development only
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Validate key strength in production
  if (import.meta.env.PROD && key.length < 32) {
    throw new Error('CRITICAL SECURITY ERROR: VITE_ENCRYPTION_KEY must be at least 32 characters for production use');
  }
  
  return key;
};

const ENCRYPTION_KEY = getEncryptionKey();
const STORAGE_PREFIX = "dha_secure_";

// Client-side encryption utilities
export const security = {
  // Encrypt sensitive data before storing
  encrypt(data: string): string {
    try {
      return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
    } catch (error) {
      console.error("Encryption failed:", error);
      throw new Error("Failed to encrypt data");
    }
  },

  // Decrypt sensitive data after retrieving
  decrypt(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new Error("Invalid encrypted data");
      }
      
      return decrypted;
    } catch (error) {
      console.error("Decryption failed:", error);
      throw new Error("Failed to decrypt data");
    }
  },

  // Secure hash generation
  hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  },

  // Generate secure random string
  generateSecureRandom(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  // Secure session storage
  secureStorage: {
    setItem(key: string, value: string, encrypt: boolean = true): void {
      try {
        const fullKey = STORAGE_PREFIX + key;
        const finalValue = encrypt ? security.encrypt(value) : value;
        
        sessionStorage.setItem(fullKey, finalValue);
      } catch (error) {
        console.error("Failed to store secure data:", error);
      }
    },

    getItem(key: string, decrypt: boolean = true): string | null {
      try {
        const fullKey = STORAGE_PREFIX + key;
        const value = sessionStorage.getItem(fullKey);
        
        if (!value) return null;
        
        return decrypt ? security.decrypt(value) : value;
      } catch (error) {
        console.error("Failed to retrieve secure data:", error);
        return null;
      }
    },

    removeItem(key: string): void {
      const fullKey = STORAGE_PREFIX + key;
      sessionStorage.removeItem(fullKey);
    },

    clear(): void {
      // Only clear items with our prefix
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });
    }
  },

  // Input validation and sanitization
  validation: {
    isValidEmail(email: string): boolean {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },

    isStrongPassword(password: string): boolean {
      // At least 8 characters, one uppercase, one lowercase, one number, one special char
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      return passwordRegex.test(password);
    },

    sanitizeInput(input: string): string {
      return input
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript protocols
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
    },

    validateBiometricTemplate(template: string): boolean {
      // Basic validation for biometric template format
      return template.length >= 100 && template.length <= 10000;
    },

    validateFileType(file: File, allowedTypes: string[]): boolean {
      return allowedTypes.includes(file.type);
    },

    validateFileSize(file: File, maxSizeBytes: number): boolean {
      return file.size <= maxSizeBytes;
    }
  },

  // Security headers and CSRF protection
  headers: {
    getSecurityHeaders(): HeadersInit {
      return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' wss: ws:"
      };
    },

    getCSRFToken(): string | null {
      // Get CSRF token from meta tag or cookie
      const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (metaToken) return metaToken;

      // Fallback to cookie
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrf-token') {
          return decodeURIComponent(value);
        }
      }
      
      return null;
    }
  },

  // Device fingerprinting for fraud detection
  deviceFingerprint: {
    async generate(): Promise<string> {
      const components = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        (navigator as any).deviceMemory || 'unknown'
      ];

      // Add WebGL fingerprint if available
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl && gl instanceof WebGLRenderingContext) {
          const renderer = gl.getParameter(gl.RENDERER);
          const vendor = gl.getParameter(gl.VENDOR);
          components.push(renderer, vendor);
        }
      } catch (e) {
        // WebGL not available
      }

      const fingerprint = components.join('|');
      return security.hash(fingerprint);
    }
  },

  // Rate limiting helpers
  rateLimiting: {
    checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
      const now = Date.now();
      const storageKey = `rate_limit_${key}`;
      
      try {
        const stored = localStorage.getItem(storageKey);
        let attempts = stored ? JSON.parse(stored) : [];
        
        // Remove old attempts outside the window
        attempts = attempts.filter((timestamp: number) => now - timestamp < windowMs);
        
        if (attempts.length >= maxAttempts) {
          return false; // Rate limit exceeded
        }
        
        // Add current attempt
        attempts.push(now);
        localStorage.setItem(storageKey, JSON.stringify(attempts));
        
        return true; // Rate limit OK
      } catch (error) {
        console.error("Rate limiting check failed:", error);
        return true; // Allow on error
      }
    },

    clearRateLimit(key: string): void {
      const storageKey = `rate_limit_${key}`;
      localStorage.removeItem(storageKey);
    }
  },

  // Content Security Policy helpers
  csp: {
    isValidOrigin(origin: string): boolean {
      const allowedOrigins = [
        window.location.origin,
        'https://cdn.tailwindcss.com',
        'https://cdnjs.cloudflare.com',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
      ];
      
      return allowedOrigins.includes(origin);
    },

    sanitizeHTML(html: string): string {
      // Basic HTML sanitization - remove scripts and dangerous attributes
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
    }
  }
};

// Error handling utilities
export const securityErrors = {
  AuthenticationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },

  AuthorizationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthorizationError';
    }
  },

  EncryptionError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'EncryptionError';
    }
  },

  ValidationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },

  RateLimitError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  }
};

export default security;
