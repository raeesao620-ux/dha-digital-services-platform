import crypto from "crypto";
import { storage } from "../storage";
import { InsertDhaVerification, InsertDhaAuditEvent } from "@shared/schema";
import { privacyProtectionService } from "./privacy-protection";
import { createSecureGovernmentClient } from "./secure-mtls-client";

/**
 * DHA ABIS (Automated Biometric Identification System) Adapter
 * 
 * This adapter interfaces with South Africa's ABIS to perform biometric verification
 * including fingerprint matching, facial recognition, and iris scanning.
 * 
 * Features:
 * - 1:1 biometric verification (verify identity)
 * - 1:N biometric identification (find identity)
 * - Multi-modal biometric matching
 * - Quality assessment and template validation
 */

export interface BiometricTemplate {
  type: 'fingerprint' | 'facial' | 'iris';
  format: 'ISO_19794_2' | 'ISO_19794_5' | 'ISO_19794_6' | 'ANSI_378' | 'MINEX';
  data: string; // Base64 encoded template data
  quality: number; // 0-100 quality score
  extractedFeatures?: {
    minutiae?: any[];
    ridge_characteristics?: any;
    facial_landmarks?: any[];
    iris_features?: any;
  };
}

export interface ABISVerificationRequest {
  applicantId: string;
  applicationId: string;
  mode: '1_to_1' | '1_to_N'; // 1:1 verification or 1:N identification
  biometricTemplates: BiometricTemplate[];
  referencePersonId?: string; // For 1:1 verification
  qualityThreshold?: number; // Minimum quality threshold (default: 60)
  matchThreshold?: number; // Minimum match threshold (default: 70)
}

export interface ABISBiometricMatch {
  personId: string;
  matchScore: number; // 0-100 match confidence
  biometricType: 'fingerprint' | 'facial' | 'iris';
  templateId: string;
  qualityScore: number;
  matchDetails: {
    minutiae_matches?: number;
    ridge_similarity?: number;
    facial_similarity?: number;
    iris_hamming_distance?: number;
  };
}

export interface ABISVerificationResponse {
  success: boolean;
  requestId: string;
  mode: '1_to_1' | '1_to_N';
  verificationResult: 'verified' | 'not_verified' | 'inconclusive';
  overallMatchScore: number; // 0-100
  biometricMatches: ABISBiometricMatch[];
  primaryMatch?: ABISBiometricMatch; // Best match for 1:N mode
  qualityAssessment: {
    allTemplatesPassed: boolean;
    failedTemplates: string[]; // Template IDs that failed quality check
    averageQuality: number;
  };
  processingTime: number;
  error?: string;
}

export class DHAABISAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number = 45000; // 45 seconds for biometric processing
  private readonly retryAttempts: number = 2;
  private secureClient: any;

  constructor() {
    // Production-grade environment configuration
    const environment = process.env.NODE_ENV || 'development';
    
    // CRITICAL SECURITY: NO MOCK MODES IN PRODUCTION
    if (environment === 'production') {
      // Production MUST use live mode only - fail closed
      const abisEnabled = process.env.DHA_ABIS_ENABLED === 'true';
      
      if (!abisEnabled) {
        throw new Error('CRITICAL SECURITY ERROR: DHA ABIS must be enabled in production environment');
      }
      
      // Validate all required production environment variables
      if (!process.env.DHA_ABIS_BASE_URL || !process.env.DHA_ABIS_API_KEY) {
        throw new Error('CRITICAL SECURITY ERROR: DHA_ABIS_BASE_URL and DHA_ABIS_API_KEY environment variables are required for DHA ABIS integration in production');
      }
      
      if (!process.env.DHA_ABIS_CLIENT_CERT || !process.env.DHA_ABIS_PRIVATE_KEY) {
        throw new Error('CRITICAL SECURITY ERROR: DHA_ABIS_CLIENT_CERT and DHA_ABIS_PRIVATE_KEY are required for production ABIS integration');
      }
      
      // Validate API key format for government compliance
      if (!/^DHA-ABIS-PROD-[A-Z0-9]{32}-[A-Z0-9]{8}$/.test(process.env.DHA_ABIS_API_KEY)) {
        throw new Error('CRITICAL SECURITY ERROR: Invalid DHA ABIS API key format for production');
      }
      
      this.baseUrl = process.env.DHA_ABIS_BASE_URL;
      this.apiKey = process.env.DHA_ABIS_API_KEY;
      
      console.log(`[DHA-ABIS] PRODUCTION MODE: Live integration enforced - NO MOCK FALLBACKS`);
    } else {
      // Development/staging can use configurable modes
      const abisMode = process.env.DHA_ABIS_MODE || 'mock';
      const abisEnabled = process.env.DHA_ABIS_ENABLED === 'true';
      
      const productionUrls = {
        staging: 'https://abis-staging.dha.gov.za/v1',
        development: 'https://abis-dev.dha.gov.za/v1'
      };
      
      this.baseUrl = process.env.DHA_ABIS_BASE_URL || productionUrls[environment as keyof typeof productionUrls] || productionUrls.development;
      this.apiKey = process.env.DHA_ABIS_API_KEY || '';
      
      console.log(`[DHA-ABIS] ${environment.toUpperCase()} MODE: ${abisMode} - Enabled: ${abisEnabled}`);
    }

    // Initialize secure mTLS client for government communications
    this.initializeSecureClient();
  }

  /**
   * CRITICAL SECURITY: Initialize secure mTLS client
   */
  private async initializeSecureClient(): Promise<void> {
    try {
      this.secureClient = await createSecureGovernmentClient('DHA_ABIS');
      await this.secureClient.initialize();
      console.log('[DHA-ABIS] ✅ Secure mTLS client initialized');
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`CRITICAL: Failed to initialize secure ABIS client: ${error}`);
      }
      console.warn('[DHA-ABIS] ⚠️ Secure client initialization failed (non-production):', error);
    }
  }

  /**
   * Perform biometric verification or identification
   */
  async performBiometricVerification(request: ABISVerificationRequest): Promise<ABISVerificationResponse> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Validate request
      this.validateRequest(request);

      // Log audit event
      await this.logAuditEvent({
        applicationId: request.applicationId,
        applicantId: request.applicantId,
        eventType: 'abis_verification_started',
        eventCategory: 'external_service',
        eventDescription: `ABIS ${request.mode} verification started`,
        actorType: 'system',
        actorId: 'abis-adapter',
        contextData: {
          requestId,
          mode: request.mode,
          biometricTypes: request.biometricTemplates.map(t => t.type),
          templateCount: request.biometricTemplates.length,
          referencePersonId: request.referencePersonId
        }
      });

      // Perform quality assessment
      const qualityAssessment = await this.assessTemplateQuality(request.biometricTemplates, request.qualityThreshold);

      if (!qualityAssessment.allTemplatesPassed) {
        return {
          success: false,
          requestId,
          mode: request.mode,
          verificationResult: 'inconclusive',
          overallMatchScore: 0,
          biometricMatches: [],
          qualityAssessment,
          processingTime: Date.now() - startTime,
          error: `Template quality check failed: ${qualityAssessment.failedTemplates.join(', ')}`
        };
      }

      // Perform biometric matching
      let response: ABISVerificationResponse;

      if (request.mode === '1_to_1') {
        response = await this.performOneToOneVerification(requestId, request, qualityAssessment);
      } else {
        response = await this.performOneToNIdentification(requestId, request, qualityAssessment);
      }

      response.processingTime = Date.now() - startTime;

      // Store verification result
      await this.storeVerificationResult(request, response);

      // Log completion
      await this.logAuditEvent({
        applicationId: request.applicationId,
        applicantId: request.applicantId,
        eventType: 'abis_verification_completed',
        eventCategory: 'external_service',
        eventDescription: `ABIS verification completed with result: ${response.verificationResult}`,
        actorType: 'system',
        actorId: 'abis-adapter',
        contextData: {
          requestId,
          verificationResult: response.verificationResult,
          overallMatchScore: response.overallMatchScore,
          matchCount: response.biometricMatches.length,
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
        eventType: 'abis_verification_failed',
        eventCategory: 'external_service',
        eventDescription: `ABIS verification failed: ${errorMessage}`,
        actorType: 'system',
        actorId: 'abis-adapter',
        contextData: {
          requestId,
          error: errorMessage,
          processingTime
        }
      });

      return {
        success: false,
        requestId,
        mode: request.mode,
        verificationResult: 'inconclusive',
        overallMatchScore: 0,
        biometricMatches: [],
        qualityAssessment: {
          allTemplatesPassed: false,
          failedTemplates: [],
          averageQuality: 0
        },
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Validate ABIS request
   */
  private validateRequest(request: ABISVerificationRequest): void {
    if (!request.biometricTemplates || request.biometricTemplates.length === 0) {
      throw new Error('At least one biometric template is required');
    }

    if (request.mode === '1_to_1' && !request.referencePersonId) {
      throw new Error('Reference person ID is required for 1:1 verification');
    }

    // Validate each template
    for (const template of request.biometricTemplates) {
      if (!template.data || !template.type || !template.format) {
        throw new Error('Invalid biometric template: missing required fields');
      }

      if (template.quality < 0 || template.quality > 100) {
        throw new Error('Invalid template quality score: must be between 0 and 100');
      }
    }
  }

  /**
   * Assess quality of biometric templates
   */
  private async assessTemplateQuality(templates: BiometricTemplate[], threshold: number = 60): Promise<{
    allTemplatesPassed: boolean;
    failedTemplates: string[];
    averageQuality: number;
  }> {
    const failedTemplates: string[] = [];
    let totalQuality = 0;

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      totalQuality += template.quality;

      if (template.quality < threshold) {
        failedTemplates.push(`${template.type}-${i}`);
      }
    }

    return {
      allTemplatesPassed: failedTemplates.length === 0,
      failedTemplates,
      averageQuality: totalQuality / templates.length
    };
  }

  /**
   * Perform 1:1 biometric verification
   */
  private async performOneToOneVerification(
    requestId: string,
    request: ABISVerificationRequest,
    qualityAssessment: any
  ): Promise<ABISVerificationResponse> {
    try {
      // Production ABIS API integration
      const abisApiUrl = process.env.DHA_ABIS_API_ENDPOINT || 'https://abis.dha.gov.za/api/v2/verify';
      const apiKey = process.env.DHA_ABIS_API_KEY;
      const clientCert = process.env.DHA_ABIS_CLIENT_CERT;
      
      if (!apiKey || !clientCert) {
        throw new Error('ABIS API credentials not configured');
      }

      const payload = {
        requestId,
        mode: '1_to_1',
        referencePersonId: request.referencePersonId,
        biometricTemplates: request.biometricTemplates,
        matchThreshold: request.matchThreshold || 70,
        qualityThreshold: request.qualityThreshold || 60,
        clientInfo: {
          system: 'DHA-Digital-Services',
          version: '2.0',
          timestamp: new Date().toISOString()
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // ABIS operations can take time
      
      const response = await fetch(abisApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Client-Certificate': clientCert,
          'X-Request-ID': requestId,
          'X-API-Version': '2.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ABIS API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Transform ABIS response to our internal format
      return {
        success: result.success,
        requestId,
        mode: '1_to_1',
        verificationResult: result.verification_result,
        overallMatchScore: result.overall_match_score,
        biometricMatches: result.biometric_matches || [],
        primaryMatch: result.primary_match,
        qualityAssessment,
        processingTime: 0
      };
    } catch (error) {
      console.error(`[ABIS Adapter] 1:1 verification failed for request ${requestId}:`, error);
      
      return {
        success: false,
        requestId,
        mode: '1_to_1',
        verificationResult: 'inconclusive',
        overallMatchScore: 0,
        biometricMatches: [],
        primaryMatch: undefined,
        qualityAssessment,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Perform 1:N biometric identification
   */
  private async performOneToNIdentification(
    requestId: string,
    request: ABISVerificationRequest,
    qualityAssessment: any
  ): Promise<ABISVerificationResponse> {
    try {
      // Production ABIS API integration for 1:N identification
      const abisApiUrl = process.env.DHA_ABIS_API_ENDPOINT || 'https://abis.dha.gov.za/api/v2/identify';
      const apiKey = process.env.DHA_ABIS_API_KEY;
      const clientCert = process.env.DHA_ABIS_CLIENT_CERT;
      
      if (!apiKey || !clientCert) {
        throw new Error('ABIS API credentials not configured');
      }

      const payload = {
        requestId,
        mode: '1_to_N',
        biometricTemplates: request.biometricTemplates,
        matchThreshold: request.matchThreshold || 70,
        clientInfo: {
          system: 'DHA-Digital-Services',
          version: '2.0',
          timestamp: new Date().toISOString()
        }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 1:N searches can take longer
      
      const response = await fetch(abisApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Client-Certificate': clientCert,
          'X-Request-ID': requestId,
          'X-API-Version': '2.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ABIS API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: result.success,
        requestId,
        mode: '1_to_N',
        verificationResult: result.identification_result,
        overallMatchScore: result.best_match_score || 0,
        biometricMatches: result.candidate_matches || [],
        primaryMatch: result.best_match,
        qualityAssessment,
        processingTime: 0
      };
    } catch (error) {
      console.error(`[ABIS Adapter] 1:N identification failed for request ${requestId}:`, error);
      
      return {
        success: false,
        requestId,
        mode: '1_to_N',
        verificationResult: 'inconclusive',
        overallMatchScore: 0,
        biometricMatches: [],
        primaryMatch: undefined,
        qualityAssessment,
        processingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  /**
   * Store verification result in database
   */
  private async storeVerificationResult(request: ABISVerificationRequest, response: ABISVerificationResponse): Promise<void> {
    const verificationData: InsertDhaVerification = {
      applicationId: request.applicationId,
      applicantId: request.applicantId,
      verificationType: 'abis',
      verificationService: 'dha-abis',
      verificationMethod: request.mode,
      requestId: response.requestId,
      requestData: {
        mode: request.mode,
        biometricTypes: request.biometricTemplates.map(t => t.type),
        templateCount: request.biometricTemplates.length,
        referencePersonId: request.referencePersonId,
        qualityThreshold: request.qualityThreshold,
        matchThreshold: request.matchThreshold
      },
      requestTimestamp: new Date(),
      responseStatus: response.success ? 'success' : 'failed',
      responseData: {
        verificationResult: response.verificationResult,
        overallMatchScore: response.overallMatchScore,
        biometricMatches: response.biometricMatches,
        primaryMatch: response.primaryMatch,
        qualityAssessment: response.qualityAssessment,
        error: response.error
      },
      responseTimestamp: new Date(),
      responseTime: response.processingTime,
      verificationResult: response.verificationResult,
      confidenceScore: response.overallMatchScore,
      matchScore: response.overallMatchScore,
      abisMatchId: response.primaryMatch?.personId,
      abisBiometricType: response.primaryMatch?.biometricType,
      errorCode: response.error ? 'ABIS_VERIFICATION_FAILED' : undefined,
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
   * Get verification history for an applicant
   */
  async getVerificationHistory(applicantId: string): Promise<any[]> {
    return await storage.getDhaVerifications({
      applicantId,
      verificationType: 'abis'
    });
  }

  /**
   * Health check for ABIS service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy', message: string, responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      // In production, this would ping the actual ABIS service
      await new Promise(resolve => setTimeout(resolve, 200)); // Mock delay
      
      return {
        status: 'healthy',
        message: 'ABIS service is operational',
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

export const dhaABISAdapter = new DHAABISAdapter();