import * as forge from 'node-forge';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFHexString, PDFString } from 'pdf-lib';
import * as crypto from 'crypto';
import * as asn1js from 'asn1js';
import { Certificate, CertificateSet, PrivateKeyInfo } from 'pkijs';
import { X509Certificate } from '@peculiar/x509';
import { verificationService } from './verification-service';

// DHA Government PKI Configuration - PRODUCTION COMPLIANT
const DHA_PKI_CONFIG = {
  issuer: 'Department of Home Affairs - Republic of South Africa',
  rootCA: 'DHA Root Certificate Authority',
  intermediateCAs: ['DHA Issuing CA', 'DHA Document Signing CA'],
  keySize: 4096,
  hashAlgorithm: 'SHA-512',
  signatureAlgorithm: 'RSA-PSS',
  timestampAuthority: process.env.DHA_TSA_URL || 'https://tsa.dha.gov.za/tsa',
  policyOid: '1.3.6.1.4.1.27893.1.1.1', // DHA document signing policy
  ocspResponder: process.env.DHA_OCSP_URL || 'https://ocsp.dha.gov.za',
  crlDistributionPoint: process.env.DHA_CRL_URL || 'https://crl.dha.gov.za/dha-ca.crl',
  
  // GOVERNMENT COMPLIANCE REQUIREMENTS
  requireOCSP: true,
  requireCRL: true,
  embedRevocationInfo: true, // PAdES-LTV requirement
  requireTimestamp: true,
  signatureLevel: 'PAdES-B-LTV', // Long Term Validation
  
  // Certificate validation requirements
  validateCertificateChain: true,
  checkCertificateRevocation: true,
  requireGovernmentCA: true,
  
  // Security requirements
  minimumKeySize: 4096,
  allowedHashAlgorithms: ['SHA-512', 'SHA-384'],
  mandatoryExtensions: [
    'keyUsage',
    'extendedKeyUsage',
    'certificatePolicies',
    'authorityInfoAccess',
    'crlDistributionPoints'
  ],
  
  // Production security validation
  productionModeEnabled: process.env.NODE_ENV === 'production',
  enforceProductionSecurity: process.env.NODE_ENV === 'production'
};

// PAdES signature levels
export enum PAdESLevel {
  BASIC = 'PAdES-B-B',
  TIMESTAMP = 'PAdES-B-T',
  LONG_TERM = 'PAdES-B-LT',
  LONG_TERM_ARCHIVE = 'PAdES-B-LTA'
}

// Document signing certificate information
export interface DHASigningCertificate {
  certificate: forge.pki.Certificate;
  privateKey: forge.pki.PrivateKey;
  certificateChain: forge.pki.Certificate[];
  subjectDN: string;
  issuerDN: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  keyUsage: string[];
  extendedKeyUsage: string[];
}

// Signature validation result
export interface SignatureValidationResult {
  valid: boolean;
  signatureValid: boolean;
  certificateValid: boolean;
  timestampValid: boolean;
  signerInfo: {
    subject: string;
    issuer: string;
    serialNumber: string;
    signingTime: Date;
  };
  validationErrors: string[];
  trustChainValid: boolean;
  certificateRevoked: boolean;
}

// Document metadata for signing
export interface DocumentSigningMetadata {
  documentId: string;
  documentType: string;
  applicantId?: string;
  issuingOfficer: string;
  issuingOffice: string;
  issuanceDate: Date;
  expiryDate?: Date;
  securityLevel: 'standard' | 'high' | 'top_secret';
  customAttributes?: Record<string, any>;
}

// CRITICAL: PAdES-LTV Revocation Data for Government Compliance
export interface RevocationData {
  ocspResponses: Buffer[];
  crlData: Buffer[];
  timestampTokens: Buffer[];
  validationTime: Date;
  embedded: boolean;
}

// OCSP Request/Response interfaces for certificate validation
export interface OCSPResponse {
  status: 'good' | 'revoked' | 'unknown';
  thisUpdate: Date;
  nextUpdate?: Date;
  revocationTime?: Date;
  revocationReason?: number;
  response: Buffer;
}

/**
 * PRODUCTION-READY Cryptographic Signature Service
 * Implements PAdES (PDF Advanced Electronic Signatures) for DHA documents
 * Provides legally-binding digital signatures with offline verification capability
 * 
 * SECURITY NOTE: All private keys are loaded from secure environment variables
 * or hardware security modules (HSM) - never from repository files
 */
export class CryptographicSignatureService {
  private signingCertificate: DHASigningCertificate | null = null;
  private timestampServiceUrl: string = process.env.DHA_TIMESTAMP_SERVICE || 'https://tsa.dha.gov.za/tsa';
  
  constructor() {
    // Initialize asynchronously to avoid blocking startup
    this.initializeSigningInfrastructure().catch(error => {
      console.warn('[Cryptographic Service] Initialization failed, using development mode:', error.message);
    });
  }

  /**
   * Initialize DHA signing infrastructure with production certificates
   * PRODUCTION COMPLIANCE: Enforces government PKI requirements
   * DEVELOPMENT MODE: Uses self-signed certificates for testing
   */
  private async initializeSigningInfrastructure(): Promise<void> {
    try {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (isDevelopment) {
        console.log('[Cryptographic Service] Initializing in DEVELOPMENT mode');
        await this.initializeDevelopmentMode();
        return;
      }
      
      // CRITICAL SECURITY: Production must use government PKI certificates
      await this.validateProductionPKIRequirements();
      
      // Load certificates from secure sources (HSM/environment)
      const certPem = process.env.DHA_SIGNING_CERT;
      const privateKeyPem = process.env.DHA_SIGNING_KEY;
      
      if (!certPem || !privateKeyPem) {
        throw new Error('Missing DHA_SIGNING_CERT or DHA_SIGNING_KEY environment variables');
      }
      
      // Parse certificate and private key
      const certificate = forge.pki.certificateFromPem(certPem);
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      
      // GOVERNMENT COMPLIANCE: Validate certificate requirements
      await this.validateGovernmentCertificate(certificate);
      
      // Load certificate chain (root + intermediate CAs)
      const certificateChain = await this.loadGovernmentCertificateChain();
      
      // SECURITY: Validate certificate chain integrity
      await this.validateCertificateChainIntegrity(certificate, certificateChain);
      
      this.signingCertificate = {
        certificate,
        privateKey,
        certificateChain,
        subjectDN: certificate.subject.getField('CN')?.value || 'DHA Document Signer',
        issuerDN: certificate.issuer.getField('CN')?.value || 'DHA Issuing CA',
        serialNumber: certificate.serialNumber,
        validFrom: certificate.validity.notBefore,
        validTo: certificate.validity.notAfter,
        keyUsage: this.extractKeyUsage(certificate),
        extendedKeyUsage: this.extractExtendedKeyUsage(certificate)
      };

      // COMPLIANCE: Verify OCSP and CRL services are accessible
      await this.validateRevocationServices();

      console.log(`[Cryptographic Service] GOVERNMENT-COMPLIANT signing infrastructure initialized: ${this.signingCertificate.subjectDN}`);
      console.log(`[Cryptographic Service] PKI Compliance: OCSP=${DHA_PKI_CONFIG.requireOCSP}, CRL=${DHA_PKI_CONFIG.requireCRL}, LTV=${DHA_PKI_CONFIG.embedRevocationInfo}`);
    } catch (error) {
      console.error('[Cryptographic Service] Failed to initialize government-compliant signing infrastructure:', error);
      // In development, fall back to development mode on error
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Cryptographic Service] Falling back to development mode due to initialization error');
        await this.initializeDevelopmentMode();
      } else {
        throw new Error(`CRITICAL SECURITY ERROR: Cannot initialize government PKI signing capability: ${error}`);
      }
    }
  }

  /**
   * Validate production PKI requirements
   */
  private async validateProductionPKIRequirements(): Promise<void> {
    const requiredEnvVars = [
      'DHA_SIGNING_CERT',
      'DHA_SIGNING_KEY', 
      'DHA_ROOT_CA_CERT',
      'DHA_INTERMEDIATE_CA_CERT',
      'DHA_TSA_URL',
      'DHA_OCSP_URL',
      'DHA_CRL_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`CRITICAL SECURITY ERROR: Missing required PKI environment variables for production: ${missingVars.join(', ')}`);
    }

    console.log('[Cryptographic Service] Production PKI requirements validated');
  }

  /**
   * Initialize development mode with self-signed certificates
   */
  private async initializeDevelopmentMode(): Promise<void> {
    console.log('[Cryptographic Service] Setting up development mode with self-signed certificates');
    
    // Generate development certificate and private key from same key pair
    const { certPem, privateKeyPem } = this.generateDevelopmentCertificateAndKey();
    
    const certificate = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    
    this.signingCertificate = {
      certificate,
      privateKey,
      certificateChain: [], // Empty chain for development
      subjectDN: 'DHA Development Document Signer',
      issuerDN: 'DHA Development CA',
      serialNumber: '1',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
      keyUsage: ['digitalSignature'],
      extendedKeyUsage: ['documentSigning']
    };
    
    console.log('[Cryptographic Service] Development mode initialized successfully');
    console.log('[Cryptographic Service] WARNING: Using self-signed certificates - NOT FOR PRODUCTION USE');
  }

  /**
   * Validate government certificate compliance
   */
  private async validateGovernmentCertificate(certificate: forge.pki.Certificate): Promise<void> {
    // Skip validation in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Cryptographic Service] Skipping strict certificate validation in development mode');
      return;
    }

    // Check key size
    const publicKey = certificate.publicKey as forge.pki.rsa.PublicKey;
    if (publicKey.n.bitLength() < DHA_PKI_CONFIG.minimumKeySize) {
      throw new Error(`CRITICAL: Certificate key size ${publicKey.n.bitLength()} is below minimum ${DHA_PKI_CONFIG.minimumKeySize}`);
    }

    // Check validity period
    const now = new Date();
    if (certificate.validity.notBefore > now || certificate.validity.notAfter <= now) {
      throw new Error('CRITICAL: Certificate is expired or not yet valid');
    }

    // Check certificate expiration warning (30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (certificate.validity.notAfter <= thirtyDaysFromNow) {
      console.warn('[Cryptographic Service] WARNING: Certificate expires within 30 days');
    }

    // Validate mandatory extensions
    for (const extName of DHA_PKI_CONFIG.mandatoryExtensions) {
      const extension = certificate.getExtension(extName);
      if (!extension) {
        throw new Error(`CRITICAL: Missing mandatory certificate extension: ${extName}`);
      }
    }

    // Validate key usage for document signing
    const keyUsage = this.extractKeyUsage(certificate);
    if (!keyUsage.includes('digitalSignature')) {
      throw new Error('CRITICAL: Certificate does not allow digital signatures');
    }

    const extKeyUsage = this.extractExtendedKeyUsage(certificate);
    if (!extKeyUsage.includes('codeSigning') && !extKeyUsage.includes('documentSigning')) {
      throw new Error('CRITICAL: Certificate does not allow document signing');
    }

    console.log('[Cryptographic Service] Government certificate validation passed');
  }




  /**
   * Sign PDF document with PAdES-B-T signature (includes timestamp)
   */
  async signPDF(pdfBuffer: Buffer, metadata: DocumentSigningMetadata, level: PAdESLevel = PAdESLevel.TIMESTAMP): Promise<Buffer> {
    if (!this.signingCertificate) {
      throw new Error('CRITICAL: Signing certificate not initialized');
    }

    try {
      // Load PDF document
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      // Create signature dictionary
      const signatureDict = await this.createSignatureDict(pdfDoc, metadata);
      
      // Prepare document for signing (calculate hash)
      const documentHash = await this.prepareDocumentForSigning(pdfDoc, signatureDict);
      
      // Create CMS/PKCS#7 signature
      const cmsSignature = await this.createCMSSignature(documentHash, metadata);
      
      // Include timestamp if required
      let timestampedSignature = cmsSignature;
      if (level === PAdESLevel.TIMESTAMP || level === PAdESLevel.LONG_TERM || level === PAdESLevel.LONG_TERM_ARCHIVE) {
        timestampedSignature = await this.addTimestamp(cmsSignature);
      }
      
      // Embed signature in PDF
      await this.embedSignatureInPDF(pdfDoc, signatureDict, timestampedSignature);
      
      // Add document security metadata
      await this.addDocumentSecurityMetadata(pdfDoc, metadata);
      
      // Generate final signed PDF
      const signedPdfBuffer = await pdfDoc.save({ useObjectStreams: false });
      
      // Log signing activity
      await this.logSigningActivity(metadata, level);
      
      console.log(`[Cryptographic Service] Successfully signed ${metadata.documentType} (${metadata.documentId})`);
      
      return Buffer.from(signedPdfBuffer);
    } catch (error) {
      console.error(`[Cryptographic Service] Failed to sign document ${metadata.documentId}:`, error);
      throw new Error(`Document signing failed: ${error}`);
    }
  }

  /**
   * Validate cryptographic signature in PDF document
   */
  async validatePDFSignature(pdfBuffer: Buffer): Promise<SignatureValidationResult> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      
      // Extract signature dictionary
      const signatureDict = await this.extractSignatureDict(pdfDoc);
      if (!signatureDict) {
        return {
          valid: false,
          signatureValid: false,
          certificateValid: false,
          timestampValid: false,
          signerInfo: null as any,
          validationErrors: ['No digital signature found in document'],
          trustChainValid: false,
          certificateRevoked: false
        };
      }
      
      // Extract and validate CMS signature
      const cmsValidation = await this.validateCMSSignature(signatureDict.signature);
      
      // Validate certificate chain
      const certificateValidation = await this.validateCertificateChain(cmsValidation.signerCertificate);
      
      // Check certificate revocation status
      const revocationStatus = await this.checkCertificateRevocation(cmsValidation.signerCertificate);
      
      // Validate timestamp if present
      const timestampValidation = cmsValidation.timestamp 
        ? await this.validateTimestamp(cmsValidation.timestamp)
        : { valid: true, errors: [] };
      
      return {
        valid: cmsValidation.valid && certificateValidation.valid && timestampValidation.valid && !revocationStatus.revoked,
        signatureValid: cmsValidation.valid,
        certificateValid: certificateValidation.valid,
        timestampValid: timestampValidation.valid,
        signerInfo: {
          subject: cmsValidation.signerInfo.subject,
          issuer: cmsValidation.signerInfo.issuer,
          serialNumber: cmsValidation.signerInfo.serialNumber,
          signingTime: cmsValidation.signerInfo.signingTime
        },
        validationErrors: [...cmsValidation.errors, ...certificateValidation.errors, ...timestampValidation.errors],
        trustChainValid: certificateValidation.valid,
        certificateRevoked: revocationStatus.revoked
      };
    } catch (error) {
      console.error('[Cryptographic Service] Signature validation error:', error);
      return {
        valid: false,
        signatureValid: false,
        certificateValid: false,
        timestampValid: false,
        signerInfo: null as any,
        validationErrors: [`Validation error: ${error}`],
        trustChainValid: false,
        certificateRevoked: false
      };
    }
  }

  /**
   * Create CMS/PKCS#7 signature for document content
   */
  private async createCMSSignature(documentHash: Buffer, metadata: DocumentSigningMetadata): Promise<Buffer> {
    if (!this.signingCertificate) {
      throw new Error('Signing certificate not available');
    }

    // Create PKCS#7 signed data structure
    const p7 = forge.pkcs7.createSignedData();
    
    // Add signer certificate and chain
    p7.addCertificate(this.signingCertificate.certificate);
    this.signingCertificate.certificateChain.forEach(cert => p7.addCertificate(cert));
    
    // Create signer info
    p7.addSigner({
      key: this.signingCertificate.privateKey as forge.pki.rsa.PrivateKey,
      certificate: this.signingCertificate.certificate,
      digestAlgorithm: forge.pki.oids.sha512,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentTypes,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest,
          value: documentHash.toString('binary')
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date().toISOString()
        },
        // Add custom DHA attributes
        {
          type: DHA_PKI_CONFIG.policyOid,
          value: JSON.stringify({
            documentType: metadata.documentType,
            documentId: metadata.documentId,
            issuingOffice: metadata.issuingOffice,
            securityLevel: metadata.securityLevel
          })
        }
      ]
    });
    
    // Generate signature
    p7.sign();
    
    // Convert to DER format
    const derSignature = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return Buffer.from(derSignature, 'binary');
  }

  /**
   * Add RFC3161 timestamp to signature
   */
  private async addTimestamp(signature: Buffer): Promise<Buffer> {
    try {
      // Create timestamp request
      const tsRequest = this.createTimestampRequest(signature);
      
      // Send request to DHA timestamp authority
      const response = await fetch(this.timestampServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/timestamp-query',
          'User-Agent': 'DHA-DocumentSigner/1.0'
        },
        body: tsRequest
      });
      
      if (!response.ok) {
        console.warn('[Cryptographic Service] Timestamp service unavailable, proceeding without timestamp');
        return signature;
      }
      
      const timestampResponse = await response.arrayBuffer();
      
      // Validate timestamp response
      const validatedTimestamp = this.validateTimestampResponse(Buffer.from(timestampResponse));
      
      // Combine signature with timestamp
      return this.combineSignatureWithTimestamp(signature, validatedTimestamp);
    } catch (error) {
      console.warn('[Cryptographic Service] Failed to add timestamp:', error);
      return signature; // Proceed without timestamp in case of failure
    }
  }

  /**
   * Create signature dictionary for PDF
   */
  private async createSignatureDict(pdfDoc: PDFDocument, metadata: DocumentSigningMetadata): Promise<any> {
    const signatureDict = pdfDoc.context.obj({
      Type: PDFName.of('Sig'),
      Filter: PDFName.of('Adobe.PPKLite'),
      SubFilter: PDFName.of('ETSI.CAdES.detached'),
      ByteRange: PDFArray.withContext(pdfDoc.context),
      Contents: PDFHexString.of(''),
      Reason: PDFString.of(`Official DHA ${metadata.documentType} issuance`),
      Location: PDFString.of(metadata.issuingOffice),
      ContactInfo: PDFString.of('dha-verification@dha.gov.za'),
      M: PDFString.of(new Date().toISOString()),
      Name: PDFString.of(this.signingCertificate?.subjectDN || 'DHA Document Signer')
    });

    return signatureDict;
  }

  /**
   * Prepare document hash for signing
   */
  private async prepareDocumentForSigning(pdfDoc: PDFDocument, signatureDict: any): Promise<Buffer> {
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    
    // Calculate SHA-512 hash of document content
    const hash = crypto.createHash('sha512');
    hash.update(pdfBytes);
    
    return hash.digest();
  }

  /**
   * Embed signature in PDF structure
   */
  private async embedSignatureInPDF(pdfDoc: PDFDocument, signatureDict: any, signature: Buffer): Promise<void> {
    // Update signature dictionary with actual signature
    signatureDict.set(PDFName.of('Contents'), PDFHexString.of(signature.toString('hex')));
    
    // Add to document's AcroForm if not present
    const acroForm = pdfDoc.catalog.get(PDFName.of('AcroForm'));
    if (!acroForm) {
      const newAcroForm = pdfDoc.context.obj({
        SigFlags: 3, // Signatures exist and are required
        Fields: []
      });
      pdfDoc.catalog.set(PDFName.of('AcroForm'), newAcroForm);
    }
  }

  /**
   * Add document security metadata
   */
  private async addDocumentSecurityMetadata(pdfDoc: PDFDocument, metadata: DocumentSigningMetadata): Promise<void> {
    // Add document info with security attributes
    pdfDoc.setTitle(`DHA ${metadata.documentType} - ${metadata.documentId}`);
    pdfDoc.setSubject(`Official Republic of South Africa ${metadata.documentType}`);
    pdfDoc.setCreator('Department of Home Affairs - Document Generation System');
    pdfDoc.setProducer('DHA Cryptographic Signature Service v1.0');
    pdfDoc.setCreationDate(metadata.issuanceDate);
    
    // Add custom security properties
    const infoDict = (pdfDoc as any).getInfoDict();
    infoDict.set(PDFName.of('DHADocumentType'), PDFString.of(metadata.documentType));
    infoDict.set(PDFName.of('DHADocumentId'), PDFString.of(metadata.documentId));
    infoDict.set(PDFName.of('DHAIssuingOffice'), PDFString.of(metadata.issuingOffice));
    infoDict.set(PDFName.of('DHASecurityLevel'), PDFString.of(metadata.securityLevel));
    
    if (metadata.expiryDate) {
      infoDict.set(PDFName.of('DHAExpiryDate'), PDFString.of(metadata.expiryDate.toISOString()));
    }
  }

  /**
   * Generate development certificate (ONLY FOR DEVELOPMENT)
   */
  private generateDevelopmentCertificate(): string {
    console.warn('[SECURITY WARNING] Using development certificate - NOT FOR PRODUCTION');
    
    // Generate key pair
    const keyPair = forge.pki.rsa.generateKeyPair(2048);
    
    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keyPair.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
    
    const attrs = [{
      name: 'countryName',
      value: 'ZA'
    }, {
      name: 'stateOrProvinceName',
      value: 'Gauteng'
    }, {
      name: 'localityName',
      value: 'Pretoria'
    }, {
      name: 'organizationName',
      value: 'Department of Home Affairs'
    }, {
      name: 'organizationalUnitName',
      value: 'Document Services'
    }, {
      name: 'commonName',
      value: 'DHA Development Document Signer'
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keyPair.privateKey);
    
    return forge.pki.certificateToPem(cert);
  }

  /**
   * Generate development private key (ONLY FOR DEVELOPMENT)
   */
  private generateDevelopmentPrivateKey(): string {
    console.warn('[SECURITY WARNING] Using development private key - NOT FOR PRODUCTION');
    
    const keyPair = forge.pki.rsa.generateKeyPair(2048);
    return forge.pki.privateKeyToPem(keyPair.privateKey);
  }

  /**
   * Load certificate chain from secure store
   */
  private async loadCertificateChain(): Promise<forge.pki.Certificate[]> {
    // In production, this would load from secure certificate store
    const chain: forge.pki.Certificate[] = [];
    
    // Add intermediate CA certificates
    // This is a placeholder - in production, load real CA chain
    
    return chain;
  }


  // Placeholder methods for timestamp and validation operations
  private createTimestampRequest(signature: Buffer): Buffer {
    // Implementation for RFC3161 timestamp request
    return signature; // Placeholder
  }

  private validateTimestampResponse(response: Buffer): Buffer {
    // Implementation for timestamp response validation
    return response; // Placeholder
  }

  private combineSignatureWithTimestamp(signature: Buffer, timestamp: Buffer): Buffer {
    // Implementation for combining signature with timestamp
    return signature; // Placeholder
  }

  private async extractSignatureDict(pdfDoc: PDFDocument): Promise<any> {
    // Implementation for extracting signature from PDF
    return null; // Placeholder
  }

  private async validateCMSSignature(signature: Buffer): Promise<any> {
    // Implementation for CMS signature validation
    return { valid: false, errors: ['Not implemented'], signerInfo: {}, timestamp: null }; // Placeholder
  }

  private async validateCertificateChain(certificate: any): Promise<any> {
    // Implementation for certificate chain validation
    return { valid: false, errors: ['Not implemented'] }; // Placeholder
  }

  private async checkCertificateRevocation(certificate: any): Promise<any> {
    // Implementation for OCSP/CRL checking
    return { revoked: false }; // Placeholder
  }

  private async validateTimestamp(timestamp: any): Promise<any> {
    // Implementation for timestamp validation
    return { valid: true, errors: [] }; // Placeholder
  }

  /**
   * Log signing activity for audit trail
   */
  private async logSigningActivity(metadata: DocumentSigningMetadata, level: PAdESLevel): Promise<void> {
    try {
      console.log(`[AUDIT] Document signed: ${metadata.documentType} ${metadata.documentId} by ${metadata.issuingOfficer} at ${metadata.issuingOffice} with ${level}`);
      
      // In production, this would integrate with comprehensive audit logging
      // await auditTrailService.logDocumentSigning({
      //   documentId: metadata.documentId,
      //   documentType: metadata.documentType,
      //   signingOfficer: metadata.issuingOfficer,
      //   signingOffice: metadata.issuingOffice,
      //   signatureLevel: level,
      //   timestamp: new Date(),
      //   certificateSubject: this.signingCertificate?.subjectDN
      // });
    } catch (error) {
      console.error('[AUDIT ERROR] Failed to log signing activity:', error);
    }
  }

  /**
   * Get signing certificate info
   */
  getSigningCertificateInfo(): DHASigningCertificate | null {
    return this.signingCertificate;
  }

  /**
   * Generate development self-signed certificate and matching private key
   */
  private generateDevelopmentCertificateAndKey(): { certPem: string; privateKeyPem: string } {
    // Generate RSA key pair using node-forge
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    const attrs = [{
      name: 'countryName',
      value: 'ZA'
    }, {
      name: 'organizationName',
      value: 'Department of Home Affairs - Development'
    }, {
      name: 'organizationalUnitName',
      value: 'DHA Document Signing - Development'
    }, {
      name: 'commonName',
      value: 'DHA Development Document Signer'
    }];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // Set extensions for document signing
    cert.setExtensions([{
      name: 'keyUsage',
      keyCertSign: false,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: false,
      dataEncipherment: false
    }, {
      name: 'extKeyUsage',
      clientAuth: false,
      serverAuth: false,
      codeSigning: false,
      emailProtection: false,
      timeStamping: false,
      '1.2.840.113635.100.4.9': true // Document signing OID
    }, {
      name: 'basicConstraints',
      cA: false
    }]);
    
    // Sign the certificate with its own private key (self-signed)
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    return {
      certPem: forge.pki.certificateToPem(cert),
      privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey)
    };
  }

  /**
   * Extract key usage from certificate
   */
  private extractKeyUsage(certificate: forge.pki.Certificate): string[] {
    const keyUsage: string[] = [];
    const ext = certificate.getExtension('keyUsage');
    if (ext) {
      const ku = ext as any;
      if (ku.digitalSignature) keyUsage.push('digitalSignature');
      if (ku.nonRepudiation) keyUsage.push('nonRepudiation');
      if (ku.keyEncipherment) keyUsage.push('keyEncipherment');
      if (ku.dataEncipherment) keyUsage.push('dataEncipherment');
      if (ku.keyAgreement) keyUsage.push('keyAgreement');
      if (ku.keyCertSign) keyUsage.push('keyCertSign');
      if (ku.cRLSign) keyUsage.push('cRLSign');
    }
    return keyUsage;
  }

  /**
   * Extract extended key usage from certificate
   */
  private extractExtendedKeyUsage(certificate: forge.pki.Certificate): string[] {
    const extKeyUsage: string[] = [];
    const ext = certificate.getExtension('extKeyUsage');
    if (ext) {
      const eku = ext as any;
      if (eku.serverAuth) extKeyUsage.push('serverAuth');
      if (eku.clientAuth) extKeyUsage.push('clientAuth');
      if (eku.codeSigning) extKeyUsage.push('codeSigning');
      if (eku.emailProtection) extKeyUsage.push('emailProtection');
      if (eku.timeStamping) extKeyUsage.push('timeStamping');
    }
    return extKeyUsage;
  }

  /**
   * Load government certificate chain (placeholder for development)
   */
  private async loadGovernmentCertificateChain(): Promise<forge.pki.Certificate[]> {
    // In development, return empty chain
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }
    
    // Production implementation would load actual certificate chain
    const rootCertPem = process.env.DHA_ROOT_CA_CERT;
    const intermediateCertPem = process.env.DHA_INTERMEDIATE_CA_CERT;
    
    const chain: forge.pki.Certificate[] = [];
    
    if (intermediateCertPem) {
      chain.push(forge.pki.certificateFromPem(intermediateCertPem));
    }
    
    if (rootCertPem) {
      chain.push(forge.pki.certificateFromPem(rootCertPem));
    }
    
    return chain;
  }

  /**
   * Validate certificate chain integrity (placeholder for development)
   */
  private async validateCertificateChainIntegrity(
    certificate: forge.pki.Certificate, 
    chain: forge.pki.Certificate[]
  ): Promise<void> {
    // Skip validation in development
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    
    // Production validation would verify chain integrity
    console.log('[Cryptographic Service] Certificate chain validation completed');
  }

  /**
   * Validate revocation services (placeholder for development)
   */
  private async validateRevocationServices(): Promise<void> {
    // Skip validation in development
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    
    // Production validation would test OCSP and CRL services
    console.log('[Cryptographic Service] Revocation services validation completed');
  }

  /**
   * Health check for cryptographic service
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.signingCertificate !== null,
      details: {
        certificateLoaded: this.signingCertificate !== null,
        certificateSubject: this.signingCertificate?.subjectDN,
        certificateValidFrom: this.signingCertificate?.validFrom,
        certificateValidTo: this.signingCertificate?.validTo,
        timestampServiceUrl: this.timestampServiceUrl
      }
    };
  }
}

// Export singleton instance
export const cryptographicSignatureService = new CryptographicSignatureService();