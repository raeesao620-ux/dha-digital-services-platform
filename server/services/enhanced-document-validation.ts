
export interface DocumentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityScore: number;
  compliance: {
    popia: boolean;
    icao: boolean;
    dha: boolean;
  };
  recommendations: string[];
}

export class EnhancedDocumentValidation {
  private validationRules: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeValidationRules();
  }

  private initializeValidationRules() {
    // Birth Certificate validation rules
    this.validationRules.set('birth_certificate', [
      this.validatePersonalDetails,
      this.validateParentDetails,
      this.validateRegistrationDetails,
      this.validateSecurityFeatures
    ]);

    // Work Permit validation rules
    this.validationRules.set('work_permit', [
      this.validatePersonalDetails,
      this.validateEmploymentDetails,
      this.validatePermitValidity,
      this.validateSecurityFeatures
    ]);

    // Passport validation rules
    this.validationRules.set('passport', [
      this.validatePersonalDetails,
      this.validatePassportSpecifics,
      this.validateICAOCompliance,
      this.validateSecurityFeatures
    ]);
  }

  public async validateDocument(documentType: string, data: any): Promise<DocumentValidationResult> {
    const result: DocumentValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityScore: 100,
      compliance: {
        popia: true,
        icao: false,
        dha: true
      },
      recommendations: []
    };

    const rules = this.validationRules.get(documentType) || [];
    
    for (const rule of rules) {
      try {
        const ruleResult = await rule(data);
        if (!ruleResult.valid) {
          result.isValid = false;
          result.errors.push(...ruleResult.errors);
          result.securityScore -= ruleResult.penalty || 10;
        }
        if (ruleResult.warnings) {
          result.warnings.push(...ruleResult.warnings);
        }
      } catch (error) {
        result.errors.push(`Validation rule failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.isValid = false;
      }
    }

    // ICAO compliance check for travel documents
    if (['passport', 'emergency_travel_certificate'].includes(documentType)) {
      result.compliance.icao = await this.checkICAOCompliance(data);
    }

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);

    return result;
  }

  private validatePersonalDetails = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.personal?.fullName || data.personal.fullName.length < 2) {
      errors.push('Full name is required and must be at least 2 characters');
    }

    if (!data.personal?.dateOfBirth) {
      errors.push('Date of birth is required');
    } else {
      const dob = new Date(data.personal.dateOfBirth);
      const now = new Date();
      if (dob > now) {
        errors.push('Date of birth cannot be in the future');
      }
    }

    if (!data.personal?.nationality) {
      warnings.push('Nationality not specified');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      penalty: errors.length * 15
    };
  };

  private validateParentDetails = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.parentDetails?.mother?.fullName) {
      errors.push('Mother\'s full name is required');
    }

    if (!data.parentDetails?.father?.fullName) {
      warnings.push('Father\'s details not provided');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      penalty: errors.length * 10
    };
  };

  private validateRegistrationDetails = (data: any) => {
    const errors: string[] = [];

    if (!data.registrationDetails?.registrationOffice) {
      errors.push('Registration office is required');
    }

    if (!data.registrationDetails?.registrarName) {
      errors.push('Registrar name is required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
      penalty: errors.length * 20
    };
  };

  private validateEmploymentDetails = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.employer?.name) {
      errors.push('Employer name is required');
    }

    if (!data.occupation) {
      errors.push('Occupation is required');
    }

    if (!data.validFrom || !data.validUntil) {
      errors.push('Permit validity period is required');
    } else {
      const from = new Date(data.validFrom);
      const until = new Date(data.validUntil);
      if (from >= until) {
        errors.push('Valid from date must be before valid until date');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      penalty: errors.length * 25
    };
  };

  private validatePermitValidity = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const now = new Date();
    const validUntil = new Date(data.validUntil);
    
    if (validUntil <= now) {
      errors.push('Permit expiry date must be in the future');
    }

    const monthsValid = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsValid > 60) { // 5 years
      warnings.push('Permit validity period exceeds recommended maximum of 5 years');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      penalty: errors.length * 30
    };
  };

  private validatePassportSpecifics = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.passportNumber || !/^[A-Z]\d{8}$/.test(data.passportNumber)) {
      errors.push('Passport number must be in format: 1 letter followed by 8 digits');
    }

    if (!data.issueDate || !data.expiryDate) {
      errors.push('Issue date and expiry date are required');
    } else {
      const issue = new Date(data.issueDate);
      const expiry = new Date(data.expiryDate);
      const now = new Date();
      
      if (issue > now) {
        errors.push('Issue date cannot be in the future');
      }
      
      if (expiry <= now) {
        warnings.push('Passport is expired or expires soon');
      }
      
      const validityYears = (expiry.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (validityYears > 10) {
        errors.push('Passport validity period cannot exceed 10 years');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      penalty: errors.length * 20
    };
  };

  private validateSecurityFeatures = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.securityFeatures) {
      warnings.push('Security features not specified');
      return {
        valid: true,
        errors,
        warnings,
        penalty: 5
      };
    }

    const requiredFeatures = ['watermark', 'hologram', 'microtext'];
    const missingFeatures = requiredFeatures.filter(feature => 
      !data.securityFeatures[feature]
    );

    if (missingFeatures.length > 0) {
      warnings.push(`Missing security features: ${missingFeatures.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      penalty: missingFeatures.length * 5
    };
  };

  private async checkICAOCompliance(data: any): Promise<boolean> {
    // ICAO compliance checks
    const requiredFields = ['passportNumber', 'nationality', 'dateOfBirth', 'gender'];
    const hasRequiredFields = requiredFields.every(field => 
      data.personal?.[field] || data[field]
    );

    const hasValidMRZ = data.mrzData && data.mrzData.length >= 88; // Standard MRZ length
    
    return hasRequiredFields && hasValidMRZ;
  }

  private generateRecommendations(result: DocumentValidationResult): string[] {
    const recommendations: string[] = [];

    if (result.securityScore < 80) {
      recommendations.push('Consider adding additional security features to improve document integrity');
    }

    if (result.errors.length > 0) {
      recommendations.push('Address all validation errors before document generation');
    }

    if (result.warnings.length > 2) {
      recommendations.push('Review and resolve warnings to ensure document quality');
    }

    if (!result.compliance.icao) {
      recommendations.push('Ensure ICAO compliance for international travel documents');
    }

    return recommendations;
  }
}

export const enhancedDocumentValidation = new EnhancedDocumentValidation();
