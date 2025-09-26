/**
 * SITA (State Information Technology Agency) Integration Service
 * 
 * SITA is South Africa's State Information Technology Agency that provides
 * the technology infrastructure backbone for government services. This service
 * integrates with SITA's API Gateway and eServices portal to enable secure
 * access to government services and data.
 * 
 * Features:
 * - SITA API Gateway connectivity
 * - eServices portal integration (https://www.eservices.gov.za/home/)
 * - SITA authentication and authorization
 * - Service discovery and provisioning
 * - Government PKI certificate management
 * - Secure government data exchange
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

export interface SitaApiCredentials {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  certificatePath?: string;
  privateKeyPath?: string;
  environment: 'development' | 'staging' | 'production';
}

export interface SitaAuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string[];
  issuedAt: number;
}

export interface SitaServiceDiscovery {
  serviceName: string;
  serviceId: string;
  version: string;
  endpoint: string;
  methods: string[];
  authentication: string;
  documentation: string;
  status: 'active' | 'deprecated' | 'maintenance';
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

export interface SitaApiRequest {
  service: string;
  method: string;
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface SitaApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  headers: Record<string, string>;
  requestId: string;
  processingTime: number;
}

/**
 * SITA Integration Service Class
 */
export class SitaIntegrationService {
  private credentials: SitaApiCredentials;
  private authToken: SitaAuthResponse | null = null;
  private serviceCache: Map<string, SitaServiceDiscovery> = new Map();
  private baseUrls: Record<string, string> = {
    development: 'https://api-dev.sita.co.za',
    staging: 'https://api-staging.sita.co.za', 
    production: 'https://api.sita.co.za'
  };

  constructor(credentials: SitaApiCredentials) {
    this.credentials = credentials;
  }

  /**
   * Initialize SITA connection and authenticate
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      // Authenticate with SITA API Gateway
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return { success: false, error: authResult.error };
      }

      // Discover available services
      await this.discoverServices();

      // Log successful initialization
      await storage.createSecurityEvent({
        eventType: "sita_integration_initialized",
        severity: "low",
        details: {
          environment: this.credentials.environment,
          servicesDiscovered: this.serviceCache.size
        }
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SITA initialization failed'
      };
    }
  }

  /**
   * Authenticate with SITA API Gateway
   */
  async authenticate(): Promise<{ success: boolean; token?: SitaAuthResponse; error?: string }> {
    try {
      const authPayload = {
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        grant_type: 'client_credentials',
        scope: 'government_services dha_integration eservices_access'
      };

      // Production authentication with SITA e-Services
      // All environments now use live SITA connectivity

      // Live SITA API Gateway authentication
      const response = await fetch(`${this.baseUrls[this.credentials.environment]}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.credentials.apiKey,
          'User-Agent': 'DHA-Digital-Services/2025.1',
          'Accept': 'application/json'
        },
        body: JSON.stringify(authPayload)
      });
      
      const responseData = await response.json();

      if (response.ok) {
        this.authToken = {
          accessToken: responseData.access_token,
          refreshToken: responseData.refresh_token,
          tokenType: 'Bearer',
          expiresIn: responseData.expires_in,
          scope: responseData.scope?.split(' ') || [],
          issuedAt: Date.now()
        };
        
        // Log successful authentication
        await storage.createSecurityEvent({
          eventType: "sita_authentication_success",
          severity: "low",
          details: {
            environment: this.credentials.environment,
            tokenExpiry: this.authToken.expiresIn
          }
        });

        return { success: true, token: this.authToken };
      }

      return { success: false, error: `SITA authentication failed: ${response.statusText}` };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication error'
      };
    }
  }

  /**
   * Discover available SITA services
   */
  async discoverServices(): Promise<SitaServiceDiscovery[]> {
    try {
      if (!this.authToken) {
        throw new Error('Not authenticated with SITA');
      }

      // Always use real service discovery for production readiness

      const response = await this.makeAuthenticatedRequest({
        service: 'discovery',
        method: 'GET',
        endpoint: '/services/discover'
      });

      if (response.success && response.data) {
        const services: SitaServiceDiscovery[] = response.data.services;
        
        // Cache discovered services
        services.forEach(service => {
          this.serviceCache.set(service.serviceId, service);
        });

        return services;
      }

      return [];

    } catch (error) {
      console.error('Service discovery error:', error);
      return [];
    }
  }

  /**
   * Make authenticated request to SITA service
   */
  async makeAuthenticatedRequest<T = any>(request: SitaApiRequest): Promise<SitaApiResponse<T>> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      if (!this.authToken) {
        throw new Error('Not authenticated with SITA');
      }

      // Check if token needs refresh
      if (this.isTokenExpired()) {
        const refreshResult = await this.refreshToken();
        if (!refreshResult.success) {
          throw new Error('Token refresh failed');
        }
      }

      const headers = {
        'Authorization': `${this.authToken.tokenType} ${this.authToken.accessToken}`,
        'X-API-Key': this.credentials.apiKey,
        'X-Request-ID': requestId,
        'Content-Type': 'application/json',
        ...request.headers
      };

      const url = request.endpoint.startsWith('http') 
        ? request.endpoint 
        : `${this.baseUrls[this.credentials.environment]}${request.endpoint}`;

      const response = await this.makeHttpRequest(
        request.method as any,
        url,
        request.data,
        headers,
        request.timeout
      );

      // Log the API call
      await storage.createSecurityEvent({
        eventType: "sita_api_call",
        severity: "low",
        details: {
          service: request.service,
          method: request.method,
          endpoint: request.endpoint,
          statusCode: response.statusCode,
          requestId,
          processingTime: Date.now() - startTime
        }
      });

      return {
        success: response.statusCode >= 200 && response.statusCode < 300,
        data: response.data,
        error: response.statusCode >= 400 ? response.data?.message || 'API Error' : undefined,
        statusCode: response.statusCode,
        headers: response.headers || {},
        requestId,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      await storage.createSecurityEvent({
        eventType: "sita_api_error",
        severity: "medium",
        details: {
          service: request.service,
          method: request.method,
          endpoint: request.endpoint,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
          processingTime: Date.now() - startTime
        }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'API request failed',
        statusCode: 500,
        headers: {},
        requestId,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get eServices portal integration endpoint
   */
  async getEServicesIntegration(serviceType: string): Promise<{
    success: boolean;
    integrationUrl?: string;
    sessionToken?: string;
    error?: string;
  }> {
    try {
      const response = await this.makeAuthenticatedRequest({
        service: 'eservices',
        method: 'POST',
        endpoint: '/eservices/integration',
        data: {
          serviceType,
          returnUrl: `${process.env.BASE_URL}/callback/eservices`,
          applicationId: process.env.APPLICATION_ID
        }
      });

      if (response.success) {
        return {
          success: true,
          integrationUrl: response.data.integrationUrl,
          sessionToken: response.data.sessionToken
        };
      }

      return { success: false, error: response.error };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'eServices integration failed'
      };
    }
  }

  /**
   * Validate government certificate through SITA PKI
   */
  async validateGovernmentCertificate(certificateData: string): Promise<{
    isValid: boolean;
    issuer?: string;
    subject?: string;
    expiryDate?: Date;
    trustChain?: string[];
    error?: string;
  }> {
    try {
      const response = await this.makeAuthenticatedRequest({
        service: 'pki',
        method: 'POST',
        endpoint: '/pki/validate-certificate',
        data: {
          certificate: certificateData,
          validateTrustChain: true,
          checkRevocation: true
        }
      });

      if (response.success) {
        return {
          isValid: response.data.isValid,
          issuer: response.data.issuer,
          subject: response.data.subject,
          expiryDate: new Date(response.data.expiryDate),
          trustChain: response.data.trustChain
        };
      }

      return { isValid: false, error: response.error };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Certificate validation failed'
      };
    }
  }

  /**
   * Get service information from cache
   */
  getServiceInfo(serviceId: string): SitaServiceDiscovery | undefined {
    return this.serviceCache.get(serviceId);
  }

  /**
   * Check if current token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.authToken) return true;
    
    const expiryTime = this.authToken.issuedAt + (this.authToken.expiresIn * 1000);
    const bufferTime = 300000; // 5 minutes buffer
    
    return Date.now() > (expiryTime - bufferTime);
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.authToken?.refreshToken) {
        return await this.authenticate();
      }

      // Implementation for token refresh using refresh token
      const authResult = await this.authenticate();
      return authResult;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  /**
   * Simulate authentication response for development
   */
  private simulateAuthResponse(): SitaAuthResponse {
    return {
      accessToken: jwt.sign(
        { 
          client_id: this.credentials.clientId,
          scope: ['government_services', 'dha_integration', 'eservices_access'],
          environment: 'development'
        },
        'dev-sita-secret',
        { expiresIn: '1h' }
      ),
      refreshToken: crypto.randomBytes(32).toString('hex'),
      tokenType: 'Bearer',
      expiresIn: 3600,
      scope: ['government_services', 'dha_integration', 'eservices_access'],
      issuedAt: Date.now()
    };
  }

  /**
   * Get simulated services for development
   */
  private getSimulatedServices(): SitaServiceDiscovery[] {
    const services: SitaServiceDiscovery[] = [
      {
        serviceName: 'DHA Document Services',
        serviceId: 'dha-docs',
        version: '2.1.0',
        endpoint: '/api/v2/dha/documents',
        methods: ['GET', 'POST', 'PUT'],
        authentication: 'OAuth2',
        documentation: 'https://api.sita.co.za/docs/dha-documents',
        status: 'active',
        rateLimits: {
          requestsPerMinute: 60,
          requestsPerDay: 5000
        }
      },
      {
        serviceName: 'NPR Population Services',
        serviceId: 'npr-population',
        version: '1.8.0',
        endpoint: '/api/v1/npr/population',
        methods: ['GET', 'POST'],
        authentication: 'OAuth2',
        documentation: 'https://api.sita.co.za/docs/npr-population',
        status: 'active',
        rateLimits: {
          requestsPerMinute: 30,
          requestsPerDay: 2000
        }
      },
      {
        serviceName: 'eServices Portal Integration',
        serviceId: 'eservices-portal',
        version: '3.0.0',
        endpoint: '/api/v3/eservices',
        methods: ['GET', 'POST'],
        authentication: 'OAuth2',
        documentation: 'https://api.sita.co.za/docs/eservices',
        status: 'active',
        rateLimits: {
          requestsPerMinute: 100,
          requestsPerDay: 10000
        }
      },
      {
        serviceName: 'PKI Certificate Services',
        serviceId: 'pki-certs',
        version: '2.0.0',
        endpoint: '/api/v2/pki',
        methods: ['GET', 'POST'],
        authentication: 'OAuth2',
        documentation: 'https://api.sita.co.za/docs/pki',
        status: 'active',
        rateLimits: {
          requestsPerMinute: 20,
          requestsPerDay: 1000
        }
      }
    ];

    // Cache the simulated services
    services.forEach(service => {
      this.serviceCache.set(service.serviceId, service);
    });

    return services;
  }

  /**
   * Make HTTP request with proper error handling
   */
  private async makeHttpRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    data?: any,
    headers?: Record<string, string>,
    timeout = 30000
  ): Promise<{ statusCode: number; data: any; headers?: Record<string, string> }> {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DHA-Digital-Services/2025.1',
          'Accept': 'application/json',
          ...headers
        }
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      options.signal = controller.signal;

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const responseData = await response.json();

      return {
        statusCode: response.status,
        data: responseData,
        headers: Object.fromEntries([...response.headers.entries()])
      };

    } catch (error) {
      console.error(`SITA HTTP request failed:`, error);
      throw error;
    }
  }

  /**
   * Get simulated response for development
   */
  private getSimulatedResponse(url: string, method: string, data?: any): any {
    if (url.includes('/oauth2/token')) {
      return {
        access_token: 'simulated-access-token',
        refresh_token: 'simulated-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'government_services dha_integration eservices_access'
      };
    }

    if (url.includes('/services/discover')) {
      return {
        services: this.getSimulatedServices()
      };
    }

    if (url.includes('/eservices/integration')) {
      return {
        integrationUrl: 'https://eservices.gov.za/integration/session/abc123',
        sessionToken: 'session-token-123'
      };
    }

    if (url.includes('/pki/validate-certificate')) {
      return {
        isValid: true,
        issuer: 'South African Government CA',
        subject: 'CN=DHA Document Service',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        trustChain: ['Root CA', 'Intermediate CA', 'Service Certificate']
      };
    }

    return { success: true, message: 'Simulated response' };
  }
}

/**
 * Create SITA integration instance
 */
export function createSitaIntegration(): SitaIntegrationService {
  const clientId = process.env.SITA_CLIENT_ID || 'dev-sita-client';
  const clientSecret = process.env.SITA_CLIENT_SECRET || 'dev-sita-secret';
  const apiKey = process.env.SITA_API_KEY || 'dev-sita-key';
  
  if (process.env.NODE_ENV === 'production' && (!process.env.SITA_CLIENT_ID || !process.env.SITA_CLIENT_SECRET || !process.env.SITA_API_KEY)) {
    throw new Error('CRITICAL SECURITY ERROR: SITA_CLIENT_ID, SITA_CLIENT_SECRET, and SITA_API_KEY environment variables are required for SITA integration in production');
  }
  
  const credentials: SitaApiCredentials = {
    clientId,
    clientSecret,
    apiKey,
    environment: (process.env.NODE_ENV as any) || 'development'
  };

  return new SitaIntegrationService(credentials);
}

// Export singleton instance
export const sitaIntegration = createSitaIntegration();