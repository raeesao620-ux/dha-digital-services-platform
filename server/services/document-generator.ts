import { storage } from "../storage";
import { 
  InsertCertificate, InsertPermit, Certificate, Permit, DocumentTemplate,
  InsertBirthCertificate, InsertMarriageCertificate, InsertPassport, 
  InsertDeathCertificate, InsertWorkPermit, InsertPermanentVisa, InsertIdCard,
  BirthCertificate, MarriageCertificate, Passport, DeathCertificate, 
  WorkPermit, PermanentVisa, IdCard, InsertDocumentVerification
} from "@shared/schema";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR || "./documents";
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || "./templates";

// Ensure directories exist
fs.mkdir(DOCUMENTS_DIR, { recursive: true }).catch(console.error);
fs.mkdir(TEMPLATES_DIR, { recursive: true }).catch(console.error);

export interface GenerateDocumentOptions {
  templateType: string;
  title: string;
  description: string;
  data: Record<string, any>;
  expiresAt?: Date;
}

export interface DocumentGenerationResult {
  success: boolean;
  documentId?: string;
  documentUrl?: string;
  verificationCode?: string;
  qrCodeUrl?: string;
  error?: string;
}

export class DocumentGeneratorService {

  /**
   * Generate a new certificate document
   */
  async generateCertificate(
    userId: string,
    type: string,
    options: GenerateDocumentOptions
  ): Promise<DocumentGenerationResult> {
    try {
      // Generate unique identifiers
      const serialNumber = this.generateSerialNumber();
      const verificationCode = this.generateVerificationCode();

      // Create certificate data
      const certificateData: InsertCertificate = {
        userId,
        type,
        title: options.title,
        description: options.description,
        templateType: options.templateType,
        data: options.data,
        serialNumber,
        verificationCode,
        expiresAt: options.expiresAt || null,
        issuedAt: new Date(),
        status: "active",
        qrCodeUrl: null,
        documentUrl: null,
        digitalSignature: null,
        isRevoked: false
      };

      // Generate PDF document
      const pdfResult = await this.generatePDF('certificate', certificateData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      // Generate QR code
      const qrCodeUrl = await this.generateQRCode(verificationCode);

      // Update certificate with URLs
      certificateData.documentUrl = pdfResult.documentUrl;
      certificateData.qrCodeUrl = qrCodeUrl;
      certificateData.digitalSignature = this.generateDigitalSignature(certificateData);

      // Save to storage
      const certificate = await storage.createCertificate(certificateData);

      return {
        success: true,
        documentId: certificate.id,
        documentUrl: certificate.documentUrl || undefined,
        verificationCode: certificate.verificationCode,
        qrCodeUrl: certificate.qrCodeUrl || undefined
      };

    } catch (error) {
      console.error('Error generating certificate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate a new permit document
   */
  async generatePermit(
    userId: string,
    type: string,
    options: GenerateDocumentOptions & { conditions?: Record<string, any> }
  ): Promise<DocumentGenerationResult> {
    try {
      // Generate unique identifiers
      const permitNumber = this.generatePermitNumber();
      const verificationCode = this.generateVerificationCode();

      // Create permit data
      const permitData: InsertPermit = {
        userId,
        type,
        title: options.title,
        description: options.description,
        templateType: options.templateType,
        data: options.data,
        permitNumber,
        verificationCode,
        expiresAt: options.expiresAt || null,
        issuedAt: new Date(),
        status: "active",
        qrCodeUrl: null,
        documentUrl: null,
        conditions: options.conditions || null,
        isRevoked: false
      };

      // Generate PDF document
      const pdfResult = await this.generatePDF('permit', permitData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      // Generate QR code
      const qrCodeUrl = await this.generateQRCode(verificationCode);

      // Update permit with URLs
      permitData.documentUrl = pdfResult.documentUrl;
      permitData.qrCodeUrl = qrCodeUrl;

      // Save to storage
      const permit = await storage.createPermit(permitData);

      return {
        success: true,
        documentId: permit.id,
        documentUrl: permit.documentUrl || undefined,
        verificationCode: permit.verificationCode,
        qrCodeUrl: permit.qrCodeUrl || undefined
      };

    } catch (error) {
      console.error('Error generating permit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate a Birth Certificate
   */
  async generateBirthCertificate(
    userId: string,
    data: Omit<InsertBirthCertificate, 'userId' | 'registrationNumber' | 'verificationCode' | 'documentUrl' | 'qrCodeUrl' | 'digitalSignature' | 'isRevoked' | 'status'>
  ): Promise<DocumentGenerationResult> {
    try {
      const registrationNumber = this.generateRegistrationNumber();
      const verificationCode = this.generateVerificationCode();

      const birthCertData: InsertBirthCertificate = {
        ...data,
        userId,
        registrationNumber,
        verificationCode,
        documentUrl: null,
        qrCodeUrl: null,
        digitalSignature: null,
        securityFeatures: this.generateSecurityFeatures('birth_certificate'),
        status: "active",
        isRevoked: false
      };

      const pdfResult = await this.generateGovernmentPDF('birth_certificate', birthCertData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      const qrCodeUrl = await this.generateQRCode(verificationCode);
      birthCertData.documentUrl = pdfResult.documentUrl;
      birthCertData.qrCodeUrl = qrCodeUrl;
      birthCertData.digitalSignature = this.generateDigitalSignature(birthCertData);

      const certificate = await storage.createBirthCertificate(birthCertData);

      return {
        success: true,
        documentId: certificate.id,
        documentUrl: certificate.documentUrl || undefined,
        verificationCode: certificate.verificationCode,
        qrCodeUrl: certificate.qrCodeUrl || undefined
      };
    } catch (error) {
      console.error('Error generating birth certificate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate a Marriage Certificate
   */
  async generateMarriageCertificate(
    userId: string,
    data: Omit<InsertMarriageCertificate, 'userId' | 'licenseNumber' | 'registrationNumber' | 'verificationCode' | 'documentUrl' | 'qrCodeUrl' | 'digitalSignature' | 'isRevoked' | 'status'>
  ): Promise<DocumentGenerationResult> {
    try {
      const licenseNumber = this.generateLicenseNumber();
      const registrationNumber = this.generateRegistrationNumber();
      const verificationCode = this.generateVerificationCode();

      const marriageCertData: InsertMarriageCertificate = {
        ...data,
        userId,
        licenseNumber,
        registrationNumber,
        verificationCode,
        documentUrl: null,
        qrCodeUrl: null,
        digitalSignature: null,
        securityFeatures: this.generateSecurityFeatures('marriage_certificate'),
        status: "active",
        isRevoked: false
      };

      const pdfResult = await this.generateGovernmentPDF('marriage_certificate', marriageCertData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      const qrCodeUrl = await this.generateQRCode(verificationCode);
      marriageCertData.documentUrl = pdfResult.documentUrl;
      marriageCertData.qrCodeUrl = qrCodeUrl;
      marriageCertData.digitalSignature = this.generateDigitalSignature(marriageCertData);

      const certificate = await storage.createMarriageCertificate(marriageCertData);

      return {
        success: true,
        documentId: certificate.id,
        documentUrl: certificate.documentUrl || undefined,
        verificationCode: certificate.verificationCode,
        qrCodeUrl: certificate.qrCodeUrl || undefined
      };
    } catch (error) {
      console.error('Error generating marriage certificate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate a Passport
   */
  async generatePassport(
    userId: string,
    data: Omit<InsertPassport, 'userId' | 'passportNumber' | 'verificationCode' | 'documentUrl' | 'qrCodeUrl' | 'digitalSignature' | 'isRevoked' | 'status'>
  ): Promise<DocumentGenerationResult> {
    try {
      const passportNumber = this.generatePassportNumber();
      const verificationCode = this.generateVerificationCode();

      const passportData: InsertPassport = {
        ...data,
        userId,
        passportNumber,
        verificationCode,
        documentUrl: null,
        qrCodeUrl: null,
        digitalSignature: null,
        machineReadableZone: this.generateMRZ(data.fullName, passportNumber, data.nationality),
        rfidChipData: this.generateRFIDData(),
        securityFeatures: this.generateSecurityFeatures('passport'),
        status: "active",
        isRevoked: false
      };

      const pdfResult = await this.generateGovernmentPDF('passport', passportData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      const qrCodeUrl = await this.generateQRCode(verificationCode);
      passportData.documentUrl = pdfResult.documentUrl;
      passportData.qrCodeUrl = qrCodeUrl;
      passportData.digitalSignature = this.generateDigitalSignature(passportData);

      const passport = await storage.createPassport(passportData);

      return {
        success: true,
        documentId: passport.id,
        documentUrl: passport.documentUrl || undefined,
        verificationCode: passport.verificationCode,
        qrCodeUrl: passport.qrCodeUrl || undefined
      };
    } catch (error) {
      console.error('Error generating passport:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate a Death Certificate
   */
  async generateDeathCertificate(
    userId: string,
    data: Omit<InsertDeathCertificate, 'userId' | 'registrationNumber' | 'verificationCode' | 'documentUrl' | 'qrCodeUrl' | 'digitalSignature' | 'isRevoked' | 'status'>
  ): Promise<DocumentGenerationResult> {
    try {
      const registrationNumber = this.generateRegistrationNumber();
      const verificationCode = this.generateVerificationCode();

      const deathCertData: InsertDeathCertificate = {
        ...data,
        userId,
        registrationNumber,
        verificationCode,
        documentUrl: null,
        qrCodeUrl: null,
        digitalSignature: null,
        securityFeatures: this.generateSecurityFeatures('death_certificate'),
        status: "active",
        isRevoked: false
      };

      const pdfResult = await this.generateGovernmentPDF('death_certificate', deathCertData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      const qrCodeUrl = await this.generateQRCode(verificationCode);
      deathCertData.documentUrl = pdfResult.documentUrl;
      deathCertData.qrCodeUrl = qrCodeUrl;
      deathCertData.digitalSignature = this.generateDigitalSignature(deathCertData);

      const certificate = await storage.createDeathCertificate(deathCertData);

      return {
        success: true,
        documentId: certificate.id,
        documentUrl: certificate.documentUrl || undefined,
        verificationCode: certificate.verificationCode,
        qrCodeUrl: certificate.qrCodeUrl || undefined
      };
    } catch (error) {
      console.error('Error generating death certificate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate a Work Permit
   */
  async generateWorkPermit(
    userId: string,
    data: Omit<InsertWorkPermit, 'userId' | 'permitNumber' | 'verificationCode' | 'documentUrl' | 'qrCodeUrl' | 'digitalSignature' | 'isRevoked' | 'status'>
  ): Promise<DocumentGenerationResult> {
    try {
      const permitNumber = this.generateWorkPermitNumber();
      const verificationCode = this.generateVerificationCode();

      const workPermitData: InsertWorkPermit = {
        ...data,
        userId,
        permitNumber,
        verificationCode,
        documentUrl: null,
        qrCodeUrl: null,
        digitalSignature: null,
        securityFeatures: this.generateSecurityFeatures('work_permit'),
        status: "active",
        isRevoked: false
      };

      const pdfResult = await this.generateGovernmentPDF('work_permit', workPermitData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      const qrCodeUrl = await this.generateQRCode(verificationCode);
      workPermitData.documentUrl = pdfResult.documentUrl;
      workPermitData.qrCodeUrl = qrCodeUrl;
      workPermitData.digitalSignature = this.generateDigitalSignature(workPermitData);

      const permit = await storage.createWorkPermit(workPermitData);

      return {
        success: true,
        documentId: permit.id,
        documentUrl: permit.documentUrl || undefined,
        verificationCode: permit.verificationCode,
        qrCodeUrl: permit.qrCodeUrl || undefined
      };
    } catch (error) {
      console.error('Error generating work permit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate a Permanent Visa
   */
  async generatePermanentVisa(
    userId: string,
    data: Omit<InsertPermanentVisa, 'userId' | 'visaNumber' | 'verificationCode' | 'documentUrl' | 'qrCodeUrl' | 'digitalSignature' | 'isRevoked' | 'status'>
  ): Promise<DocumentGenerationResult> {
    try {
      const visaNumber = this.generateVisaNumber();
      const verificationCode = this.generateVerificationCode();

      const visaData: InsertPermanentVisa = {
        ...data,
        userId,
        visaNumber,
        verificationCode,
        documentUrl: null,
        qrCodeUrl: null,
        digitalSignature: null,
        fingerprintData: this.generateFingerprintData(),
        securityFeatures: this.generateSecurityFeatures('permanent_visa'),
        status: "active",
        isRevoked: false
      };

      const pdfResult = await this.generateGovernmentPDF('permanent_visa', visaData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      const qrCodeUrl = await this.generateQRCode(verificationCode);
      visaData.documentUrl = pdfResult.documentUrl;
      visaData.qrCodeUrl = qrCodeUrl;
      visaData.digitalSignature = this.generateDigitalSignature(visaData);

      const visa = await storage.createPermanentVisa(visaData);

      return {
        success: true,
        documentId: visa.id,
        documentUrl: visa.documentUrl || undefined,
        verificationCode: visa.verificationCode,
        qrCodeUrl: visa.qrCodeUrl || undefined
      };
    } catch (error) {
      console.error('Error generating permanent visa:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate an ID Card
   */
  async generateIdCard(
    userId: string,
    data: Omit<InsertIdCard, 'userId' | 'idNumber' | 'verificationCode' | 'documentUrl' | 'qrCodeUrl' | 'digitalSignature' | 'isRevoked' | 'status'>
  ): Promise<DocumentGenerationResult> {
    try {
      const idNumber = this.generateIdNumber();
      const verificationCode = this.generateVerificationCode();

      const idCardData: InsertIdCard = {
        ...data,
        userId,
        idNumber,
        verificationCode,
        documentUrl: null,
        qrCodeUrl: null,
        digitalSignature: null,
        rfidChipData: this.generateRFIDData(),
        securityFeatures: this.generateSecurityFeatures('id_card'),
        status: "active",
        isRevoked: false
      };

      const pdfResult = await this.generateGovernmentPDF('id_card', idCardData);
      if (!pdfResult.success) {
        return { success: false, error: pdfResult.error };
      }

      const qrCodeUrl = await this.generateQRCode(verificationCode);
      idCardData.documentUrl = pdfResult.documentUrl;
      idCardData.qrCodeUrl = qrCodeUrl;
      idCardData.digitalSignature = this.generateDigitalSignature(idCardData);

      const idCard = await storage.createIdCard(idCardData);

      return {
        success: true,
        documentId: idCard.id,
        documentUrl: idCard.documentUrl || undefined,
        verificationCode: idCard.verificationCode,
        qrCodeUrl: idCard.qrCodeUrl || undefined
      };
    } catch (error) {
      console.error('Error generating ID card:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate PDF document using PDFKit with official styling
   */
  private async generatePDF(
    documentType: 'certificate' | 'permit',
    data: InsertCertificate | InsertPermit
  ): Promise<{ success: boolean; documentUrl?: string; error?: string }> {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const filename = `${documentType}_${data.verificationCode}.pdf`;
      const filepath = path.join(DOCUMENTS_DIR, filename);
      const writeStream = require('fs').createWriteStream(filepath);

      doc.pipe(writeStream);

      // Add official header with branding
      this.addPDFKitHeader(doc, documentType);

      // Add document content
      if (documentType === 'certificate') {
        this.addPDFKitCertificateContent(doc, data as InsertCertificate);
      } else {
        this.addPDFKitPermitContent(doc, data as InsertPermit);
      }

      // Add footer with verification info
      this.addPDFKitFooter(doc, data.verificationCode);

      // Add security features
      this.addPDFKitSecurityFeatures(doc, data);

      // Finalize the PDF
      doc.end();

      // Wait for write to complete
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return {
        success: true,
        documentUrl: `/documents/${filename}`
      };

    } catch (error) {
      console.error('Error generating PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed'
      };
    }
  }

  /**
   * Generate government PDF for official documents
   */
  private async generateGovernmentPDF(
    documentType: string,
    data: any
  ): Promise<{ success: boolean; documentUrl?: string; error?: string }> {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `DHA ${documentType.replace('_', ' ').toUpperCase()}`,
          Author: 'Department of Home Affairs - Republic of South Africa',
          Subject: `Official ${documentType.replace('_', ' ')}`,
          Creator: 'DHA Document Generation System'
        }
      });

      const filename = `${documentType}_${data.verificationCode}.pdf`;
      const filepath = path.join(DOCUMENTS_DIR, filename);
      const writeStream = require('fs').createWriteStream(filepath);

      doc.pipe(writeStream);

      // Add government header
      this.addGovernmentHeader(doc, documentType);

      // Add document-specific content
      this.addGovernmentDocumentContent(doc, documentType, data);

      // Add government footer
      this.addGovernmentFooter(doc, data.verificationCode);

      // Add security features
      this.addGovernmentSecurityFeatures(doc, data);

      // Finalize the PDF
      doc.end();

      // Wait for write to complete
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      return {
        success: true,
        documentUrl: `/documents/${filename}`
      };

    } catch (error) {
      console.error('Error generating government PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Government PDF generation failed'
      };
    }
  }

  // Helper methods for PDF generation
  private addPDFKitHeader(doc: any, documentType: string): void {
    const pageWidth = doc.page.width;

    doc.rect(0, 0, pageWidth, 60)
       .fillColor('#2980b9')
       .fill();

    const title = documentType === 'certificate' ? 'OFFICIAL CERTIFICATE' : 'OFFICIAL PERMIT';
    doc.fillColor('white')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(title, 0, 20, {
         align: 'center',
         width: pageWidth
       });

    doc.fillColor('black').font('Helvetica');
  }

  private addPDFKitCertificateContent(doc: any, data: InsertCertificate): void {
    const pageWidth = doc.page.width;
    let yPos = 100;

    doc.fontSize(28)
       .font('Helvetica-Bold')
       .text(data.title, 0, yPos, {
         align: 'center',
         width: pageWidth
       });
    yPos += 50;

    doc.fontSize(16)
       .font('Helvetica')
       .text(data.description, 0, yPos, {
         align: 'center',
         width: pageWidth
       });
    yPos += 60;

    doc.fontSize(14);
    doc.text(`Serial Number: ${data.serialNumber}`, 50, yPos);
    yPos += 25;
    doc.text(`Issue Date: ${(data.issuedAt || new Date()).toLocaleDateString()}`, 50, yPos);
    yPos += 25;
    if (data.expiresAt) {
      doc.text(`Expires: ${data.expiresAt.toLocaleDateString()}`, 50, yPos);
      yPos += 25;
    }

    if (data.data && typeof data.data === 'object') {
      yPos += 30;
      Object.entries(data.data).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 50, yPos);
        yPos += 20;
      });
    }
  }

  private addPDFKitPermitContent(doc: any, data: InsertPermit): void {
    const pageWidth = doc.page.width;
    let yPos = 100;

    doc.fontSize(28)
       .font('Helvetica-Bold')
       .text(data.title, 0, yPos, {
         align: 'center',
         width: pageWidth
       });
    yPos += 50;

    doc.fontSize(16)
       .font('Helvetica')
       .text(data.description, 0, yPos, {
         align: 'center',
         width: pageWidth
       });
    yPos += 60;

    doc.fontSize(14);
    doc.text(`Permit Number: ${data.permitNumber}`, 50, yPos);
    yPos += 25;
    doc.text(`Issue Date: ${(data.issuedAt || new Date()).toLocaleDateString()}`, 50, yPos);
    yPos += 25;
    if (data.expiresAt) {
      doc.text(`Expires: ${data.expiresAt.toLocaleDateString()}`, 50, yPos);
      yPos += 25;
    }

    if (data.data && typeof data.data === 'object') {
      yPos += 30;
      Object.entries(data.data).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 50, yPos);
        yPos += 20;
      });
    }
  }

  private addPDFKitFooter(doc: any, verificationCode: string): void {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;

    doc.fontSize(10)
       .fillColor('#666666')
       .text(`Verification Code: ${verificationCode}`, 50, pageHeight - 50);

    doc.text('Verify at: https://dha.gov.za/verify', pageWidth - 250, pageHeight - 50);
  }

  private addPDFKitSecurityFeatures(doc: any, data: any): void {
    // Add watermark
    doc.fontSize(60)
       .fillColor('#EEEEEE')
       .text('DHA OFFICIAL', 100, 300, {
         rotate: 45,
         width: 400,
         align: 'center'
       });
  }

  private addGovernmentHeader(doc: any, documentType: string): void {
    const pageWidth = doc.page.width;

    // SA Government colors
    doc.fillColor('#006747'); // SA Green
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('REPUBLIC OF SOUTH AFRICA', 0, 50, {
         align: 'center',
         width: pageWidth
       });

    doc.fontSize(16)
       .text('DEPARTMENT OF HOME AFFAIRS', 0, 80, {
         align: 'center',
         width: pageWidth
       });

    doc.fontSize(18)
       .fillColor('#000000')
       .text(documentType.replace('_', ' ').toUpperCase(), 0, 120, {
         align: 'center',
         width: pageWidth
       });
  }

  private addGovernmentDocumentContent(doc: any, documentType: string, data: any): void {
    let yPos = 180;

    // Common fields for all government documents
    doc.fontSize(12).fillColor('#000000');

    if (data.fullName) {
      doc.text(`Full Name: ${data.fullName}`, 50, yPos);
      yPos += 20;
    }

    if (data.dateOfBirth) {
      doc.text(`Date of Birth: ${data.dateOfBirth}`, 50, yPos);
      yPos += 20;
    }

    if (data.nationality) {
      doc.text(`Nationality: ${data.nationality}`, 50, yPos);
      yPos += 20;
    }

    // Document-specific fields
    switch (documentType) {
      case 'birth_certificate':
        if (data.placeOfBirth) {
          doc.text(`Place of Birth: ${data.placeOfBirth}`, 50, yPos);
          yPos += 20;
        }
        if (data.registrationNumber) {
          doc.text(`Registration Number: ${data.registrationNumber}`, 50, yPos);
          yPos += 20;
        }
        break;
      case 'passport':
        if (data.passportNumber) {
          doc.text(`Passport Number: ${data.passportNumber}`, 50, yPos);
          yPos += 20;
        }
        if (data.machineReadableZone) {
          doc.fontSize(8).font('Courier');
          doc.text('Machine Readable Zone:', 50, yPos + 10);
          doc.text(data.machineReadableZone, 50, yPos + 25);
          yPos += 50;
        }
        break;
      case 'work_permit':
        if (data.permitNumber) {
          doc.text(`Permit Number: ${data.permitNumber}`, 50, yPos);
          yPos += 20;
        }
        if (data.employer) {
          doc.text(`Employer: ${data.employer}`, 50, yPos);
          yPos += 20;
        }
        break;
    }
  }

  private addGovernmentFooter(doc: any, verificationCode: string): void {
    const pageHeight = doc.page.height;

    doc.fontSize(8)
       .fillColor('#666666')
       .text('This is an official document of the Republic of South Africa', 50, pageHeight - 60);

    doc.text(`Verification Code: ${verificationCode}`, 50, pageHeight - 40);
    doc.text('Verify at: https://www.dha.gov.za/verify', 50, pageHeight - 25);
  }

  private addGovernmentSecurityFeatures(doc: any, data: any): void {
    // Add security watermark
    doc.fontSize(40)
       .fillColor('#E8E8E8')
       .text('DHA OFFICIAL', 150, 400, {
         rotate: -45,
         width: 300,
         align: 'center'
       });
  }

  // Helper methods for generating unique identifiers
  private generateSerialNumber(): string {
    return 'SN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  private generateVerificationCode(): string {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  private generatePermitNumber(): string {
    return 'PN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  private generateRegistrationNumber(): string {
    return 'RN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  private generateLicenseNumber(): string {
    return 'LN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  private generatePassportNumber(): string {
    return 'P' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  private generateIdNumber(): string {
    return Math.floor(Math.random() * 9000000000000) + 1000000000000 + '';
  }

  private generateWorkPermitNumber(): string {
    return 'WP' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }

  private generateVisaNumber(): string {
    return 'V' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  private generateMRZ(fullName: string, passportNumber: string, nationality: string): string {
    const names = fullName.split(' ');
    const surname = names[names.length - 1].toUpperCase();
    const givenNames = names.slice(0, -1).join('<<').toUpperCase();

    const line1 = `P<${nationality.substr(0, 3).toUpperCase()}${surname}<<${givenNames}`;
    const line2 = `${passportNumber}${nationality.substr(0, 3).toUpperCase()}901231M3112314<<<<<<<<<<<<<<04`;

    return line1.substr(0, 44).padEnd(44, '<') + '\n' + line2.substr(0, 44).padEnd(44, '<');
  }

  private generateRFIDData(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateFingerprintData(): string {
    return crypto.randomBytes(64).toString('base64');
  }

  private generateSecurityFeatures(documentType: string): Record<string, any> {
    return {
      documentType,
      securityLevel: 'high',
      watermark: true,
      digitalSignature: true,
      qrCode: true,
      serialNumber: this.generateSerialNumber(),
      timestamp: new Date().toISOString()
    };
  }

  private generateDigitalSignature(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private async generateQRCode(verificationCode: string): Promise<string> {
    try {
      const qrData = `https://dha.gov.za/verify/${verificationCode}`;
      const qrCodeBuffer = await QRCode.toBuffer(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      const filename = `qr_${verificationCode}.png`;
      const filepath = path.join(DOCUMENTS_DIR, filename);
      await fs.writeFile(filepath, qrCodeBuffer);

      return `/documents/${filename}`;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  }
}