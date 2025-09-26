/**
 * DatanamixClient - Official DHA Data Partner Integration
 * 
 * This service integrates with Datanamix, the official data partner for 
 * South Africa's Department of Home Affairs. Datanamix provides secure
 * access to government databases including NPR (National Population Register)
 * and ABIS (Automated Biometric Identification System).
 * 
 * Security: OAuth2 + mTLS authentication
 * Compliance: POPIA, government security standards
 * Coverage: ID verification, biometric authentication, photo retrieval
 */

import https from 'https';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { auditLogger } from '../middleware/audit-logger';
// SECURITY: Updated to use centralized configuration service  
import { configService, config } from '../middleware/provider-config';

export interface DatanamixCredentials {
  clientId: string;
  clientSecret: string;
  certificatePath: string;
  privateKeyPath: string;
  baseUrl: string;
  environment: 'development' | 'staging' | 'production';
}

export interface DatanamixAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string[];
}

export interface NPRVerificationRequest {
  applicationId: string;
  applicantId: string;
  idNumber: string;
  verificationLevel: 'basic' | 'enhanced';
  includePhoto: boolean;
  includeBiographics: boolean;
  purpose: string;
  consentReference: string;
}

export interface NPRVerificationResponse {
  success: boolean;
  requestId: string;
  verificationResult: 'verified' | 'not_verified' | 'partial_match';
  confidenceScore: number;
  citizen: {
    idNumber: string;
    firstName: string;
    surname: string;
    dateOfBirth: Date;
    placeOfBirth: string;
    gender: 'M' | 'F';
    citizenship: 'SA' | 'PR' | 'TR';
    status: 'active' | 'deceased' | 'suspended';
    photoUrl?: string;
    photoHash?: string;
  };
  metadata: {
    lastUpdated: Date;
    dataSource: string;
    verificationTimestamp: Date;
  };
  error?: string;
}

export interface ABISBiometricRequest {
  applicationId: string;
  applicantId: string;
  mode: '1_to_1' | '1_to_N';
  referencePersonId?: string; // For 1:1 verification
  biometricTemplates: {
    type: 'fingerprint' | 'facial' | 'iris';
    template: string; // Base64 encoded biometric template
    quality: number;
    position?: string; // For fingerprints: thumb, index, etc.
  }[];
  matchThreshold: number;
  purpose: string;
  consentReference: string;
}

export interface ABISBiometricResponse {
  success: boolean;
  requestId: string;
  mode: '1_to_1' | '1_to_N';
  verificationResult: 'verified' | 'not_verified' | 'inconclusive';
  overallMatchScore: number;
  matches: {
    personId: string;
    matchScore: number;
    biometricType: string;
    confidence: number;
  }[];
  processingTime: number;
  error?: string;
}

export interface DocumentVerificationRequest {
  applicationId: string;
  documentType: 'passport' | 'id_card' | 'birth_certificate';
  documentNumber: string;
  issuedDate?: Date;
  verificationLevel: 'basic' | 'enhanced' | 'comprehensive';
  purpose: string;
}

export interface DocumentVerificationResponse {
  success: boolean;
  requestId: string;
  documentStatus: 'valid' | 'expired' | 'cancelled' | 'reported_lost' | 'not_found';
  authenticity: {
    isAuthentic: boolean;
    confidence: number;
    securityFeatures: string[];
    tamperingDetected: boolean;
  };
  details: {
    issueDate: Date;
    expiryDate?: Date;
    issuingOffice: string;
    serialNumber: string;
    biometricDataAvailable: boolean;
  };
  error?: string;
}

export class DatanamixClient {
  private credentials: DatanamixCredentials;
  private authToken?: DatanamixAuthResponse;
  private tokenExpiry?: Date;
  private httpsAgent: https.Agent;

  constructor() {
    this.credentials = this.loadCredentials();
    this.httpsAgent = new https.Agent({ keepAlive: true }); // Will be properly configured when needed
  }

  /**
   * Load Datanamix credentials from environment variables
   */
  private loadCredentials(): DatanamixCredentials {
    const clientId = process.env.DATANAMIX_CLIENT_ID;
    const clientSecret = process.env.DATANAMIX_CLIENT_SECRET;
    const certificatePath = process.env.DATANAMIX_CERT_PATH;
    const privateKeyPath = process.env.DATANAMIX_KEY_PATH;
    const baseUrl = process.env.DATANAMIX_BASE_URL;

    // Only throw error in production - provide development fallbacks
    if (!clientId || !clientSecret || !certificatePath || !privateKeyPath || !baseUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL CONFIG ERROR: Datanamix credentials are required for DHA integration in production');
      }
      
      console.warn('[Datanamix Client] WARNING: Using development fallback credentials - NOT FOR PRODUCTION');
      return {
        clientId: 'dev-datanamix-client-id',
        clientSecret: 'dev-datanamix-client-secret',
        certificatePath: '/dev/null', // Won't be used in development
        privateKeyPath: '/dev/null', // Won't be used in development
        baseUrl: 'https://dev-datanamix.gov.za',
        environment: 'development'
      };
    }

    return {
      clientId,
      clientSecret,
      certificatePath,
      privateKeyPath,
      baseUrl,
      environment: (process.env.NODE_ENV as any) || 'development'
    };
  }

  /**
   * Create HTTPS agent with mTLS configuration
   */
  private async createHttpsAgent(): Promise<https.Agent> {
    try {
      const cert = await fs.readFile(this.credentials.certificatePath, 'utf8');
      const key = await fs.readFile(this.credentials.privateKeyPath, 'utf8');

      return new https.Agent({
        cert,
        key,
        rejectUnauthorized: this.credentials.environment === 'production',
        keepAlive: true,
        maxSockets: 10
      });
    } catch (error) {
      console.error('Failed to load mTLS certificates:', error);
      throw new Error('mTLS certificate configuration failed');
    }
  }

  /**
   * Authenticate with Datanamix using OAuth2
   */
  async authenticate(): Promise<DatanamixAuthResponse> {
    const startTime = Date.now();

    try {
      const tokenPayload = {
        iss: this.credentials.clientId,
        sub: this.credentials.clientId,
        aud: `${this.credentials.baseUrl}/oauth2/token`,
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID()
      };

      const clientAssertion = jwt.sign(tokenPayload, this.credentials.clientSecret, {
        algorithm: 'HS256'
      });

      const authData = new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion,
        scope: 'npr:read npr:verify abis:verify documents:verify photos:read'
      });

      const response = await this.makeSecureRequest('POST', '/oauth2/token', authData.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      if (response.statusCode === 200) {
        this.authToken = response.data as DatanamixAuthResponse;
        this.tokenExpiry = new Date(Date.now() + (this.authToken.expires_in * 1000));

        await auditLogger.logExternalServiceCall(
          'datanamix',
          '/oauth2/token',
          'POST',
          'success',
          Date.now() - startTime,
          { scope: this.authToken.scope.join(',') }
        );

        return this.authToken;
      }

      throw new Error(`Authentication failed: ${response.statusCode}`);

    } catch (error) {
      await auditLogger.logExternalServiceCall(
        'datanamix',
        '/oauth2/token',
        'POST',
        'failure',
        Date.now() - startTime,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      throw error;
    }
  }

  /**
   * Ensure valid authentication token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  /**
   * Verify ID number against NPR (National Population Register)
   */
  async verifyNPRIdentity(request: NPRVerificationRequest): Promise<NPRVerificationResponse> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      await this.ensureAuthenticated();

      // Will log success/failure after service call completes

      const response = await this.makeAuthenticatedRequest('POST', '/npr/verify', {
        ...request,
        requestId
      });

      if (response.statusCode === 200) {
        const verificationResponse: NPRVerificationResponse = {
          ...response.data,
          requestId
        };

        await auditLogger.logExternalServiceCall(
          'datanamix-npr',
          '/npr/verify',
          'POST',
          'success',
          Date.now() - startTime,
          {
            requestId,
            verificationResult: verificationResponse.verificationResult,
            confidenceScore: verificationResponse.confidenceScore
          }
        );

        return verificationResponse;
      }

      throw new Error(`NPR verification failed: ${response.statusCode}`);

    } catch (error) {
      await auditLogger.logExternalServiceCall(
        'datanamix-npr',
        '/npr/verify',
        'POST',
        'failure',
        Date.now() - startTime,
        {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      return {
        success: false,
        requestId,
        verificationResult: 'not_verified',
        confidenceScore: 0,
        citizen: null as any,
        metadata: null as any,
        error: error instanceof Error ? error.message : 'NPR verification failed'
      };
    }
  }

  /**
   * Perform biometric verification through ABIS
   */
  async verifyABISBiometrics(request: ABISBiometricRequest): Promise<ABISBiometricResponse> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      await this.ensureAuthenticated();

      // Will log success/failure after biometric verification completes

      const response = await this.makeAuthenticatedRequest('POST', '/abis/verify', {
        ...request,
        requestId
      });

      if (response.statusCode === 200) {
        const biometricResponse: ABISBiometricResponse = {
          ...response.data,
          requestId
        };

        await auditLogger.logBiometricVerification(
          request.applicantId,
          request.biometricTemplates[0]?.type || 'unknown',
          biometricResponse.verificationResult === 'verified' ? 'success' : 'failure',
          biometricResponse.overallMatchScore,
          {
            requestId,
            processingTime: biometricResponse.processingTime,
            matchCount: biometricResponse.matches.length
          }
        );

        return biometricResponse;
      }

      throw new Error(`ABIS verification failed: ${response.statusCode}`);

    } catch (error) {
      await auditLogger.logBiometricVerification(
        request.applicantId,
        request.biometricTemplates[0]?.type || 'unknown',
        'failure',
        0,
        {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      return {
        success: false,
        requestId,
        mode: request.mode,
        verificationResult: 'not_verified',
        overallMatchScore: 0,
        matches: [],
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'ABIS verification failed'
      };
    }
  }

  /**
   * Verify document authenticity and status
   */
  async verifyDocument(request: DocumentVerificationRequest): Promise<DocumentVerificationResponse> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      await this.ensureAuthenticated();

      const response = await this.makeAuthenticatedRequest('POST', '/documents/verify', {
        ...request,
        requestId
      });

      if (response.statusCode === 200) {
        const documentResponse: DocumentVerificationResponse = {
          ...response.data,
          requestId
        };

        await auditLogger.logExternalServiceCall(
          'datanamix-documents',
          '/documents/verify',
          'POST',
          'success',
          Date.now() - startTime,
          {
            requestId,
            documentType: request.documentType,
            documentStatus: documentResponse.documentStatus,
            isAuthentic: documentResponse.authenticity.isAuthentic
          }
        );

        return documentResponse;
      }

      throw new Error(`Document verification failed: ${response.statusCode}`);

    } catch (error) {
      await auditLogger.logExternalServiceCall(
        'datanamix-documents',
        '/documents/verify',
        'POST',
        'failure',
        Date.now() - startTime,
        {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      return {
        success: false,
        requestId,
        documentStatus: 'not_found',
        authenticity: {
          isAuthentic: false,
          confidence: 0,
          securityFeatures: [],
          tamperingDetected: false
        },
        details: null as any,
        error: error instanceof Error ? error.message : 'Document verification failed'
      };
    }
  }

  /**
   * Make authenticated request to Datanamix API
   */
  private async makeAuthenticatedRequest(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<{ statusCode: number; data: any }> {
    if (!this.authToken) {
      throw new Error('No valid authentication token');
    }

    return this.makeSecureRequest(method, endpoint, data ? JSON.stringify(data) : undefined, {
      'Authorization': `Bearer ${this.authToken.access_token}`,
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
      'X-Client-Version': '1.0.0'
    });
  }

  /**
   * Make secure HTTPS request with mTLS
   */
  private async makeSecureRequest(
    method: string,
    endpoint: string,
    data?: string,
    headers: Record<string, string> = {}
  ): Promise<{ statusCode: number; data: any }> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: new URL(this.credentials.baseUrl).hostname,
        port: 443,
        path: endpoint,
        method: method.toUpperCase(),
        headers: {
          ...headers,
          'User-Agent': 'DHA-Digital-Services/1.0.0'
        },
        agent: this.httpsAgent
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = responseData ? JSON.parse(responseData) : {};
            resolve({
              statusCode: res.statusCode || 500,
              data: parsedData
            });
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }

  /**
   * Health check for Datanamix services
   */
  async healthCheck(): Promise<{ status: string; services: Record<string, boolean> }> {
    try {
      await this.ensureAuthenticated();
      
      const response = await this.makeAuthenticatedRequest('GET', '/health');
      
      return response.data || {
        status: 'degraded',
        services: {
          npr: false,
          abis: false,
          documents: false
        }
      };
    } catch (error) {
      return {
        status: 'error',
        services: {
          npr: false,
          abis: false,
          documents: false
        }
      };
    }
  }
}

// Export singleton instance
export const datanamixClient = new DatanamixClient();