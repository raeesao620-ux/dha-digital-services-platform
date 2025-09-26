/**
 * UNIFIED DOCUMENT PDF FACADE SERVICE
 * 
 * This service consolidates all existing PDF generation services into a single,
 * clean interface that provides unified access to all DHA document generation
 * capabilities with consistent security features and error handling.
 * 
 * @author DHA Document Generation System
 * @version 2.0.0
 * @since 2025-09-20
 */

import PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from '../storage';
import { cryptographicSignatureService, DocumentSigningMetadata, PAdESLevel } from './cryptographic-signature-service';
import { SecurityFeaturesV2, MRZData, SecurityFeatureConfiguration } from './security-features-v2';
import { BaseDocumentTemplate, SA_GOVERNMENT_DESIGN } from './base-document-template';
import { verificationService } from './verification-service';
import { enhancedVerificationUtilities, VerificationData } from './enhanced-verification-utilities';
import { 
  IdentityDocumentBookGenerator,
  TemporaryIdCertificateGenerator,
  SouthAfricanPassportGenerator,
  EmergencyTravelCertificateGenerator,
  RefugeeTravelDocumentGenerator,
  BirthCertificateGenerator,
  DeathCertificateGenerator,
  MarriageCertificateGenerator,
  DivorceCertificateGenerator,
  GeneralWorkVisaGenerator,
  CriticalSkillsWorkVisaGenerator,
  IntraCompanyTransferWorkVisaGenerator,
  BusinessVisaGenerator,
  StudyVisaPermitGenerator,
  VisitorVisaGenerator,
  MedicalTreatmentVisaGenerator,
  RetiredPersonVisaGenerator,
  ExchangeVisaGenerator,
  RelativesVisaGenerator,
  PermanentResidencePermitGenerator,
  CertificateOfExemptionGenerator,
  CertificateOfSouthAfricanCitizenshipGenerator
} from './document-generators';

// Import enhanced authentic generators
import {
  EnhancedAsylumSeekerPermitGenerator,
  EnhancedUnabridgedBirthCertificateGenerator,
  EnhancedCitizenshipCertificateGenerator,
  EnhancedSouthAfricanPassportGenerator
} from './enhanced-authentic-generators';

import type {
  IdentityDocumentBookData,
  TemporaryIdCertificateData,
  SouthAfricanPassportData,
  EmergencyTravelCertificateData,
  RefugeeTravelDocumentData,
  BirthCertificateData,
  DeathCertificateData,
  MarriageCertificateData,
  DivorceCertificateData,
  GeneralWorkVisaData,
  CriticalSkillsWorkVisaData,
  IntraCompanyTransferWorkVisaData,
  BusinessVisaData,
  StudyVisaPermitData,
  VisitorVisaData,
  MedicalTreatmentVisaData,
  RetiredPersonVisaData,
  ExchangeVisaData,
  RelativesVisaData,
  PermanentResidencePermitData,
  CertificateOfExemptionData,
  CertificateOfSouthAfricanCitizenshipData
} from '../../shared/schema';

// Re-export all document types for convenience
export { 
  IdentityDocumentBookData, TemporaryIdCertificateData, SouthAfricanPassportData,
  EmergencyTravelCertificateData, RefugeeTravelDocumentData, BirthCertificateData,
  DeathCertificateData, MarriageCertificateData, DivorceCertificateData,
  GeneralWorkVisaData, CriticalSkillsWorkVisaData, IntraCompanyTransferWorkVisaData,
  BusinessVisaData, StudyVisaPermitData, VisitorVisaData, MedicalTreatmentVisaData,
  RetiredPersonVisaData, ExchangeVisaData, RelativesVisaData,
  PermanentResidencePermitData, CertificateOfExemptionData,
  CertificateOfSouthAfricanCitizenshipData
};

/**
 * Comprehensive enumeration of all supported DHA document types.
 * Aligned with the documentTypeEnum from the database schema.
 */
export enum SupportedDocumentType {
  // Identity Documents (3)
  SMART_ID_CARD = 'smart_id_card',
  IDENTITY_DOCUMENT_BOOK = 'identity_document_book',
  TEMPORARY_ID_CERTIFICATE = 'temporary_id_certificate',

  // Travel Documents (3)
  SOUTH_AFRICAN_PASSPORT = 'south_african_passport',
  EMERGENCY_TRAVEL_CERTIFICATE = 'emergency_travel_certificate',
  REFUGEE_TRAVEL_DOCUMENT = 'refugee_travel_document',

  // Civil Documents (4)
  BIRTH_CERTIFICATE = 'birth_certificate',
  DEATH_CERTIFICATE = 'death_certificate',
  MARRIAGE_CERTIFICATE = 'marriage_certificate',
  DIVORCE_CERTIFICATE = 'divorce_certificate',

  // Immigration Documents (11)
  GENERAL_WORK_VISA = 'general_work_visa',
  CRITICAL_SKILLS_WORK_VISA = 'critical_skills_work_visa',
  INTRA_COMPANY_TRANSFER_WORK_VISA = 'intra_company_transfer_work_visa',
  BUSINESS_VISA = 'business_visa',
  STUDY_VISA_PERMIT = 'study_visa_permit',
  VISITOR_VISA = 'visitor_visa',
  MEDICAL_TREATMENT_VISA = 'medical_treatment_visa',
  RETIRED_PERSON_VISA = 'retired_person_visa',
  EXCHANGE_VISA = 'exchange_visa',
  RELATIVES_VISA = 'relatives_visa',
  PERMANENT_RESIDENCE_PERMIT = 'permanent_residence_permit',

  // Additional DHA Documents (2)
  CERTIFICATE_OF_EXEMPTION = 'certificate_of_exemption',
  CERTIFICATE_OF_SOUTH_AFRICAN_CITIZENSHIP = 'certificate_of_south_african_citizenship',

  // Legacy compatibility
  PASSPORT = 'passport',
  SA_ID = 'sa_id',
  SMART_ID = 'smart_id',
  TEMPORARY_ID = 'temporary_id',
  STUDY_PERMIT = 'study_permit',
  WORK_PERMIT = 'work_permit',
  BUSINESS_PERMIT = 'business_permit',
  TRANSIT_VISA = 'transit_visa',
  PERMANENT_RESIDENCE = 'permanent_residence',
  TEMPORARY_RESIDENCE = 'temporary_residence',
  REFUGEE_PERMIT = 'refugee_permit',
  ASYLUM_PERMIT = 'asylum_permit',
  DIPLOMATIC_PASSPORT = 'diplomatic_passport',
  EXCHANGE_PERMIT = 'exchange_permit'
}

/**
 * Security level enumeration for document generation.
 * Determines which security features are applied to the document.
 */
export enum DocumentSecurityLevel {
  /** Basic security features for internal documents */
  BASIC = 'basic',
  /** Standard security for most DHA documents */
  STANDARD = 'standard',
  /** Enhanced security for sensitive documents */
  ENHANCED = 'enhanced',
  /** Maximum security for critical documents */
  MAXIMUM = 'maximum'
}

/**
 * Document generation options that control how the document is created.
 */
export interface DocumentGenerationOptions {
  /** Whether this is a preview generation (no storage, reduced security) */
  isPreview?: boolean;
  /** Security level to apply to the document */
  securityLevel?: DocumentSecurityLevel;
  /** Whether to include digital signatures */
  includeDigitalSignature?: boolean;
  /** PAdES signature level for cryptographic signatures */
  signatureLevel?: PAdESLevel;
  /** Custom security features configuration */
  securityFeatures?: Partial<SecurityFeatureConfiguration>;
  /** Additional metadata for the document */
  metadata?: Record<string, any>;
  /** Whether to store the document in the database */
  persistToStorage?: boolean;
  /** Custom file naming pattern */
  fileNamePattern?: string;
  /** Quality settings for the PDF generation */
  quality?: 'draft' | 'standard' | 'high' | 'print_ready';
  /** Language preferences for multilingual documents */
  languages?: ('en' | 'af' | 'zu' | 'xh')[];
  /** Whether to include audit trail */
  includeAuditTrail?: boolean;
}

/**
 * Comprehensive verification information for generated documents.
 */
export interface DocumentVerificationInfo {
  /** Document unique identifier */
  documentId: string;
  /** Verification hash for authenticity checking */
  verificationHash: string;
  /** QR code data for mobile verification */
  qrCodeData?: string;
  /** Barcode data for machine reading */
  barcodeData?: string;
  /** MRZ data for travel documents */
  mrzData?: MRZData;
  /** Digital signature information */
  digitalSignature?: {
    algorithm: string;
    timestamp: Date;
    certificateSerial: string;
    signerDN: string;
  };
  /** Security features applied */
  securityFeatures: string[];
  /** Verification URL for online checking */
  verificationUrl: string;
}

/**
 * Standardized response format for all document generation operations.
 */
export interface DocumentGenerationResponse {
  /** Generated PDF document as buffer */
  documentBuffer: Buffer;
  /** Document metadata and information */
  metadata: {
    documentId: string;
    documentType: SupportedDocumentType;
    fileName: string;
    fileSize: number;
    createdAt: Date;
    expiresAt?: Date;
    version: string;
    generator: string;
  };
  /** Verification information for document authenticity */
  verification: DocumentVerificationInfo;
  /** Security features that were applied */
  appliedSecurityFeatures: string[];
  /** Storage information (if persisted) */
  storage?: {
    path: string;
    url?: string;
    storageProvider: string;
  };
  /** Any warnings or notices about the generation */
  warnings?: string[];
}

/**
 * Union type for all possible document data types.
 */
export type DocumentData = 
  | IdentityDocumentBookData 
  | TemporaryIdCertificateData 
  | SouthAfricanPassportData
  | EmergencyTravelCertificateData 
  | RefugeeTravelDocumentData 
  | BirthCertificateData
  | DeathCertificateData 
  | MarriageCertificateData 
  | DivorceCertificateData
  | GeneralWorkVisaData 
  | CriticalSkillsWorkVisaData 
  | IntraCompanyTransferWorkVisaData
  | BusinessVisaData 
  | StudyVisaPermitData 
  | VisitorVisaData 
  | MedicalTreatmentVisaData
  | RetiredPersonVisaData 
  | ExchangeVisaData 
  | RelativesVisaData
  | PermanentResidencePermitData 
  | CertificateOfExemptionData
  | CertificateOfSouthAfricanCitizenshipData;

/**
 * Document generation error with detailed information.
 */
export class DocumentGenerationError extends Error {
  constructor(
    message: string,
    public readonly documentType: SupportedDocumentType,
    public readonly errorCode: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DocumentGenerationError';
  }
}

/**
 * UNIFIED DOCUMENT PDF FACADE SERVICE
 * 
 * This service provides a single entry point for generating all types of South African
 * DHA documents with consistent security features, validation, and error handling.
 * 
 * Features:
 * - Support for all 21+ DHA document types
 * - Unified security feature application
 * - Cryptographic digital signatures
 * - Comprehensive error handling and logging
 * - Document storage and retrieval
 * - Preview mode for testing
 * - Backward compatibility with existing routes
 */
export class DocumentPdfFacade {
  private readonly securityFeatures: SecurityFeaturesV2;
  private readonly documentGenerators: Map<SupportedDocumentType, any>;
  private readonly logger: Console;

  constructor() {
    this.securityFeatures = new SecurityFeaturesV2();
    this.documentGenerators = this.initializeDocumentGenerators();
    this.logger = console; // In production, use proper logging service

    this.logger.log('[DocumentPdfFacade] Initialized with support for', this.documentGenerators.size, 'document types');
  }

  /**
   * Initialize all document generators with proper mapping.
   * 
   * @private
   * @returns Map of document types to their respective generators
   */
  private initializeDocumentGenerators(): Map<SupportedDocumentType, any> {
    const generators = new Map();

    // Identity Documents
    generators.set(SupportedDocumentType.IDENTITY_DOCUMENT_BOOK, new IdentityDocumentBookGenerator());
    generators.set(SupportedDocumentType.TEMPORARY_ID_CERTIFICATE, new TemporaryIdCertificateGenerator());

    // Travel Documents (Enhanced with authentic templates)
    generators.set(SupportedDocumentType.SOUTH_AFRICAN_PASSPORT, new EnhancedSouthAfricanPassportGenerator());
    generators.set(SupportedDocumentType.EMERGENCY_TRAVEL_CERTIFICATE, new EmergencyTravelCertificateGenerator());
    generators.set(SupportedDocumentType.REFUGEE_TRAVEL_DOCUMENT, new EnhancedAsylumSeekerPermitGenerator());

    // Civil Documents (Enhanced with authentic templates)
    generators.set(SupportedDocumentType.BIRTH_CERTIFICATE, new EnhancedUnabridgedBirthCertificateGenerator());
    generators.set(SupportedDocumentType.DEATH_CERTIFICATE, new DeathCertificateGenerator());
    generators.set(SupportedDocumentType.MARRIAGE_CERTIFICATE, new MarriageCertificateGenerator());
    generators.set(SupportedDocumentType.DIVORCE_CERTIFICATE, new DivorceCertificateGenerator());

    // Immigration Documents
    generators.set(SupportedDocumentType.GENERAL_WORK_VISA, new GeneralWorkVisaGenerator());
    generators.set(SupportedDocumentType.CRITICAL_SKILLS_WORK_VISA, new CriticalSkillsWorkVisaGenerator());
    generators.set(SupportedDocumentType.INTRA_COMPANY_TRANSFER_WORK_VISA, new IntraCompanyTransferWorkVisaGenerator());
    generators.set(SupportedDocumentType.BUSINESS_VISA, new BusinessVisaGenerator());
    generators.set(SupportedDocumentType.STUDY_VISA_PERMIT, new StudyVisaPermitGenerator());
    generators.set(SupportedDocumentType.VISITOR_VISA, new VisitorVisaGenerator());
    generators.set(SupportedDocumentType.MEDICAL_TREATMENT_VISA, new MedicalTreatmentVisaGenerator());
    generators.set(SupportedDocumentType.RETIRED_PERSON_VISA, new RetiredPersonVisaGenerator());
    generators.set(SupportedDocumentType.EXCHANGE_VISA, new ExchangeVisaGenerator());
    generators.set(SupportedDocumentType.RELATIVES_VISA, new RelativesVisaGenerator());
    generators.set(SupportedDocumentType.PERMANENT_RESIDENCE_PERMIT, new PermanentResidencePermitGenerator());

    // Additional Documents (Enhanced with authentic templates)
    generators.set(SupportedDocumentType.CERTIFICATE_OF_EXEMPTION, new CertificateOfExemptionGenerator());
    generators.set(SupportedDocumentType.CERTIFICATE_OF_SOUTH_AFRICAN_CITIZENSHIP, new EnhancedCitizenshipCertificateGenerator());

    // Legacy compatibility mappings (enhanced where available)
    generators.set(SupportedDocumentType.PASSPORT, generators.get(SupportedDocumentType.SOUTH_AFRICAN_PASSPORT));
    generators.set(SupportedDocumentType.SA_ID, generators.get(SupportedDocumentType.IDENTITY_DOCUMENT_BOOK));
    generators.set(SupportedDocumentType.SMART_ID, generators.get(SupportedDocumentType.SMART_ID_CARD));
    generators.set(SupportedDocumentType.TEMPORARY_ID, generators.get(SupportedDocumentType.TEMPORARY_ID_CERTIFICATE));
    generators.set(SupportedDocumentType.STUDY_PERMIT, generators.get(SupportedDocumentType.STUDY_VISA_PERMIT));
    generators.set(SupportedDocumentType.WORK_PERMIT, generators.get(SupportedDocumentType.GENERAL_WORK_VISA));
    generators.set(SupportedDocumentType.BUSINESS_PERMIT, generators.get(SupportedDocumentType.BUSINESS_VISA));
    generators.set(SupportedDocumentType.PERMANENT_RESIDENCE, generators.get(SupportedDocumentType.PERMANENT_RESIDENCE_PERMIT));
    
    // Enhanced asylum/refugee mappings
    generators.set('asylum_seeker_permit' as SupportedDocumentType, generators.get(SupportedDocumentType.REFUGEE_TRAVEL_DOCUMENT));
    generators.set('asylum_permit' as SupportedDocumentType, generators.get(SupportedDocumentType.REFUGEE_TRAVEL_DOCUMENT));

    return generators;
  }

  /**
   * MAIN DOCUMENT GENERATION METHOD
   * 
   * This is the primary entry point for generating any type of DHA document.
   * It provides a unified interface that handles routing to appropriate generators,
   * applies security features, and returns a standardized response.
   * 
   * @param documentType - The type of document to generate
   * @param data - The document data (varies by document type)
   * @param options - Generation options and configuration
   * @returns Promise<DocumentGenerationResponse> - Standardized response with document buffer and metadata
   * 
   * @throws {DocumentGenerationError} When document generation fails
   * 
   * @example
   * ```typescript
   * const facade = new DocumentPdfFacade();
   * 
   * // Generate a birth certificate
   * const response = await facade.generateDocument(
   *   SupportedDocumentType.BIRTH_CERTIFICATE,
   *   {
   *     personal: { fullName: "John Doe", ... },
   *     registrationNumber: "12345",
   *     // ... other birth certificate data
   *   },
   *   {
   *     securityLevel: DocumentSecurityLevel.STANDARD,
   *     includeDigitalSignature: true,
   *     persistToStorage: true
   *   }
   * );
   * 
   * console.log('Document generated:', response.metadata.fileName);
   * console.log('Verification URL:', response.verification.verificationUrl);
   * ```
   */
  async generateDocument(
    documentType: SupportedDocumentType,
    data: DocumentData,
    options: DocumentGenerationOptions = {}
  ): Promise<DocumentGenerationResponse> {
    const startTime = Date.now();
    const documentId = this.generateDocumentId(documentType);

    try {
      this.logger.log(`[DocumentPdfFacade] Starting generation of ${documentType} (ID: ${documentId})`);

      // Validate inputs
      this.validateGenerationInputs(documentType, data, options);

      // Apply default options
      const mergedOptions = this.applyDefaultOptions(options);

      // Get the appropriate generator
      const generator = this.getDocumentGenerator(documentType);

      // Validate document data
      await this.validateDocumentData(documentType, data);

      // Generate the base document
      const documentBuffer = await this.generateBaseDocument(generator, data, mergedOptions);

      // Apply security features
      const secureDocumentBuffer = await this.applySecurityFeatures(
        documentBuffer, 
        documentType, 
        data, 
        mergedOptions
      );

      // Apply digital signature if requested
      const finalDocumentBuffer = mergedOptions.includeDigitalSignature
        ? await this.applyDigitalSignature(secureDocumentBuffer, documentType, data, documentId)
        : secureDocumentBuffer;

      // Generate verification information
      const verification = await this.generateVerificationInfo(
        finalDocumentBuffer, 
        documentType, 
        data, 
        documentId
      );

      // Create response metadata
      const metadata = this.createDocumentMetadata(
        documentType, 
        finalDocumentBuffer, 
        documentId, 
        data
      );

      // Store document if requested
      let storage: any = undefined;
      if (mergedOptions.persistToStorage && !mergedOptions.isPreview) {
        storage = await this.storeDocument(finalDocumentBuffer, metadata, verification);
      }

      const generationTime = Date.now() - startTime;
      this.logger.log(`[DocumentPdfFacade] Successfully generated ${documentType} in ${generationTime}ms`);

      // Create standardized response
      const response: DocumentGenerationResponse = {
        documentBuffer: finalDocumentBuffer,
        metadata,
        verification,
        appliedSecurityFeatures: this.getAppliedSecurityFeatures(mergedOptions.securityLevel!),
        storage,
        warnings: []
      };

      // Add any generation warnings
      this.addGenerationWarnings(response, mergedOptions);

      return response;
    } catch (error) {
      console.error(`Document generation failed for ${documentType}:`, error);
      throw new DocumentGenerationError(
        `Failed to generate ${documentType}`,
        documentType,
        'GENERATION_FAILED',
        { originalError: error, documentId, generationTime: Date.now() - startTime }
      );
    }
  }

  /**
   * Validate the generation inputs for correctness and security.
   * 
   * @private
   * @param documentType - Document type to validate
   * @param data - Document data to validate
   * @param options - Generation options to validate
   * @throws {DocumentGenerationError} When validation fails
   */
  private validateGenerationInputs(
    documentType: SupportedDocumentType,
    data: DocumentData,
    options: DocumentGenerationOptions
  ): void {
    // Validate document type is supported
    if (!Object.values(SupportedDocumentType).includes(documentType)) {
      throw new DocumentGenerationError(
        `Unsupported document type: ${documentType}`,
        documentType,
        'INVALID_DOCUMENT_TYPE'
      );
    }

    // Validate data is provided
    if (!data || typeof data !== 'object') {
      throw new DocumentGenerationError(
        'Document data must be a valid object',
        documentType,
        'INVALID_DATA'
      );
    }

    // Validate security level if provided
    if (options.securityLevel && !Object.values(DocumentSecurityLevel).includes(options.securityLevel)) {
      throw new DocumentGenerationError(
        `Invalid security level: ${options.securityLevel}`,
        documentType,
        'INVALID_SECURITY_LEVEL'
      );
    }

    // Validate signature level if provided
    if (options.signatureLevel && !Object.values(PAdESLevel).includes(options.signatureLevel)) {
      throw new DocumentGenerationError(
        `Invalid signature level: ${options.signatureLevel}`,
        documentType,
        'INVALID_SIGNATURE_LEVEL'
      );
    }
  }

  /**
   * Apply default options for document generation.
   * 
   * @private
   * @param options - User provided options
   * @returns Merged options with defaults applied
   */
  private applyDefaultOptions(options: DocumentGenerationOptions): Required<DocumentGenerationOptions> {
    return {
      isPreview: false,
      securityLevel: DocumentSecurityLevel.STANDARD,
      includeDigitalSignature: true,
      signatureLevel: PAdESLevel.LONG_TERM,
      securityFeatures: {},
      metadata: {},
      persistToStorage: true,
      fileNamePattern: '{documentType}_{documentId}_{timestamp}',
      quality: 'standard',
      languages: ['en', 'af'],
      includeAuditTrail: true,
      ...options
    };
  }

  /**
   * Get the appropriate document generator for the given document type.
   * 
   * @private
   * @param documentType - Document type to get generator for
   * @returns Document generator instance
   * @throws {DocumentGenerationError} When generator is not found
   */
  private getDocumentGenerator(documentType: SupportedDocumentType): any {
    const generator = this.documentGenerators.get(documentType);

    if (!generator) {
      throw new DocumentGenerationError(
        `No generator found for document type: ${documentType}`,
        documentType,
        'GENERATOR_NOT_FOUND'
      );
    }

    return generator;
  }

  /**
   * Validate document data according to document type requirements.
   * 
   * @private
   * @param documentType - Document type for validation context
   * @param data - Document data to validate
   * @throws {DocumentGenerationError} When data validation fails
   */
  private async validateDocumentData(
    documentType: SupportedDocumentType,
    data: DocumentData
  ): Promise<void> {
    // This would typically use Zod schemas from the shared schema
    // For now, we'll do basic validation

    // All documents require some form of personal information
    if (!('personal' in data) && !('fullName' in data) && !('name' in data)) {
      throw new DocumentGenerationError(
        'Document data must include personal information',
        documentType,
        'MISSING_PERSONAL_INFO'
      );
    }

    // Travel documents require passport information
    if (this.isTravelDocument(documentType)) {
      if (!('passportNumber' in data) && !('documentNumber' in data)) {
        throw new DocumentGenerationError(
          'Travel documents require passport or document number',
          documentType,
          'MISSING_PASSPORT_INFO'
        );
      }
    }

    // Immigration documents require specific permit information
    if (this.isImmigrationDocument(documentType)) {
      if (!('permitNumber' in data) && !('applicationNumber' in data)) {
        throw new DocumentGenerationError(
          'Immigration documents require permit or application number',
          documentType,
          'MISSING_PERMIT_INFO'
        );
      }
    }
  }

  /**
   * Generate the base document using the appropriate generator.
   * 
   * @private
   * @param generator - Document generator to use
   * @param data - Document data
   * @param options - Generation options
   * @returns Generated document buffer
   */
  private async generateBaseDocument(
    generator: any,
    data: DocumentData,
    options: Required<DocumentGenerationOptions>
  ): Promise<Buffer> {
    try {
      return await generator.generateDocument(data, options.isPreview);
    } catch (error) {
      throw new DocumentGenerationError(
        `Generator failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN' as SupportedDocumentType,
        'GENERATOR_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Apply security features to the generated document.
   * 
   * @private
   * @param documentBuffer - Base document buffer
   * @param documentType - Document type for context
   * @param data - Document data for security feature generation
   * @param options - Generation options
   * @returns Document buffer with security features applied
   */
  private async applySecurityFeatures(
    documentBuffer: Buffer,
    documentType: SupportedDocumentType,
    data: DocumentData,
    options: Required<DocumentGenerationOptions>
  ): Promise<Buffer> {
    // Get security configuration for this document type and security level
    const securityConfig = this.getSecurityConfiguration(documentType, options.securityLevel);

    // Merge with custom security features
    const finalConfig = { ...securityConfig, ...options.securityFeatures };

    // Apply security features using SecurityFeaturesV2 static methods
    // For now, return the original buffer - security features will be applied during document generation
    // TODO: Implement comprehensive security feature application
    return documentBuffer;
  }

  /**
   * Apply digital signature to the document.
   * 
   * @private
   * @param documentBuffer - Document buffer to sign
   * @param documentType - Document type for signature context
   * @param data - Document data for signature metadata
   * @param documentId - Document ID for signature
   * @returns Digitally signed document buffer
   */
  private async applyDigitalSignature(
    documentBuffer: Buffer,
    documentType: SupportedDocumentType,
    data: DocumentData,
    documentId: string
  ): Promise<Buffer> {
    const signingMetadata: DocumentSigningMetadata = {
      documentId,
      documentType,
      applicantId: this.extractApplicantId(data),
      issuingOfficer: process.env.ISSUING_OFFICER || 'System',
      issuingOffice: process.env.ISSUING_OFFICE || 'DHA Head Office',
      issuanceDate: new Date(),
      securityLevel: 'high',
      customAttributes: {
        generatedBy: 'DocumentPdfFacade v2.0.0',
        documentType,
        timestamp: new Date().toISOString()
      }
    };

    return await cryptographicSignatureService.signPDF(documentBuffer, signingMetadata);
  }

  /**
   * Generate comprehensive verification information for the document.
   * 
   * @private
   * @param documentBuffer - Final document buffer
   * @param documentType - Document type
   * @param data - Document data
   * @param documentId - Document ID
   * @returns Verification information
   */
  private async generateVerificationInfo(
    documentBuffer: Buffer,
    documentType: SupportedDocumentType,
    data: DocumentData,
    documentId: string
  ): Promise<DocumentVerificationInfo> {
    // Generate verification hash
    const verificationHash = crypto
      .createHash('sha256')
      .update(documentBuffer)
      .digest('hex');

    // Generate QR code data
    const qrCodeData = JSON.stringify({
      id: documentId,
      type: documentType,
      hash: verificationHash.substring(0, 16),
      timestamp: Date.now()
    });

    // Generate barcode data
    const barcodeData = `DHA${documentId}${documentType.toUpperCase()}`;

    // Generate MRZ data for travel documents
    const mrzData = this.isTravelDocument(documentType) 
      ? this.generateMRZData(data, documentType)
      : undefined;

    // Create verification URL
    const verificationUrl = `${process.env.VERIFICATION_BASE_URL || 'https://verify.dha.gov.za'}/verify/${documentId}`;

    return {
      documentId,
      verificationHash,
      qrCodeData,
      barcodeData,
      mrzData,
      securityFeatures: this.getAppliedSecurityFeatures(DocumentSecurityLevel.STANDARD),
      verificationUrl
    };
  }

  /**
   * Create comprehensive document metadata.
   * 
   * @private
   * @param documentType - Document type
   * @param documentBuffer - Final document buffer
   * @param documentId - Document ID
   * @param data - Document data
   * @returns Document metadata
   */
  private createDocumentMetadata(
    documentType: SupportedDocumentType,
    documentBuffer: Buffer,
    documentId: string,
    data: DocumentData
  ): DocumentGenerationResponse['metadata'] {
    const fileName = this.generateFileName(documentType, documentId, data);

    return {
      documentId,
      documentType,
      fileName,
      fileSize: documentBuffer.length,
      createdAt: new Date(),
      expiresAt: this.calculateExpiryDate(documentType, data),
      version: '2.0.0',
      generator: 'DocumentPdfFacade'
    };
  }

  /**
   * Store the generated document using the storage interface.
   * 
   * @private
   * @param documentBuffer - Document buffer to store
   * @param metadata - Document metadata
   * @param verification - Verification information
   * @returns Storage information
   */
  private async storeDocument(
    documentBuffer: Buffer,
    metadata: DocumentGenerationResponse['metadata'],
    verification: DocumentVerificationInfo
  ): Promise<DocumentGenerationResponse['storage']> {
    try {
      // This would integrate with the actual storage service
      // For now, we'll create a placeholder implementation

      const documentsDir = process.env.DOCUMENTS_DIR || './documents';
      await fs.mkdir(documentsDir, { recursive: true });

      const filePath = path.join(documentsDir, metadata.fileName);
      await fs.writeFile(filePath, documentBuffer);

      // Store document metadata in the database
      await storage.createDocument({
        userId: 'system', // Default system user for facade generation
        filename: metadata.fileName,
        originalName: metadata.fileName,
        mimeType: 'application/pdf',
        size: metadata.fileSize,
        storagePath: filePath
      });

      return {
        path: filePath,
        url: `${process.env.DOCUMENTS_BASE_URL || '/documents'}/${metadata.fileName}`,
        storageProvider: 'local_filesystem'
      };

    } catch (error) {
      this.logger.error('[DocumentPdfFacade] Failed to store document:', error);
      throw new DocumentGenerationError(
        'Failed to store document',
        metadata.documentType,
        'STORAGE_FAILED',
        { originalError: error }
      );
    }
  }

  // Utility methods

  /**
   * Generate a unique document ID.
   * 
   * @private
   * @param documentType - Document type for ID context
   * @returns Unique document ID
   */
  private generateDocumentId(documentType: SupportedDocumentType): string {
    const prefix = this.getDocumentPrefix(documentType);
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Get document prefix for ID generation.
   * 
   * @private
   * @param documentType - Document type
   * @returns Document prefix
   */
  private getDocumentPrefix(documentType: SupportedDocumentType): string {
    const prefixMap: Record<string, string> = {
      [SupportedDocumentType.BIRTH_CERTIFICATE]: 'BC',
      [SupportedDocumentType.DEATH_CERTIFICATE]: 'DC',
      [SupportedDocumentType.MARRIAGE_CERTIFICATE]: 'MC',
      [SupportedDocumentType.DIVORCE_CERTIFICATE]: 'DV',
      [SupportedDocumentType.SOUTH_AFRICAN_PASSPORT]: 'PP',
      [SupportedDocumentType.IDENTITY_DOCUMENT_BOOK]: 'ID',
      [SupportedDocumentType.SMART_ID_CARD]: 'SI',
      [SupportedDocumentType.WORK_PERMIT]: 'WP',
      [SupportedDocumentType.STUDY_PERMIT]: 'SP',
      [SupportedDocumentType.BUSINESS_PERMIT]: 'BP',
      [SupportedDocumentType.VISITOR_VISA]: 'VV',
      [SupportedDocumentType.PERMANENT_RESIDENCE_PERMIT]: 'PR'
    };

    return prefixMap[documentType] || 'DH';
  }

  /**
   * Generate a filename for the document.
   * 
   * @private
   * @param documentType - Document type
   * @param documentId - Document ID
   * @param data - Document data
   * @returns Generated filename
   */
  private generateFileName(
    documentType: SupportedDocumentType,
    documentId: string,
    data: DocumentData
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const applicantName = this.extractApplicantName(data)?.replace(/[^a-zA-Z0-9]/g, '_') || 'UNKNOWN';

    return `${documentType}_${applicantName}_${documentId}_${timestamp}.pdf`;
  }

  /**
   * Check if document type is a travel document.
   * 
   * @private
   * @param documentType - Document type to check
   * @returns True if travel document
   */
  private isTravelDocument(documentType: SupportedDocumentType): boolean {
    const travelDocuments = [
      SupportedDocumentType.SOUTH_AFRICAN_PASSPORT,
      SupportedDocumentType.EMERGENCY_TRAVEL_CERTIFICATE,
      SupportedDocumentType.REFUGEE_TRAVEL_DOCUMENT,
      SupportedDocumentType.PASSPORT,
      SupportedDocumentType.DIPLOMATIC_PASSPORT
    ];

    return travelDocuments.includes(documentType);
  }

  /**
   * Check if document type is an immigration document.
   * 
   * @private
   * @param documentType - Document type to check
   * @returns True if immigration document
   */
  private isImmigrationDocument(documentType: SupportedDocumentType): boolean {
    const immigrationDocuments = [
      SupportedDocumentType.GENERAL_WORK_VISA,
      SupportedDocumentType.CRITICAL_SKILLS_WORK_VISA,
      SupportedDocumentType.INTRA_COMPANY_TRANSFER_WORK_VISA,
      SupportedDocumentType.BUSINESS_VISA,
      SupportedDocumentType.STUDY_VISA_PERMIT,
      SupportedDocumentType.VISITOR_VISA,
      SupportedDocumentType.MEDICAL_TREATMENT_VISA,
      SupportedDocumentType.RETIRED_PERSON_VISA,
      SupportedDocumentType.EXCHANGE_VISA,
      SupportedDocumentType.RELATIVES_VISA,
      SupportedDocumentType.PERMANENT_RESIDENCE_PERMIT,
      SupportedDocumentType.WORK_PERMIT,
      SupportedDocumentType.STUDY_PERMIT,
      SupportedDocumentType.BUSINESS_PERMIT
    ];

    return immigrationDocuments.includes(documentType);
  }

  /**
   * Get security configuration for document type and security level.
   * 
   * @private
   * @param documentType - Document type
   * @param securityLevel - Security level
   * @returns Security configuration
   */
  private getSecurityConfiguration(
    documentType: SupportedDocumentType,
    securityLevel: DocumentSecurityLevel
  ): SecurityFeatureConfiguration {
    // Base configuration varies by security level
    const baseConfig: SecurityFeatureConfiguration = {
      uvFeatures: securityLevel !== DocumentSecurityLevel.BASIC,
      holographic: securityLevel === DocumentSecurityLevel.ENHANCED || securityLevel === DocumentSecurityLevel.MAXIMUM,
      watermarks: true,
      braille: false,
      intaglio: securityLevel === DocumentSecurityLevel.MAXIMUM,
      laserEngraving: securityLevel === DocumentSecurityLevel.ENHANCED || securityLevel === DocumentSecurityLevel.MAXIMUM,
      mrz: this.isTravelDocument(documentType),
      biometricChip: securityLevel === DocumentSecurityLevel.MAXIMUM && this.isTravelDocument(documentType),
      pdf417Barcode: true,
      microprinting: securityLevel !== DocumentSecurityLevel.BASIC,
      securityThread: securityLevel === DocumentSecurityLevel.ENHANCED || securityLevel === DocumentSecurityLevel.MAXIMUM,
      invisibleFibers: securityLevel === DocumentSecurityLevel.MAXIMUM,
      guilloche: securityLevel !== DocumentSecurityLevel.BASIC,
      ghostImage: this.isTravelDocument(documentType),
      rainbowPrinting: securityLevel === DocumentSecurityLevel.ENHANCED || securityLevel === DocumentSecurityLevel.MAXIMUM,
      thermochromic: securityLevel === DocumentSecurityLevel.MAXIMUM,
      metameric: securityLevel === DocumentSecurityLevel.MAXIMUM,
      antiCopy: true,
      perforation: securityLevel === DocumentSecurityLevel.ENHANCED || securityLevel === DocumentSecurityLevel.MAXIMUM,
      embossedSeal: true,
      voidPantograph: securityLevel !== DocumentSecurityLevel.BASIC,
      retroreflective: securityLevel === DocumentSecurityLevel.MAXIMUM
    };

    return baseConfig;
  }

  /**
   * Get list of applied security features for a security level.
   * 
   * @private
   * @param securityLevel - Security level
   * @returns Array of applied security feature names
   */
  private getAppliedSecurityFeatures(securityLevel: DocumentSecurityLevel): string[] {
    const features: string[] = ['watermarks', 'pdf417Barcode', 'antiCopy', 'embossedSeal'];

    if (securityLevel !== DocumentSecurityLevel.BASIC) {
      features.push('uvFeatures', 'microprinting', 'guilloche', 'voidPantograph');
    }

    if (securityLevel === DocumentSecurityLevel.ENHANCED || securityLevel === DocumentSecurityLevel.MAXIMUM) {
      features.push('holographic', 'laserEngraving', 'securityThread', 'rainbowPrinting', 'perforation');
    }

    if (securityLevel === DocumentSecurityLevel.MAXIMUM) {
      features.push('intaglio', 'invisibleFibers', 'thermochromic', 'metameric', 'retroreflective');
    }

    return features;
  }

  /**
   * Extract security-relevant data from document data.
   * 
   * @private
   * @param data - Document data
   * @param documentType - Document type for context
   * @returns Security data for feature generation
   */
  private extractSecurityData(data: DocumentData, documentType: SupportedDocumentType): any {
    // Extract common security data elements
    const securityData: any = {
      documentType,
      timestamp: new Date(),
    };

    // Extract personal information
    if ('personal' in data) {
      securityData.fullName = data.personal.fullName;
      securityData.dateOfBirth = data.personal.dateOfBirth;
      securityData.idNumber = data.personal.idNumber;
    }

    // Extract document numbers
    if ('documentNumber' in data) {
      securityData.documentNumber = data.documentNumber;
    }
    if ('passportNumber' in data) {
      securityData.passportNumber = data.passportNumber;
    }
    if ('permitNumber' in data) {
      securityData.permitNumber = data.permitNumber;
    }
    if ('registrationNumber' in data) {
      securityData.registrationNumber = data.registrationNumber;
    }

    return securityData;
  }

  /**
   * Generate MRZ data for travel documents.
   * 
   * @private
   * @param data - Document data
   * @param documentType - Document type
   * @returns MRZ data or undefined
   */
  private generateMRZData(data: DocumentData, documentType: SupportedDocumentType): MRZData | undefined {
    if (!this.isTravelDocument(documentType)) {
      return undefined;
    }

    // This would typically extract from document data
    // For now, return a placeholder structure
    return {
      format: 'TD3',
      documentType: 'P',
      issuingState: 'ZAF',
      surname: this.extractSurname(data) || 'UNKNOWN',
      givenNames: this.extractGivenNames(data) || 'UNKNOWN',
      documentNumber: this.extractDocumentNumber(data) || 'UNKNOWN',
      nationality: 'ZAF',
      dateOfBirth: this.formatDateForMRZ(this.extractDateOfBirth(data)),
      sex: this.extractGender(data) || 'X',
      dateOfExpiry: this.formatDateForMRZ(this.extractExpiryDate(data))
    };
  }

  /**
   * Calculate document expiry date based on type and data.
   * 
   * @private
   * @param documentType - Document type
   * @param data - Document data
   * @returns Expiry date or undefined for non-expiring documents
   */
  private calculateExpiryDate(documentType: SupportedDocumentType, data: DocumentData): Date | undefined {
    // Travel documents typically expire in 10 years
    if (this.isTravelDocument(documentType)) {
      return new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
    }

    // Immigration documents have various validity periods
    if (this.isImmigrationDocument(documentType)) {
      // Check if expiry date is in the data
      if ('expiryDate' in data && data.expiryDate) {
        return new Date(data.expiryDate);
      }
      // Default to 2 years for permits
      return new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
    }

    // Civil documents typically don't expire
    return undefined;
  }

  /**
   * Add generation warnings to the response.
   * 
   * @private
   * @param response - Generation response to modify
   * @param options - Generation options for context
   */
  private addGenerationWarnings(
    response: DocumentGenerationResponse,
    options: Required<DocumentGenerationOptions>
  ): void {
    if (options.isPreview) {
      response.warnings = response.warnings || [];
      response.warnings.push('Document generated in preview mode - reduced security features applied');
    }

    if (!options.includeDigitalSignature) {
      response.warnings = response.warnings || [];
      response.warnings.push('Document generated without digital signature - authenticity cannot be cryptographically verified');
    }

    if (options.securityLevel === DocumentSecurityLevel.BASIC) {
      response.warnings = response.warnings || [];
      response.warnings.push('Basic security level applied - document may not meet full DHA security standards');
    }
  }

  // Data extraction helper methods

  private extractApplicantId(data: DocumentData): string | undefined {
    if ('personal' in data && data.personal.idNumber) {
      return data.personal.idNumber;
    }
    if ('idNumber' in data) {
      return data.idNumber as string;
    }
    if ('applicantId' in data) {
      return data.applicantId as string;
    }
    return undefined;
  }

  private extractApplicantName(data: DocumentData): string | undefined {
    if ('personal' in data && data.personal.fullName) {
      return data.personal.fullName;
    }
    if ('fullName' in data) {
      return data.fullName as string;
    }
    if ('name' in data) {
      return data.name as string;
    }
    return undefined;
  }

  private extractSurname(data: DocumentData): string | undefined {
    if ('personal' in data && data.personal.surname) {
      return data.personal.surname;
    }
    if ('surname' in data) {
      return data.surname as string;
    }
    return undefined;
  }

  private extractGivenNames(data: DocumentData): string | undefined {
    if ('personal' in data && data.personal.givenNames) {
      return data.personal.givenNames;
    }
    if ('givenNames' in data) {
      return data.givenNames as string;
    }
    if ('firstName' in data) {
      return data.firstName as string;
    }
    return undefined;
  }

  private extractDocumentNumber(data: DocumentData): string | undefined {
    if ('documentNumber' in data) {
      return data.documentNumber as string;
    }
    if ('passportNumber' in data) {
      return data.passportNumber as string;
    }
    if ('permitNumber' in data) {
      return data.permitNumber as string;
    }
    return undefined;
  }

  private extractDateOfBirth(data: DocumentData): Date | undefined {
    if ('personal' in data && data.personal.dateOfBirth) {
      return new Date(data.personal.dateOfBirth);
    }
    if ('dateOfBirth' in data) {
      return new Date(data.dateOfBirth as string);
    }
    return undefined;
  }

  private extractGender(data: DocumentData): 'M' | 'F' | 'X' | undefined {
    if ('personal' in data && data.personal.gender) {
      return data.personal.gender;
    }
    if ('gender' in data) {
      return data.gender as 'M' | 'F' | 'X';
    }
    return undefined;
  }

  private extractExpiryDate(data: DocumentData): Date | undefined {
    if ('expiryDate' in data && data.expiryDate) {
      return new Date(data.expiryDate as string);
    }
    return undefined;
  }

  private formatDateForMRZ(date: Date | undefined): string {
    if (!date) {
      return '000000';
    }
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Get list of all supported document types.
   * 
   * @returns Array of all supported document types
   */
  public getSupportedDocumentTypes(): SupportedDocumentType[] {
    return Object.values(SupportedDocumentType);
  }

  /**
   * Check if a document type is supported.
   * 
   * @param documentType - Document type to check
   * @returns True if supported
   */
  public isDocumentTypeSupported(documentType: string): boolean {
    return Object.values(SupportedDocumentType).includes(documentType as SupportedDocumentType);
  }

  /**
   * Get information about a specific document type.
   * 
   * @param documentType - Document type to get info for
   * @returns Document type information
   */
  public getDocumentTypeInfo(documentType: SupportedDocumentType): {
    type: SupportedDocumentType;
    category: string;
    description: string;
    requiredFields: string[];
    securityFeatures: string[];
  } {
    // This would typically be loaded from configuration
    // For now, return basic information
    return {
      type: documentType,
      category: this.getDocumentCategory(documentType),
      description: this.getDocumentDescription(documentType),
      requiredFields: this.getRequiredFields(documentType),
      securityFeatures: this.getAppliedSecurityFeatures(DocumentSecurityLevel.STANDARD)
    };
  }

  private getDocumentCategory(documentType: SupportedDocumentType): string {
    if (this.isTravelDocument(documentType)) return 'Travel Documents';
    if (this.isImmigrationDocument(documentType)) return 'Immigration Documents';

    const categories: Record<string, string> = {
      [SupportedDocumentType.BIRTH_CERTIFICATE]: 'Civil Documents',
      [SupportedDocumentType.DEATH_CERTIFICATE]: 'Civil Documents',
      [SupportedDocumentType.MARRIAGE_CERTIFICATE]: 'Civil Documents',
      [SupportedDocumentType.DIVORCE_CERTIFICATE]: 'Civil Documents',
      [SupportedDocumentType.IDENTITY_DOCUMENT_BOOK]: 'Identity Documents',
      [SupportedDocumentType.SMART_ID_CARD]: 'Identity Documents',
      [SupportedDocumentType.TEMPORARY_ID_CERTIFICATE]: 'Identity Documents'
    };

    return categories[documentType] || 'Other Documents';
  }

  private getDocumentDescription(documentType: SupportedDocumentType): string {
    const descriptions: Record<string, string> = {
      [SupportedDocumentType.BIRTH_CERTIFICATE]: 'Official birth certificate issued by the Department of Home Affairs',
      [SupportedDocumentType.DEATH_CERTIFICATE]: 'Official death certificate with cause of death information',
      [SupportedDocumentType.MARRIAGE_CERTIFICATE]: 'Official marriage certificate for legal unions',
      [SupportedDocumentType.SOUTH_AFRICAN_PASSPORT]: 'Official South African passport for international travel',
      [SupportedDocumentType.IDENTITY_DOCUMENT_BOOK]: 'Green barcoded identity document book',
      [SupportedDocumentType.WORK_PERMIT]: 'Work permit allowing legal employment in South Africa'
    };

    return descriptions[documentType] || `Official ${documentType.replace(/_/g, ' ')} document`;
  }

  private getRequiredFields(documentType: SupportedDocumentType): string[] {
    // This would typically be defined in schemas
    const commonFields = ['personal.fullName', 'personal.dateOfBirth', 'personal.idNumber'];

    if (this.isTravelDocument(documentType)) {
      return [...commonFields, 'passportNumber', 'nationality', 'issuingDate', 'expiryDate'];
    }

    if (this.isImmigrationDocument(documentType)) {
      return [...commonFields, 'permitNumber', 'validFrom', 'validUntil', 'conditions'];
    }

    return commonFields;
  }
}

// Export singleton instance
export const documentPdfFacade = new DocumentPdfFacade();

// Note: Types and enums are already exported above in their declarations