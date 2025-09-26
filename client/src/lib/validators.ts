// South African Government Document Validators

/**
 * Validates South African ID number using Luhn algorithm
 * Format: YYMMDDSSSSCAZ
 * YY - year
 * MM - month  
 * DD - day
 * SSSS - sequence number (gender: female 0-4999, male 5000-9999)
 * C - citizenship (0 = SA citizen, 1 = permanent resident)
 * A - usually 8
 * Z - checksum digit
 */
export function validateSAIdNumber(idNumber: string): { valid: boolean; error?: string } {
  // Remove spaces and convert to string
  const id = idNumber.replace(/\s/g, '');
  
  // Check length
  if (id.length !== 13) {
    return { valid: false, error: "ID number must be 13 digits" };
  }
  
  // Check if all characters are digits
  if (!/^\d{13}$/.test(id)) {
    return { valid: false, error: "ID number must contain only digits" };
  }
  
  // Validate date
  const year = parseInt(id.substring(0, 2));
  const month = parseInt(id.substring(2, 4));
  const day = parseInt(id.substring(4, 6));
  
  if (month < 1 || month > 12) {
    return { valid: false, error: "Invalid month in ID number" };
  }
  
  if (day < 1 || day > 31) {
    return { valid: false, error: "Invalid day in ID number" };
  }
  
  // Validate citizenship digit
  const citizenship = parseInt(id.substring(10, 11));
  if (citizenship !== 0 && citizenship !== 1) {
    return { valid: false, error: "Invalid citizenship digit" };
  }
  
  // Luhn algorithm checksum
  let sum = 0;
  let alternate = false;
  
  for (let i = id.length - 1; i >= 0; i--) {
    let n = parseInt(id.charAt(i));
    
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n = (n % 10) + 1;
      }
    }
    
    sum += n;
    alternate = !alternate;
  }
  
  if (sum % 10 !== 0) {
    return { valid: false, error: "Invalid ID number checksum" };
  }
  
  return { valid: true };
}

/**
 * Validates South African passport number
 * Format: A followed by 8 digits (e.g., A12345678)
 */
export function validateSAPassportNumber(passportNumber: string): { valid: boolean; error?: string } {
  const passport = passportNumber.trim().toUpperCase();
  
  if (!/^[A-Z]\d{8}$/.test(passport)) {
    return { 
      valid: false, 
      error: "Passport number must start with a letter followed by 8 digits (e.g., A12345678)" 
    };
  }
  
  return { valid: true };
}

/**
 * Validates South African phone number
 * Formats: +27XXXXXXXXX, 0XXXXXXXXX
 */
export function validateSAPhoneNumber(phoneNumber: string): { valid: boolean; error?: string } {
  const phone = phoneNumber.replace(/[\s()-]/g, '');
  
  // Check for valid SA phone formats
  const validFormats = [
    /^(?:\+27|27|0)[1-8]\d{8}$/,  // Mobile and landline
    /^(?:\+27|27|0)8[0-7]\d{7}$/   // Cellular
  ];
  
  const isValid = validFormats.some(format => format.test(phone));
  
  if (!isValid) {
    return { 
      valid: false, 
      error: "Please enter a valid South African phone number (e.g., 0812345678 or +27812345678)" 
    };
  }
  
  return { valid: true };
}

/**
 * Validates South African postal code
 * Format: 4 digits
 */
export function validateSAPostalCode(postalCode: string): { valid: boolean; error?: string } {
  const code = postalCode.trim();
  
  if (!/^\d{4}$/.test(code)) {
    return { 
      valid: false, 
      error: "Postal code must be 4 digits" 
    };
  }
  
  const numCode = parseInt(code);
  if (numCode < 1 || numCode > 9999) {
    return { 
      valid: false, 
      error: "Invalid postal code range" 
    };
  }
  
  return { valid: true };
}

/**
 * Generates a DHA reference number
 * Format: DHA/YYYY/TYPE/NNNNNNN
 */
export function generateDHAReferenceNumber(documentType: string): string {
  const year = new Date().getFullYear();
  const typeMap: Record<string, string> = {
    'birth_certificate': 'BC',
    'marriage_certificate': 'MC',
    'death_certificate': 'DC',
    'passport': 'PP',
    'id_card': 'ID',
    'work_permit': 'WP',
    'permanent_visa': 'PV',
    'section22_permit': 'S22',
    'asylum_permit': 'AS',
    'refugee_id': 'RID',
    'refugee_travel': 'RTD',
    'diplomatic_passport': 'DP'
  };
  
  const type = typeMap[documentType] || 'DOC';
  const randomNumber = Math.floor(Math.random() * 9999999).toString().padStart(7, '0');
  
  return `DHA/${year}/${type}/${randomNumber}`;
}

/**
 * Generates a queue number
 */
export function generateQueueNumber(): { 
  queueNumber: string; 
  position: number; 
  total: number;
  estimatedWaitTime: number; // in minutes
} {
  const position = Math.floor(Math.random() * 2000) + 100;
  const total = position + Math.floor(Math.random() * 5000) + 1000;
  const estimatedWaitTime = position * Math.floor(Math.random() * 3 + 2); // 2-5 mins per person
  
  const prefix = ['A', 'B', 'C', 'D', 'E', 'F'][Math.floor(Math.random() * 6)];
  const number = Math.floor(Math.random() * 999) + 1;
  const queueNumber = `${prefix}${number.toString().padStart(3, '0')}`;
  
  return {
    queueNumber,
    position,
    total,
    estimatedWaitTime
  };
}

/**
 * Calculates working days (excluding weekends and SA public holidays)
 */
export function calculateWorkingDays(startDate: Date, numberOfDays: number): Date {
  const holidays = [
    '01-01', // New Year's Day
    '03-21', // Human Rights Day
    '04-27', // Freedom Day
    '05-01', // Workers' Day
    '06-16', // Youth Day
    '08-09', // National Women's Day
    '09-24', // Heritage Day
    '12-16', // Day of Reconciliation
    '12-25', // Christmas Day
    '12-26', // Day of Goodwill
  ];
  
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < numberOfDays) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    const dayOfWeek = currentDate.getDay();
    const monthDay = `${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`;
    
    // Skip weekends and holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(monthDay)) {
      daysAdded++;
    }
  }
  
  return currentDate;
}

/**
 * Validates file upload requirements
 */
export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'image/jpg'
  ];
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size must be less than 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
    };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: "File must be JPEG, PNG, or PDF format" 
    };
  }
  
  return { valid: true };
}

/**
 * Gets realistic processing status message
 */
export function getProcessingStatus(stage: number): {
  message: string;
  description: string;
  estimatedDays: number;
} {
  const statuses = [
    {
      message: "Application Received",
      description: "Your application has been successfully submitted and is awaiting initial review",
      estimatedDays: 1
    },
    {
      message: "Document Verification", 
      description: "Supporting documents are being verified for authenticity and completeness",
      estimatedDays: 3
    },
    {
      message: "Security Clearance",
      description: "Background checks and security clearance verification in progress with SAPS",
      estimatedDays: 7
    },
    {
      message: "Biometric Validation",
      description: "Biometric data is being validated against the National Population Register",
      estimatedDays: 2
    },
    {
      message: "Supervisor Review",
      description: "Application is pending supervisor approval and authorization",
      estimatedDays: 2
    },
    {
      message: "Quality Assurance",
      description: "Final quality assurance check before document production",
      estimatedDays: 1
    },
    {
      message: "Document Production",
      description: "Your document is being printed and prepared for collection",
      estimatedDays: 3
    },
    {
      message: "Ready for Collection",
      description: "Your document is ready for collection at the selected DHA office",
      estimatedDays: 0
    }
  ];
  
  return statuses[Math.min(stage, statuses.length - 1)];
}

/**
 * Formats a date in South African format
 */
export function formatSADate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Generates a barcode number for tracking
 */
export function generateTrackingBarcode(): string {
  const prefix = '7501';
  const random = Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
  const checkDigit = calculateCheckDigit(prefix + random);
  return prefix + random + checkDigit;
}

function calculateCheckDigit(code: string): string {
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    const digit = parseInt(code[i]);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  return ((10 - (sum % 10)) % 10).toString();
}