/**
 * Real-Time Validation Service
 * 
 * This service provides real-time validation of documents and form data
 * against government databases and business rules during user interaction.
 * 
 * Features:
 * - Real-time field validation against government databases
 * - Live document verification during upload
 * - Instant feedback on data accuracy and completeness
 * - Integration with DHA NPR, SAPS, and other government systems
 * - Automatic error correction suggestions
 * - Workflow validation and guidance
 */

import { EventEmitter } from 'events';
import { storage } from '../storage';
import { productionGovernmentApi } from './production-government-api';
import { dhaWorkflowEngine } from './dha-workflow-engine';
import { fraudDetectionService } from './fraud-detection';

export interface ValidationRule {
  field: string;
  type: 'format' | 'database' | 'business_rule' | 'cross_field' | 'government_api';
  severity: 'error' | 'warning' | 'info';
  message: string;
  validator: (value: any, context?: any) => Promise<ValidationResult>;
  dependencies?: string[]; // Other fields this validation depends on
  autoCorrect?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  correctedValue?: any;
  confidence: number;
  source?: string; // Which system validated this
  metadata?: any;
}

export interface RealTimeValidationRequest {
  userId: string;
  documentType: string;
  fieldName: string;
  fieldValue: any;
  formData: Record<string, any>;
  validationType: 'field' | 'document' | 'form' | 'workflow';
}

export interface RealTimeValidationResponse {
  isValid: boolean;
  validationResults: ValidationResult[];
  suggestions: string[];
  warnings: string[];
  errors: string[];
  governmentVerification?: {
    verified: boolean;
    source: string;
    confidence: number;
    additionalData?: any;
  };
  nextSteps?: string[];
  estimatedProcessingTime?: string;
}

/**
 * Real-Time Validation Service
 */
export class RealTimeValidationService extends EventEmitter {
  private static instance: RealTimeValidationService;
  private validationRules: Map<string, ValidationRule[]>;
  private activeValidations: Map<string, Promise<ValidationResult>>;
  private governmentApiCache: Map<string, { data: any; expires: number }>;

  // SA ID Number validation pattern
  private readonly SA_ID_PATTERN = /^[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{4}[01][89][0-9]$/;
  
  // Passport number patterns by country
  private readonly PASSPORT_PATTERNS = {
    'ZA': /^[A-Z][0-9]{8}$/, // South African passport
    'US': /^[0-9]{9}$/, // US passport
    'GB': /^[0-9]{9}$/, // UK passport
    'DE': /^[CFGHJKLMNPRTVWXYZ][0-9]{8}$/ // German passport
  };

  private constructor() {
    super();
    this.validationRules = new Map();
    this.activeValidations = new Map();
    this.governmentApiCache = new Map();
    this.initializeValidationRules();
    this.startCacheCleanup();
  }

  static getInstance(): RealTimeValidationService {
    if (!RealTimeValidationService.instance) {
      RealTimeValidationService.instance = new RealTimeValidationService();
    }
    return RealTimeValidationService.instance;
  }

  /**
   * Initialize validation rules for all document types
   */
  private initializeValidationRules(): void {
    // Birth Certificate validations
    this.addValidationRules('birth_certificate', [
      {
        field: 'idNumber',
        type: 'format',
        severity: 'error',
        message: 'Invalid South African ID number format',
        validator: this.validateSAIdNumber.bind(this)
      },
      {
        field: 'idNumber',
        type: 'database',
        severity: 'error',
        message: 'ID number not found in National Population Register',
        validator: this.validateIdNumberInNPR.bind(this)
      },
      {
        field: 'dateOfBirth',
        type: 'cross_field',
        severity: 'error',
        message: 'Date of birth does not match ID number',
        validator: this.validateDateOfBirthWithId.bind(this),
        dependencies: ['idNumber']
      }
    ]);

    // Passport validations
    this.addValidationRules('passport', [
      {
        field: 'passportNumber',
        type: 'format',
        severity: 'error',
        message: 'Invalid passport number format',
        validator: this.validatePassportNumber.bind(this)
      },
      {
        field: 'idNumber',
        type: 'database',
        severity: 'error',
        message: 'ID number verification failed',
        validator: this.validateIdNumberInNPR.bind(this)
      },
      {
        field: 'existingPassport',
        type: 'government_api',
        severity: 'warning',
        message: 'Previous passport verification',
        validator: this.validateExistingPassport.bind(this)
      }
    ]);

    // Work Permit validations
    this.addValidationRules('work_permit', [
      {
        field: 'passportNumber',
        type: 'format',
        severity: 'error',
        message: 'Invalid passport number format',
        validator: this.validatePassportNumber.bind(this)
      },
      {
        field: 'criminalRecord',
        type: 'government_api',
        severity: 'error',
        message: 'Criminal record check required',
        validator: this.validateCriminalRecord.bind(this)
      },
      {
        field: 'jobOffer',
        type: 'business_rule',
        severity: 'error',
        message: 'Valid job offer required',
        validator: this.validateJobOffer.bind(this)
      }
    ]);

    console.log('[Real-Time Validation] Validation rules initialized for', this.validationRules.size, 'document types');
  }

  /**
   * Add validation rules for a document type
   */
  private addValidationRules(documentType: string, rules: ValidationRule[]): void {
    const existingRules = this.validationRules.get(documentType) || [];
    this.validationRules.set(documentType, [...existingRules, ...rules]);
  }

  /**
   * Perform real-time validation
   */
  async validateRealTime(request: RealTimeValidationRequest): Promise<RealTimeValidationResponse> {
    const validationId = `${request.userId}_${request.documentType}_${request.fieldName}_${Date.now()}`;
    
    try {
      console.log(`[Real-Time Validation] Starting validation: ${validationId}`);

      const results: ValidationResult[] = [];
      const suggestions: string[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];

      // Get validation rules for this document type and field
      const rules = this.getValidationRules(request.documentType, request.fieldName);

      // Execute validations
      for (const rule of rules) {
        try {
          // Check dependencies
          if (rule.dependencies) {
            const missingDeps = rule.dependencies.filter(dep => !request.formData[dep]);
            if (missingDeps.length > 0) {
              continue; // Skip if dependencies not met
            }
          }

          // Use caching for expensive validations
          const cacheKey = `${rule.field}_${rule.type}_${JSON.stringify(request.fieldValue)}`;
          const cached = this.governmentApiCache.get(cacheKey);
          
          let result: ValidationResult;
          if (cached && cached.expires > Date.now()) {
            result = cached.data;
            console.log(`[Real-Time Validation] Cache hit for ${cacheKey}`);
          } else {
            result = await rule.validator(request.fieldValue, request.formData);
            
            // Cache result if from external API
            if (rule.type === 'database' || rule.type === 'government_api') {
              this.governmentApiCache.set(cacheKey, {
                data: result,
                expires: Date.now() + (5 * 60 * 1000) // 5 minutes cache
              });
            }
          }

          results.push(result);

          // Categorize results
          if (!result.isValid) {
            if (rule.severity === 'error') {
              errors.push(result.message);
            } else if (rule.severity === 'warning') {
              warnings.push(result.message);
            }
          }

          // Add suggestions
          if (result.correctedValue) {
            suggestions.push(`Suggested correction: ${result.correctedValue}`);
          }

        } catch (error) {
          console.error(`[Real-Time Validation] Rule execution error for ${rule.field}:`, error);
          results.push({
            isValid: false,
            message: 'Validation service temporarily unavailable',
            confidence: 0
          });
        }
      }

      // Government verification summary
      const governmentResults = results.filter(r => r.source?.includes('government'));
      const governmentVerification = governmentResults.length > 0 ? {
        verified: governmentResults.every(r => r.isValid),
        source: governmentResults.map(r => r.source).join(', '),
        confidence: governmentResults.reduce((sum, r) => sum + r.confidence, 0) / governmentResults.length
      } : undefined;

      // Workflow guidance
      const nextSteps = await this.getNextSteps(request);
      const estimatedProcessingTime = await this.getEstimatedProcessingTime(request);

      // Log validation event
      await storage.createSecurityEvent({
        eventType: 'realtime_validation_performed',
        severity: errors.length > 0 ? 'medium' : 'low',
        details: {
          validationId,
          documentType: request.documentType,
          fieldName: request.fieldName,
          rulesExecuted: rules.length,
          errors: errors.length,
          warnings: warnings.length
        }
      });

      const response: RealTimeValidationResponse = {
        isValid: errors.length === 0,
        validationResults: results,
        suggestions,
        warnings,
        errors,
        governmentVerification,
        nextSteps,
        estimatedProcessingTime
      };

      console.log(`[Real-Time Validation] Completed validation: ${validationId} - ${response.isValid ? 'VALID' : 'INVALID'}`);
      
      // Emit validation event
      this.emit('validation_completed', { request, response });

      return response;

    } catch (error) {
      console.error(`[Real-Time Validation] Validation error for ${validationId}:`, error);
      return {
        isValid: false,
        validationResults: [{
          isValid: false,
          message: 'Validation service error',
          confidence: 0
        }],
        suggestions: [],
        warnings: [],
        errors: ['Validation service temporarily unavailable']
      };
    }
  }

  /**
   * Get validation rules for document type and field
   */
  private getValidationRules(documentType: string, fieldName: string): ValidationRule[] {
    const allRules = this.validationRules.get(documentType) || [];
    return allRules.filter(rule => rule.field === fieldName);
  }

  /**
   * Validate South African ID number format and checksum
   */
  private async validateSAIdNumber(idNumber: string): Promise<ValidationResult> {
    if (!idNumber || typeof idNumber !== 'string') {
      return {
        isValid: false,
        message: 'ID number is required',
        confidence: 1.0
      };
    }

    // Remove spaces and validate format
    const cleanId = idNumber.replace(/\s/g, '');
    
    if (!this.SA_ID_PATTERN.test(cleanId)) {
      return {
        isValid: false,
        message: 'Invalid South African ID number format (should be 13 digits)',
        confidence: 1.0
      };
    }

    // Validate checksum digit
    const isValidChecksum = this.validateSAIdChecksum(cleanId);
    if (!isValidChecksum) {
      return {
        isValid: false,
        message: 'Invalid ID number checksum',
        confidence: 1.0
      };
    }

    // Extract and validate date of birth
    const dobString = cleanId.substring(0, 6);
    const year = parseInt(dobString.substring(0, 2));
    const month = parseInt(dobString.substring(2, 4));
    const day = parseInt(dobString.substring(4, 6));
    
    // Determine century (00-21 = 2000-2021, 22-99 = 1922-1999)
    const fullYear = year <= 21 ? 2000 + year : 1900 + year;
    
    const dob = new Date(fullYear, month - 1, day);
    if (dob.getFullYear() !== fullYear || dob.getMonth() !== month - 1 || dob.getDate() !== day) {
      return {
        isValid: false,
        message: 'Invalid date of birth in ID number',
        confidence: 1.0
      };
    }

    return {
      isValid: true,
      message: 'Valid South African ID number',
      confidence: 1.0,
      metadata: {
        dateOfBirth: dob,
        gender: parseInt(cleanId.substring(6, 10)) >= 5000 ? 'M' : 'F',
        citizenship: parseInt(cleanId.substring(10, 11)) === 0 ? 'SA' : 'Foreign'
      }
    };
  }

  /**
   * Validate SA ID checksum using Luhn algorithm variant
   */
  private validateSAIdChecksum(idNumber: string): boolean {
    const digits = idNumber.split('').map(Number);
    let sum = 0;
    
    for (let i = 0; i < 12; i++) {
      if (i % 2 === 0) {
        sum += digits[i];
      } else {
        const doubled = digits[i] * 2;
        sum += doubled > 9 ? doubled - 9 : doubled;
      }
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[12];
  }

  /**
   * Validate ID number against National Population Register
   */
  private async validateIdNumberInNPR(idNumber: string, formData: any): Promise<ValidationResult> {
    try {
      const response = await productionGovernmentApi.makeRequest('dha-npr', {
        method: 'POST',
        endpoint: '/verify/id-number',
        data: {
          idNumber: idNumber,
          fullName: formData.fullName,
          dateOfBirth: formData.dateOfBirth
        }
      });

      if (response.success && response.data) {
        return {
          isValid: response.data.verified === true,
          message: response.data.verified ? 'ID verified in National Population Register' : 'ID not found in National Population Register',
          confidence: response.data.confidence || 0.9,
          source: 'DHA NPR',
          metadata: response.data
        };
      } else {
        return {
          isValid: false,
          message: 'Unable to verify ID number with government database',
          confidence: 0,
          source: 'DHA NPR'
        };
      }
    } catch (error) {
      console.error('[Real-Time Validation] NPR verification error:', error);
      return {
        isValid: false,
        message: 'Government verification service temporarily unavailable',
        confidence: 0,
        source: 'DHA NPR'
      };
    }
  }

  /**
   * Validate date of birth matches ID number
   */
  private async validateDateOfBirthWithId(dateOfBirth: string, formData: any): Promise<ValidationResult> {
    const idNumber = formData.idNumber;
    if (!idNumber || !dateOfBirth) {
      return {
        isValid: false,
        message: 'Both ID number and date of birth are required',
        confidence: 1.0
      };
    }

    // Extract date from ID number
    const dobFromId = idNumber.substring(0, 6);
    const year = parseInt(dobFromId.substring(0, 2));
    const month = parseInt(dobFromId.substring(2, 4));
    const day = parseInt(dobFromId.substring(4, 6));
    
    const fullYear = year <= 21 ? 2000 + year : 1900 + year;
    const idDate = new Date(fullYear, month - 1, day);
    const providedDate = new Date(dateOfBirth);

    const isMatch = idDate.getTime() === providedDate.getTime();

    return {
      isValid: isMatch,
      message: isMatch ? 'Date of birth matches ID number' : 'Date of birth does not match ID number',
      confidence: 1.0,
      correctedValue: isMatch ? undefined : idDate.toISOString().split('T')[0]
    };
  }

  /**
   * Validate passport number format
   */
  private async validatePassportNumber(passportNumber: string, formData: any): Promise<ValidationResult> {
    if (!passportNumber || typeof passportNumber !== 'string') {
      return {
        isValid: false,
        message: 'Passport number is required',
        confidence: 1.0
      };
    }

    const cleanPassport = passportNumber.replace(/\s/g, '').toUpperCase();
    const nationality = formData.nationality || 'ZA';
    
    const pattern = this.PASSPORT_PATTERNS[nationality as keyof typeof this.PASSPORT_PATTERNS];
    if (!pattern) {
      return {
        isValid: false,
        message: `Passport validation not available for nationality: ${nationality}`,
        confidence: 0.5
      };
    }

    const isValid = pattern.test(cleanPassport);
    return {
      isValid,
      message: isValid ? `Valid ${nationality} passport number format` : `Invalid ${nationality} passport number format`,
      confidence: 1.0,
      correctedValue: isValid ? undefined : cleanPassport
    };
  }

  /**
   * Validate existing passport
   */
  private async validateExistingPassport(passportNumber: string, formData: any): Promise<ValidationResult> {
    try {
      const response = await productionGovernmentApi.makeRequest('dha-home-affairs', {
        method: 'POST',
        endpoint: '/verify/passport',
        data: {
          passportNumber,
          idNumber: formData.idNumber,
          fullName: formData.fullName
        }
      });

      if (response.success) {
        return {
          isValid: true,
          message: response.data.exists ? 'Previous passport found in system' : 'No previous passport found',
          confidence: 0.9,
          source: 'DHA Home Affairs',
          metadata: response.data
        };
      } else {
        return {
          isValid: true, // Don't fail validation if we can't check
          message: 'Unable to verify existing passport',
          confidence: 0.3,
          source: 'DHA Home Affairs'
        };
      }
    } catch (error) {
      return {
        isValid: true, // Don't fail validation on error
        message: 'Existing passport verification unavailable',
        confidence: 0.1,
        source: 'DHA Home Affairs'
      };
    }
  }

  /**
   * Validate criminal record for work permit
   */
  private async validateCriminalRecord(value: any, formData: any): Promise<ValidationResult> {
    if (!formData.idNumber && !formData.passportNumber) {
      return {
        isValid: false,
        message: 'ID number or passport number required for criminal record check',
        confidence: 1.0
      };
    }

    try {
      const response = await productionGovernmentApi.makeRequest('saps-crc', {
        method: 'POST',
        endpoint: '/check/criminal-record',
        data: {
          idNumber: formData.idNumber,
          passportNumber: formData.passportNumber,
          fullName: formData.fullName,
          dateOfBirth: formData.dateOfBirth,
          purposeOfCheck: 'work_permit'
        }
      });

      if (response.success && response.data) {
        const hasCriminalRecord = response.data.hasCriminalRecord;
        return {
          isValid: !hasCriminalRecord,
          message: hasCriminalRecord ? 'Criminal record found - application may be affected' : 'No criminal record found',
          confidence: response.data.confidence || 0.9,
          source: 'SAPS CRC',
          metadata: response.data
        };
      } else {
        return {
          isValid: false,
          message: 'Unable to complete criminal record check',
          confidence: 0,
          source: 'SAPS CRC'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        message: 'Criminal record check service temporarily unavailable',
        confidence: 0,
        source: 'SAPS CRC'
      };
    }
  }

  /**
   * Validate job offer for work permit
   */
  private async validateJobOffer(jobOfferDoc: any, formData: any): Promise<ValidationResult> {
    // This would validate job offer document
    // For now, basic validation
    if (!jobOfferDoc) {
      return {
        isValid: false,
        message: 'Job offer letter is required',
        confidence: 1.0
      };
    }

    // Check if document contains required information
    const requiredFields = ['companyName', 'position', 'salary', 'startDate'];
    const missingFields = requiredFields.filter(field => !formData[field]);

    if (missingFields.length > 0) {
      return {
        isValid: false,
        message: `Job offer missing required information: ${missingFields.join(', ')}`,
        confidence: 1.0
      };
    }

    return {
      isValid: true,
      message: 'Job offer appears valid',
      confidence: 0.8
    };
  }

  /**
   * Get next steps in the workflow
   */
  private async getNextSteps(request: RealTimeValidationRequest): Promise<string[]> {
    try {
      // This would integrate with the workflow engine
      return [
        'Complete remaining required fields',
        'Upload supporting documents',
        'Schedule biometric appointment',
        'Pay processing fee'
      ];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get estimated processing time
   */
  private async getEstimatedProcessingTime(request: RealTimeValidationRequest): Promise<string> {
    // This would calculate based on document type, current workload, etc.
    const processingTimes = {
      'birth_certificate': '5-7 working days',
      'passport': '10-15 working days',
      'work_permit': '30-45 working days',
      'study_permit': '20-30 working days'
    };

    return processingTimes[request.documentType as keyof typeof processingTimes] || '15-20 working days';
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.governmentApiCache.entries()) {
        if (cached.expires <= now) {
          this.governmentApiCache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      totalRules: Array.from(this.validationRules.values()).reduce((sum, rules) => sum + rules.length, 0),
      documentTypes: this.validationRules.size,
      activeValidations: this.activeValidations.size,
      cacheSize: this.governmentApiCache.size
    };
  }
}

// Export singleton instance
export const realTimeValidationService = RealTimeValidationService.getInstance();