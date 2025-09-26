import crypto from "crypto";
import { storage } from "../storage";
import { InsertDhaVerification, InsertDhaAuditEvent } from "@shared/schema";
import { privacyProtectionService } from "./privacy-protection";

/**
 * DHA MRZ (Machine Readable Zone) Parser
 * 
 * This service parses and validates MRZ data from South African passports
 * according to ICAO Document 9303 standards with specific validation
 * for South African passport formats.
 * 
 * Features:
 * - ICAO Doc 9303 compliant MRZ parsing
 * - Check digit validation for all MRZ fields
 * - South African passport format validation
 * - Data extraction and normalization
 * - Tamper detection through checksum validation
 */

export interface MRZData {
  // Line 1 - Document type and issuing state
  documentType: string; // 'P' for passport
  issuingState: string; // 'ZAF' for South Africa
  surname: string;
  
  // Line 2 - Personal and document details
  passportNumber: string;
  checkDigitPassport: string;
  nationality: string;
  dateOfBirth: string; // YYMMDD format
  checkDigitDateOfBirth: string;
  sex: string; // 'M', 'F', or 'X'
  expirationDate: string; // YYMMDD format
  checkDigitExpirationDate: string;
  personalNumber: string; // Optional additional identifier
  checkDigitPersonalNumber: string;
  checkDigitFinal: string; // Composite check digit
  
  // Parsed/derived data
  fullName: string;
  parsedDateOfBirth: Date;
  parsedExpirationDate: Date;
  isExpired: boolean;
  age: number;
  
  // Validation results
  isValid: boolean;
  validationErrors: string[];
  checksumValidation: {
    passportCheckDigit: boolean;
    dateOfBirthCheckDigit: boolean;
    expirationCheckDigit: boolean;
    personalNumberCheckDigit: boolean;
    finalCheckDigit: boolean;
    allValid: boolean;
  };
}

export interface MRZParsingRequest {
  applicantId: string;
  applicationId: string;
  mrzLine1: string;
  mrzLine2: string;
  validateChecksums: boolean;
  strictValidation: boolean; // Strict South African format validation
}

export interface MRZParsingResponse {
  success: boolean;
  requestId: string;
  validationResult: 'valid' | 'invalid' | 'checksum_failed';
  parsedData: MRZData;
  
  // Quality assessment
  dataQuality: {
    readabilityScore: number; // 0-100
    missingFields: string[];
    suspiciousFields: string[];
    formatCompliance: 'full' | 'partial' | 'non_compliant';
  };
  
  // Security assessment
  securityAssessment: {
    tamperIndicators: string[];
    riskLevel: 'low' | 'medium' | 'high';
    recommendManualReview: boolean;
  };
  
  processingTime: number;
  error?: string;
}

export class DHAMRZParser {
  private readonly characterMap: Map<string, string>;
  
  constructor() {
    // Initialize character mapping for MRZ parsing
    this.characterMap = new Map([
      ['<', ''], // Filler character
      ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'],
      ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'],
      // Add other valid MRZ characters as needed
    ]);
  }

  /**
   * Parse MRZ data from passport
   */
  async parseMRZ(request: MRZParsingRequest): Promise<MRZParsingResponse> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Validate input
      this.validateInput(request);

      // Log audit event
      await this.logAuditEvent({
        applicationId: request.applicationId,
        applicantId: request.applicantId,
        eventType: 'mrz_parsing_started',
        eventCategory: 'system',
        eventDescription: 'MRZ parsing and validation started',
        actorType: 'system',
        actorId: 'mrz-parser',
        contextData: {
          requestId,
          validateChecksums: request.validateChecksums,
          strictValidation: request.strictValidation,
          mrzLength: request.mrzLine1.length + request.mrzLine2.length
        }
      });

      // Parse MRZ data
      const parsedData = this.parseMRZLines(request.mrzLine1, request.mrzLine2, request.validateChecksums);
      
      // Perform quality assessment
      const dataQuality = this.assessDataQuality(parsedData, request.mrzLine1, request.mrzLine2);
      
      // Perform security assessment
      const securityAssessment = this.performSecurityAssessment(parsedData, dataQuality);
      
      // Determine validation result
      let validationResult: 'valid' | 'invalid' | 'checksum_failed';
      
      if (!parsedData.checksumValidation.allValid) {
        validationResult = 'checksum_failed';
      } else if (!parsedData.isValid) {
        validationResult = 'invalid';
      } else {
        validationResult = 'valid';
      }

      const response: MRZParsingResponse = {
        success: true,
        requestId,
        validationResult,
        parsedData,
        dataQuality,
        securityAssessment,
        processingTime: Date.now() - startTime
      };

      // Store verification result
      await this.storeVerificationResult(request, response);

      // Log completion
      await this.logAuditEvent({
        applicationId: request.applicationId,
        applicantId: request.applicantId,
        eventType: 'mrz_parsing_completed',
        eventCategory: 'system',
        eventDescription: `MRZ parsing completed with result: ${validationResult}`,
        actorType: 'system',
        actorId: 'mrz-parser',
        contextData: {
          requestId,
          validationResult,
          passportNumber: parsedData.passportNumber,
          nationality: parsedData.nationality,
          isExpired: parsedData.isExpired,
          dataQualityScore: dataQuality.readabilityScore,
          processingTime: response.processingTime
        }
      });

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log error
      await this.logAuditEvent({
        applicationId: request.applicationId,
        applicantId: request.applicantId,
        eventType: 'mrz_parsing_failed',
        eventCategory: 'system',
        eventDescription: `MRZ parsing failed: ${errorMessage}`,
        actorType: 'system',
        actorId: 'mrz-parser',
        contextData: {
          requestId,
          error: errorMessage,
          processingTime
        }
      });

      return {
        success: false,
        requestId,
        validationResult: 'invalid',
        parsedData: this.getEmptyMRZData(),
        dataQuality: {
          readabilityScore: 0,
          missingFields: [],
          suspiciousFields: [],
          formatCompliance: 'non_compliant'
        },
        securityAssessment: {
          tamperIndicators: ['Parsing failed'],
          riskLevel: 'high',
          recommendManualReview: true
        },
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Validate MRZ parsing input
   */
  private validateInput(request: MRZParsingRequest): void {
    if (!request.mrzLine1 || !request.mrzLine2) {
      throw new Error('Both MRZ lines are required');
    }

    // Standard passport MRZ line lengths
    if (request.mrzLine1.length !== 44) {
      throw new Error(`MRZ line 1 must be 44 characters, got ${request.mrzLine1.length}`);
    }

    if (request.mrzLine2.length !== 44) {
      throw new Error(`MRZ line 2 must be 44 characters, got ${request.mrzLine2.length}`);
    }

    // Check for valid MRZ characters
    const validMRZPattern = /^[A-Z0-9<]+$/;
    
    if (!validMRZPattern.test(request.mrzLine1)) {
      throw new Error('MRZ line 1 contains invalid characters');
    }

    if (!validMRZPattern.test(request.mrzLine2)) {
      throw new Error('MRZ line 2 contains invalid characters');
    }
  }

  /**
   * Parse MRZ lines according to ICAO Doc 9303
   */
  private parseMRZLines(line1: string, line2: string, validateChecksums: boolean): MRZData {
    const errors: string[] = [];

    // Parse Line 1: Document type, issuing state, and name
    const documentType = line1.substring(0, 1);
    const issuingState = line1.substring(2, 5);
    const nameField = line1.substring(5, 44);
    
    // Parse Line 2: Document details
    const passportNumber = this.cleanField(line2.substring(0, 9));
    const checkDigitPassport = line2.substring(9, 10);
    const nationality = line2.substring(10, 13);
    const dateOfBirth = line2.substring(13, 19);
    const checkDigitDateOfBirth = line2.substring(19, 20);
    const sex = line2.substring(20, 21);
    const expirationDate = line2.substring(21, 27);
    const checkDigitExpirationDate = line2.substring(27, 28);
    const personalNumber = this.cleanField(line2.substring(28, 42));
    const checkDigitPersonalNumber = line2.substring(42, 43);
    const checkDigitFinal = line2.substring(43, 44);

    // Parse name from line 1
    const { surname, fullName } = this.parseName(nameField);

    // Validate document type (should be 'P' for passport)
    if (documentType !== 'P') {
      errors.push(`Invalid document type: ${documentType}, expected 'P'`);
    }

    // Validate issuing state (should be 'ZAF' for South Africa)
    if (issuingState !== 'ZAF') {
      errors.push(`Invalid issuing state: ${issuingState}, expected 'ZAF' for South Africa`);
    }

    // Validate nationality
    if (nationality !== 'ZAF') {
      errors.push(`Invalid nationality: ${nationality}, expected 'ZAF' for South African passport`);
    }

    // Parse dates
    const parsedDateOfBirth = this.parseDate(dateOfBirth);
    const parsedExpirationDate = this.parseDate(expirationDate);

    if (!parsedDateOfBirth) {
      errors.push(`Invalid date of birth: ${dateOfBirth}`);
    }

    if (!parsedExpirationDate) {
      errors.push(`Invalid expiration date: ${expirationDate}`);
    }

    // Calculate age and check expiry
    const now = new Date();
    const age = parsedDateOfBirth ? now.getFullYear() - parsedDateOfBirth.getFullYear() : 0;
    const isExpired = parsedExpirationDate ? parsedExpirationDate < now : true;

    // Validate sex
    if (!['M', 'F', 'X'].includes(sex)) {
      errors.push(`Invalid sex indicator: ${sex}`);
    }

    // Perform checksum validation
    const checksumValidation = validateChecksums ? this.validateChecksums({
      passportNumber,
      checkDigitPassport,
      dateOfBirth,
      checkDigitDateOfBirth,
      expirationDate,
      checkDigitExpirationDate,
      personalNumber,
      checkDigitPersonalNumber,
      checkDigitFinal,
      line2
    }) : {
      passportCheckDigit: true,
      dateOfBirthCheckDigit: true,
      expirationCheckDigit: true,
      personalNumberCheckDigit: true,
      finalCheckDigit: true,
      allValid: true
    };

    return {
      documentType,
      issuingState,
      surname,
      passportNumber,
      checkDigitPassport,
      nationality,
      dateOfBirth,
      checkDigitDateOfBirth,
      sex,
      expirationDate,
      checkDigitExpirationDate,
      personalNumber,
      checkDigitPersonalNumber,
      checkDigitFinal,
      fullName,
      parsedDateOfBirth: parsedDateOfBirth || new Date(),
      parsedExpirationDate: parsedExpirationDate || new Date(),
      isExpired,
      age,
      isValid: errors.length === 0 && checksumValidation.allValid,
      validationErrors: errors,
      checksumValidation
    };
  }

  /**
   * Parse name field from MRZ line 1
   */
  private parseName(nameField: string): { surname: string; fullName: string } {
    // Remove filler characters and split by <<
    const cleanName = nameField.replace(/<+$/, '');
    const nameParts = cleanName.split('<<');
    
    const surname = nameParts[0]?.replace(/</g, ' ').trim() || '';
    const givenNames = nameParts[1]?.replace(/</g, ' ').trim() || '';
    
    const fullName = givenNames ? `${givenNames} ${surname}` : surname;
    
    return { surname, fullName };
  }

  /**
   * Parse date from MRZ format (YYMMDD)
   */
  private parseDate(dateStr: string): Date | null {
    if (dateStr.length !== 6 || !/^\d{6}$/.test(dateStr)) {
      return null;
    }

    const year = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));

    // Determine century (assume 20xx for years 00-30, 19xx for 31-99)
    const fullYear = year <= 30 ? 2000 + year : 1900 + year;

    try {
      const date = new Date(fullYear, month - 1, day);
      
      // Validate date is reasonable
      if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null;
      }
      
      return date;
    } catch {
      return null;
    }
  }

  /**
   * Clean MRZ field by removing filler characters
   */
  private cleanField(field: string): string {
    return field.replace(/</g, '').trim();
  }

  /**
   * Validate MRZ checksums according to ICAO Doc 9303
   */
  private validateChecksums(data: any): any {
    const passportCheckDigit = this.calculateCheckDigit(data.passportNumber) === data.checkDigitPassport;
    const dateOfBirthCheckDigit = this.calculateCheckDigit(data.dateOfBirth) === data.checkDigitDateOfBirth;
    const expirationCheckDigit = this.calculateCheckDigit(data.expirationDate) === data.checkDigitExpirationDate;
    
    // Personal number check digit (if personal number exists)
    const personalNumberCheckDigit = data.personalNumber 
      ? this.calculateCheckDigit(data.personalNumber) === data.checkDigitPersonalNumber
      : data.checkDigitPersonalNumber === '<';

    // Final composite check digit
    const compositeString = data.passportNumber + data.checkDigitPassport + 
                           data.dateOfBirth + data.checkDigitDateOfBirth +
                           data.expirationDate + data.checkDigitExpirationDate;
    const finalCheckDigit = this.calculateCheckDigit(compositeString) === data.checkDigitFinal;

    const allValid = passportCheckDigit && dateOfBirthCheckDigit && 
                     expirationCheckDigit && personalNumberCheckDigit && finalCheckDigit;

    return {
      passportCheckDigit,
      dateOfBirthCheckDigit,
      expirationCheckDigit,
      personalNumberCheckDigit,
      finalCheckDigit,
      allValid
    };
  }

  /**
   * Calculate MRZ check digit according to ICAO Doc 9303
   */
  private calculateCheckDigit(input: string): string {
    const weights = [7, 3, 1];
    let sum = 0;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      let value: number;

      if (char >= '0' && char <= '9') {
        value = parseInt(char);
      } else if (char >= 'A' && char <= 'Z') {
        value = char.charCodeAt(0) - 65 + 10; // A=10, B=11, ..., Z=35
      } else if (char === '<') {
        value = 0;
      } else {
        value = 0; // Default for invalid characters
      }

      sum += value * weights[i % 3];
    }

    return (sum % 10).toString();
  }

  /**
   * Assess data quality of parsed MRZ
   */
  private assessDataQuality(parsedData: MRZData, line1: string, line2: string): any {
    const missingFields: string[] = [];
    const suspiciousFields: string[] = [];
    let readabilityScore = 100;

    // Check for missing required fields
    if (!parsedData.passportNumber) missingFields.push('passport_number');
    if (!parsedData.surname) missingFields.push('surname');
    if (!parsedData.dateOfBirth) missingFields.push('date_of_birth');
    if (!parsedData.expirationDate) missingFields.push('expiration_date');

    // Check for suspicious patterns
    if (parsedData.passportNumber.length < 6) {
      suspiciousFields.push('passport_number_too_short');
    }

    if (parsedData.age < 0 || parsedData.age > 120) {
      suspiciousFields.push('unrealistic_age');
    }

    if (parsedData.surname.length < 2) {
      suspiciousFields.push('surname_too_short');
    }

    // Check for excessive filler characters (may indicate OCR issues)
    const fillerCount = (line1 + line2).split('<').length - 1;
    if (fillerCount > 40) {
      suspiciousFields.push('excessive_filler_characters');
      readabilityScore -= 20;
    }

    // Reduce score for validation errors
    readabilityScore -= parsedData.validationErrors.length * 10;
    readabilityScore -= missingFields.length * 15;
    readabilityScore -= suspiciousFields.length * 5;

    readabilityScore = Math.max(0, readabilityScore);

    // Determine format compliance
    let formatCompliance: 'full' | 'partial' | 'non_compliant';
    if (parsedData.isValid && missingFields.length === 0) {
      formatCompliance = 'full';
    } else if (parsedData.validationErrors.length <= 2) {
      formatCompliance = 'partial';
    } else {
      formatCompliance = 'non_compliant';
    }

    return {
      readabilityScore,
      missingFields,
      suspiciousFields,
      formatCompliance
    };
  }

  /**
   * Perform security assessment
   */
  private performSecurityAssessment(parsedData: MRZData, dataQuality: any): any {
    const tamperIndicators: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for checksum failures (strong tamper indicator)
    if (!parsedData.checksumValidation.allValid) {
      tamperIndicators.push('Checksum validation failed');
      riskLevel = 'high';
    }

    // Check for format inconsistencies
    if (dataQuality.formatCompliance === 'non_compliant') {
      tamperIndicators.push('Non-compliant MRZ format');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    // Check for suspicious data patterns
    if (dataQuality.suspiciousFields.length > 2) {
      tamperIndicators.push('Multiple suspicious data fields');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    // Check for low readability (OCR issues or potential tampering)
    if (dataQuality.readabilityScore < 70) {
      tamperIndicators.push('Low data readability score');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    const recommendManualReview = riskLevel === 'high' || tamperIndicators.length > 1;

    return {
      tamperIndicators,
      riskLevel,
      recommendManualReview
    };
  }

  /**
   * Get empty MRZ data structure
   */
  private getEmptyMRZData(): MRZData {
    return {
      documentType: '',
      issuingState: '',
      surname: '',
      passportNumber: '',
      checkDigitPassport: '',
      nationality: '',
      dateOfBirth: '',
      checkDigitDateOfBirth: '',
      sex: '',
      expirationDate: '',
      checkDigitExpirationDate: '',
      personalNumber: '',
      checkDigitPersonalNumber: '',
      checkDigitFinal: '',
      fullName: '',
      parsedDateOfBirth: new Date(),
      parsedExpirationDate: new Date(),
      isExpired: true,
      age: 0,
      isValid: false,
      validationErrors: [],
      checksumValidation: {
        passportCheckDigit: false,
        dateOfBirthCheckDigit: false,
        expirationCheckDigit: false,
        personalNumberCheckDigit: false,
        finalCheckDigit: false,
        allValid: false
      }
    };
  }

  /**
   * Store verification result in database
   */
  private async storeVerificationResult(request: MRZParsingRequest, response: MRZParsingResponse): Promise<void> {
    const verificationData: InsertDhaVerification = {
      applicationId: request.applicationId,
      applicantId: request.applicantId,
      verificationType: 'mrz',
      verificationService: 'dha-mrz-parser',
      verificationMethod: request.strictValidation ? 'strict' : 'standard',
      requestId: response.requestId,
      requestData: {
        validateChecksums: request.validateChecksums,
        strictValidation: request.strictValidation,
        mrzLength: request.mrzLine1.length + request.mrzLine2.length
      },
      requestTimestamp: new Date(),
      responseStatus: response.success ? 'success' : 'failed',
      responseData: {
        validationResult: response.validationResult,
        parsedData: response.parsedData,
        dataQuality: response.dataQuality,
        securityAssessment: response.securityAssessment,
        error: response.error
      },
      responseTimestamp: new Date(),
      responseTime: response.processingTime,
      verificationResult: response.validationResult === 'valid' ? 'verified' : 'not_verified',
      confidenceScore: response.dataQuality.readabilityScore,
      mrzValidationResult: response.validationResult,
      mrzParsedData: response.parsedData,
      errorCode: response.error ? 'MRZ_PARSING_FAILED' : undefined,
      errorMessage: response.error
    };

    await storage.createDhaVerification(verificationData);
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(eventData: Omit<InsertDhaAuditEvent, 'timestamp'>): Promise<void> {
    await storage.createDhaAuditEvent({
      ...eventData,
      timestamp: new Date()
    });
  }

  /**
   * Parse MRZ from image OCR result
   */
  async parseMRZFromOCR(ocrText: string): Promise<{ line1: string; line2: string } | null> {
    // Extract MRZ lines from OCR text
    const lines = ocrText.split('\n').map(line => line.trim());
    
    // Look for lines that match MRZ pattern (44 characters, alphanumeric + <)
    const mrzLines = lines.filter(line => 
      line.length === 44 && /^[A-Z0-9<]+$/.test(line)
    );

    if (mrzLines.length >= 2) {
      return {
        line1: mrzLines[0],
        line2: mrzLines[1]
      };
    }

    return null;
  }

  /**
   * Validate specific South African passport number format
   */
  validateSouthAfricanPassportNumber(passportNumber: string): boolean {
    // South African passport format: 1-2 letters followed by 6-8 digits
    const saPassportPattern = /^[A-Z]{1,2}\d{6,8}$/;
    return saPassportPattern.test(passportNumber);
  }
}

export const dhaMRZParser = new DHAMRZParser();