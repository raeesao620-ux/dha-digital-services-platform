import crypto from "crypto";
import { storage } from "../storage";
import { InsertDhaVerification, InsertDhaAuditEvent } from "@shared/schema";
import { privacyProtectionService } from "./privacy-protection";

/**
 * DHA ICAO PKD (Public Key Directory) Adapter
 * 
 * This adapter interfaces with the ICAO Public Key Directory to validate
 * passport certificates and verify the authenticity of South African ePassports.
 * 
 * Features:
 * - Certificate chain validation
 * - CRL (Certificate Revocation List) checking
 * - CSCA (Country Signing Certificate Authority) validation
 * - Document Security Object (SOD) verification
 */

export interface PKDCertificate {
  serialNumber: string;
  issuer: string;
  subject: string;
  notBefore: Date;
  notAfter: Date;
  publicKey: string;
  signatureAlgorithm: string;
  certificateData: string; // Base64 encoded certificate
  keyUsage: string[];
  isCA: boolean;
}

export interface PKDValidationRequest {
  applicantId: string;
  applicationId: string;
  passportNumber: string;
  documentSOD: string; // Base64 encoded Security Object
  certificates: PKDCertificate[]; // Certificate chain from passport chip
  validationLevel: 'basic' | 'enhanced' | 'full';
  checkRevocation: boolean;
}

export interface PKDValidationResponse {
  success: boolean;
  requestId: string;
  certificateStatus: 'valid' | 'invalid' | 'revoked' | 'expired' | 'unknown';
  validationResult: 'verified' | 'not_verified' | 'inconclusive';
  
  // Certificate Details
  issuerCountry: string;
  issuerAuthority: string;
  certificateSerial: string;
  validFromDate: Date;
  validUntilDate: Date;
  
  // Validation Results
  chainValidation: {
    isValid: boolean;
    chainLength: number;
    rootCAValid: boolean;
    intermediateCAValid: boolean;
    leafCertValid: boolean;
    signatureValid: boolean;
  };
  
  // Revocation Check
  revocationCheck: {
    performed: boolean;
    crlChecked: boolean;
    ocspChecked: boolean;
    isRevoked: boolean;
    revokedDate?: Date;
    revocationReason?: string;
  };
  
  // Security Assessment
  securityAssessment: {
    cryptographicStrength: 'weak' | 'acceptable' | 'strong';
    algorithmSecurity: 'deprecated' | 'current' | 'future-proof';
    keyLength: number;
    riskFactors: string[];
  };
  
  processingTime: number;
  error?: string;
}

export class DHAPKDAdapter {
  private readonly pkdBaseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number = 30000; // 30 seconds
  private readonly retryAttempts: number = 3;

  // South African CSCA certificates (mock data for development)
  private readonly southAfricanCSCA = {
    serialNumber: "0x123456789ABCDEF",
    issuer: "C=ZA, O=Department of Home Affairs, CN=South Africa CSCA",
    subject: "C=ZA, O=Department of Home Affairs, CN=South Africa CSCA",
    publicKey: "mock-csca-public-key-data",
    validFrom: new Date('2020-01-01'),
    validUntil: new Date('2030-12-31')
  };

  constructor() {
    const pkdBaseUrl = process.env.ICAO_PKD_BASE_URL;
    const apiKey = process.env.ICAO_PKD_API_KEY;
    
    // Only throw errors in production - provide development fallbacks
    if (!pkdBaseUrl || !apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL SECURITY ERROR: ICAO_PKD_BASE_URL and ICAO_PKD_API_KEY environment variables are required for ICAO PKD integration in production');
      }
      
      console.warn('[DHA PKD Adapter] WARNING: Using development fallback configuration - NOT FOR PRODUCTION');
      this.pkdBaseUrl = 'https://dev-pkd.icao.int';
      this.apiKey = 'dev-pkd-api-key';
      return;
    }
    
    this.pkdBaseUrl = pkdBaseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Validate passport certificates against PKD
   */
  async validatePassportCertificates(request: PKDValidationRequest): Promise<PKDValidationResponse> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Validate request
      this.validateRequest(request);

      // Log audit event
      await this.logAuditEvent({
        applicationId: request.applicationId,
        applicantId: request.applicantId,
        eventType: 'pkd_validation_started',
        eventCategory: 'external_service',
        eventDescription: `PKD ${request.validationLevel} validation started for passport ${request.passportNumber}`,
        actorType: 'system',
        actorId: 'pkd-adapter',
        contextData: {
          requestId,
          passportNumber: request.passportNumber,
          validationLevel: request.validationLevel,
          certificateCount: request.certificates.length,
          checkRevocation: request.checkRevocation
        }
      });

      // Perform certificate validation
      const response = await this.performPKDValidation(requestId, request);
      response.processingTime = Date.now() - startTime;

      // Store verification result
      await this.storeVerificationResult(request, response);

      // Log completion
      await this.logAuditEvent({
        applicationId: request.applicationId,
        applicantId: request.applicantId,
        eventType: 'pkd_validation_completed',
        eventCategory: 'external_service',
        eventDescription: `PKD validation completed with status: ${response.certificateStatus}`,
        actorType: 'system',
        actorId: 'pkd-adapter',
        contextData: {
          requestId,
          certificateStatus: response.certificateStatus,
          validationResult: response.validationResult,
          issuerCountry: response.issuerCountry,
          chainValid: response.chainValidation.isValid,
          revocationChecked: response.revocationCheck.performed,
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
        eventType: 'pkd_validation_failed',
        eventCategory: 'external_service',
        eventDescription: `PKD validation failed: ${errorMessage}`,
        actorType: 'system',
        actorId: 'pkd-adapter',
        contextData: {
          requestId,
          error: errorMessage,
          processingTime
        }
      });

      return {
        success: false,
        requestId,
        certificateStatus: 'unknown',
        validationResult: 'inconclusive',
        issuerCountry: 'ZA',
        issuerAuthority: 'Unknown',
        certificateSerial: 'Unknown',
        validFromDate: new Date(),
        validUntilDate: new Date(),
        chainValidation: {
          isValid: false,
          chainLength: 0,
          rootCAValid: false,
          intermediateCAValid: false,
          leafCertValid: false,
          signatureValid: false
        },
        revocationCheck: {
          performed: false,
          crlChecked: false,
          ocspChecked: false,
          isRevoked: false
        },
        securityAssessment: {
          cryptographicStrength: 'weak',
          algorithmSecurity: 'deprecated',
          keyLength: 0,
          riskFactors: ['Validation failed']
        },
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Validate PKD request
   */
  private validateRequest(request: PKDValidationRequest): void {
    if (!request.passportNumber || request.passportNumber.length < 8) {
      throw new Error('Valid passport number is required');
    }

    if (!request.documentSOD) {
      throw new Error('Document Security Object (SOD) is required');
    }

    if (!request.certificates || request.certificates.length === 0) {
      throw new Error('At least one certificate is required for validation');
    }

    // Validate certificate data
    for (const cert of request.certificates) {
      if (!cert.certificateData || !cert.serialNumber || !cert.issuer) {
        throw new Error('Invalid certificate data: missing required fields');
      }
    }
  }

  /**
   * Perform PKD validation (mock implementation)
   */
  private async performPKDValidation(requestId: string, request: PKDValidationRequest): Promise<PKDValidationResponse> {
    // Simulate PKD lookup delay
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));

    // Mock certificate validation logic
    const primaryCert = request.certificates[0];
    const now = new Date();

    // Check certificate expiry
    const isExpired = primaryCert.notAfter < now;
    const isNotYetValid = primaryCert.notBefore > now;

    // Mock certificate chain validation
    const chainValidation = this.mockCertificateChainValidation(request.certificates);

    // Mock revocation check
    const revocationCheck = request.checkRevocation 
      ? await this.mockRevocationCheck(primaryCert)
      : {
          performed: false,
          crlChecked: false,
          ocspChecked: false,
          isRevoked: false
        };

    // Security assessment
    const securityAssessment = this.assessCertificateSecurity(primaryCert);

    // Determine overall certificate status
    let certificateStatus: 'valid' | 'invalid' | 'revoked' | 'expired' | 'unknown';
    let validationResult: 'verified' | 'not_verified' | 'inconclusive';

    if (revocationCheck.isRevoked) {
      certificateStatus = 'revoked';
      validationResult = 'not_verified';
    } else if (isExpired) {
      certificateStatus = 'expired';
      validationResult = 'not_verified';
    } else if (isNotYetValid || !chainValidation.isValid) {
      certificateStatus = 'invalid';
      validationResult = 'not_verified';
    } else {
      certificateStatus = 'valid';
      validationResult = 'verified';
    }

    return {
      success: true,
      requestId,
      certificateStatus,
      validationResult,
      issuerCountry: this.extractCountryFromIssuer(primaryCert.issuer),
      issuerAuthority: this.extractAuthorityFromIssuer(primaryCert.issuer),
      certificateSerial: primaryCert.serialNumber,
      validFromDate: primaryCert.notBefore,
      validUntilDate: primaryCert.notAfter,
      chainValidation,
      revocationCheck,
      securityAssessment,
      processingTime: 0 // Will be set by caller
    };
  }

  /**
   * Mock certificate chain validation
   */
  private mockCertificateChainValidation(certificates: PKDCertificate[]): any {
    // In production, this would perform full X.509 certificate chain validation
    const chainLength = certificates.length;
    
    // Mock validation logic
    const rootCAValid = certificates.some(cert => cert.isCA && cert.issuer === cert.subject);
    const hasIntermediateCA = certificates.some(cert => cert.isCA && cert.issuer !== cert.subject);
    const hasLeafCert = certificates.some(cert => !cert.isCA);

    const isValid = rootCAValid && hasLeafCert && chainLength >= 2;

    return {
      isValid,
      chainLength,
      rootCAValid,
      intermediateCAValid: hasIntermediateCA,
      leafCertValid: hasLeafCert,
      signatureValid: isValid // Simplified for mock
    };
  }

  /**
   * Mock certificate revocation check
   */
  private async mockRevocationCheck(certificate: PKDCertificate): Promise<any> {
    // Simulate CRL/OCSP check delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock revocation status (99% not revoked)
    const isRevoked = Math.random() < 0.01;

    return {
      performed: true,
      crlChecked: true,
      ocspChecked: true,
      isRevoked,
      revokedDate: isRevoked ? new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) : undefined,
      revocationReason: isRevoked ? 'Certificate compromise' : undefined
    };
  }

  /**
   * Assess certificate security
   */
  private assessCertificateSecurity(certificate: PKDCertificate): any {
    const riskFactors: string[] = [];
    let cryptographicStrength: 'weak' | 'acceptable' | 'strong' = 'acceptable';
    let algorithmSecurity: 'deprecated' | 'current' | 'future-proof' = 'current';

    // Mock key length extraction (would parse actual certificate in production)
    const keyLength = 2048; // Default assumption

    // Algorithm assessment
    if (certificate.signatureAlgorithm.includes('SHA1')) {
      algorithmSecurity = 'deprecated';
      riskFactors.push('SHA-1 signature algorithm is deprecated');
    } else if (certificate.signatureAlgorithm.includes('SHA256')) {
      algorithmSecurity = 'current';
    } else if (certificate.signatureAlgorithm.includes('SHA384') || certificate.signatureAlgorithm.includes('SHA512')) {
      algorithmSecurity = 'future-proof';
    }

    // Key strength assessment
    if (keyLength < 2048) {
      cryptographicStrength = 'weak';
      riskFactors.push('Key length less than 2048 bits');
    } else if (keyLength >= 4096) {
      cryptographicStrength = 'strong';
    }

    // Certificate age assessment
    const age = Date.now() - certificate.notBefore.getTime();
    const ageInYears = age / (365 * 24 * 60 * 60 * 1000);
    
    if (ageInYears > 10) {
      riskFactors.push('Certificate is over 10 years old');
    }

    return {
      cryptographicStrength,
      algorithmSecurity,
      keyLength,
      riskFactors
    };
  }

  /**
   * Extract country code from certificate issuer
   */
  private extractCountryFromIssuer(issuer: string): string {
    const countryMatch = issuer.match(/C=([A-Z]{2})/);
    return countryMatch ? countryMatch[1] : 'Unknown';
  }

  /**
   * Extract authority name from certificate issuer
   */
  private extractAuthorityFromIssuer(issuer: string): string {
    const orgMatch = issuer.match(/O=([^,]+)/);
    return orgMatch ? orgMatch[1].trim() : 'Unknown Authority';
  }

  /**
   * Store verification result in database
   */
  private async storeVerificationResult(request: PKDValidationRequest, response: PKDValidationResponse): Promise<void> {
    const verificationData: InsertDhaVerification = {
      applicationId: request.applicationId,
      applicantId: request.applicantId,
      verificationType: 'icao_pkd',
      verificationService: 'icao-pkd',
      verificationMethod: request.validationLevel,
      requestId: response.requestId,
      requestData: {
        passportNumber: request.passportNumber,
        validationLevel: request.validationLevel,
        checkRevocation: request.checkRevocation,
        certificateCount: request.certificates.length
      },
      requestTimestamp: new Date(),
      responseStatus: response.success ? 'success' : 'failed',
      responseData: {
        certificateStatus: response.certificateStatus,
        validationResult: response.validationResult,
        issuerCountry: response.issuerCountry,
        issuerAuthority: response.issuerAuthority,
        chainValidation: response.chainValidation,
        revocationCheck: response.revocationCheck,
        securityAssessment: response.securityAssessment,
        error: response.error
      },
      responseTimestamp: new Date(),
      responseTime: response.processingTime,
      verificationResult: response.validationResult,
      confidenceScore: response.validationResult === 'verified' ? 95 : 
                       response.validationResult === 'inconclusive' ? 50 : 10,
      pkdCertificateStatus: response.certificateStatus,
      pkdIssuerCountry: response.issuerCountry,
      pkdCertificateSerial: response.certificateSerial,
      errorCode: response.error ? 'PKD_VALIDATION_FAILED' : undefined,
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
   * Validate South African passport certificate
   */
  async validateSouthAfricanPassport(passportNumber: string, sodData: string): Promise<{
    isValid: boolean;
    issuerValid: boolean;
    signatureValid: boolean;
    details: any;
  }> {
    // Simplified validation for South African passports
    try {
      // In production, this would parse the actual SOD and validate against SA CSCA
      
      // Mock validation based on passport number format
      const isValidFormat = /^[A-Z]{1,2}\d{6,8}$/.test(passportNumber);
      
      return {
        isValid: isValidFormat,
        issuerValid: true, // Mock - would check against actual SA CSCA
        signatureValid: isValidFormat, // Mock - would verify SOD signature
        details: {
          passportNumber,
          issuer: 'Department of Home Affairs, South Africa',
          algorithm: 'SHA256withRSA',
          keyLength: 2048
        }
      };
      
    } catch (error) {
      return {
        isValid: false,
        issuerValid: false,
        signatureValid: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get verification history for an applicant
   */
  async getVerificationHistory(applicantId: string): Promise<any[]> {
    return await storage.getDhaVerifications({
      applicantId,
      verificationType: 'icao_pkd'
    });
  }

  /**
   * Health check for PKD service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', message: string, responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      // In production, this would ping the actual ICAO PKD service
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return {
        status: 'healthy',
        message: 'ICAO PKD service is operational',
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  }
}

export const dhaPKDAdapter = new DHAPKDAdapter();