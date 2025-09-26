/**
 * ENHANCED AUTHENTIC SOUTH AFRICAN DOCUMENT GENERATORS
 * Based on official DHA document templates provided by Raeesa Osman (admin)
 * Implements exact design specifications from authentic SA government documents
 */

import PDFDocument from "pdfkit";
import * as crypto from "crypto";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
// import { createCanvas } from "canvas"; // Temporarily disabled due to compilation issues
import { BaseDocumentTemplate, SA_GOVERNMENT_DESIGN } from "./base-document-template";
import { SecurityFeaturesV2, MRZData } from "./security-features-v2";

// Import schema types
import type {
  BirthCertificateData,
  CertificateOfSouthAfricanCitizenshipData,
  SouthAfricanPassportData,
  RefugeeTravelDocumentData
} from "../../shared/schema";

type PDFKit = InstanceType<typeof PDFDocument>;

// Enhanced SA Government Design Constants (Based on Authentic Templates)
export const AUTHENTIC_SA_DESIGN = {
  ...SA_GOVERNMENT_DESIGN,
  colors: {
    ...SA_GOVERNMENT_DESIGN.colors,
    // Authentic asylum permit colors from provided templates
    asylum_orange: "#FF9500",
    asylum_beige: "#FFF4E6",
    asylum_red_stamp: "#CC0000",
    
    // Birth certificate authentic colors
    birth_green: "#006633",
    birth_gold_border: "#FFD700",
    birth_watermark: "#E8F5E8",
    
    // Citizenship certificate colors
    citizenship_navy: "#003366", 
    citizenship_eagle_gold: "#B8860B",
    
    // Passport authentic colors
    passport_sa_green: "#007748",
    passport_gold: "#FFC72C",
    passport_navy: "#003B7F"
  }
};

/**
 * Enhanced Asylum Seeker Temporary Permit Generator
 * Based on authentic DHA templates (IMG_6604/6603)
 */
export class EnhancedAsylumSeekerPermitGenerator extends BaseDocumentTemplate {
  async generateDocument(data: RefugeeTravelDocumentData, isPreview: boolean = false): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: 'Asylum Seeker Temporary Permit',
            Author: 'Department of Home Affairs - Republic of South Africa',
            Subject: 'Asylum Seeker Temporary Permit',
            Creator: 'DHA Authentic Document Generation System v2.0'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Authentic DHA background (orange/beige theme from template)
        doc.save();
        doc.rect(0, 0, 595, 842)
           .fill(AUTHENTIC_SA_DESIGN.colors.asylum_beige);
        doc.restore();

        // Top orange header bar (authentic design)
        doc.save();
        doc.rect(0, 0, 595, 80)
           .fill(AUTHENTIC_SA_DESIGN.colors.asylum_orange);
        doc.restore();

        // DHA Logo and Header (exact positioning from template)
        doc.save();
        doc.rect(30, 15, 50, 50)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.white)
           .lineWidth(2)
           .stroke();
        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.white)
           .text("DHA\nLOGO", 40, 35, { width: 30, align: "center" });
        doc.restore();

        // Government headers (authentic positioning)
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.white)
           .text("DEPARTMENT OF HOME AFFAIRS", 100, 25);
           
        doc.fontSize(12)
           .text("REPUBLIC OF SOUTH AFRICA", 100, 45);

        // Document title in orange box
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.white)
           .text("ASYLUM SEEKER TEMPORARY PERMIT", 30, 100, { align: "center", width: 535 });

        let yPos = 140;

        // Personal particulars section header
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("A. PERSONAL PARTICULARS OF HOLDER", 50, yPos);
           
        yPos += 30;

        // Draw main content box (authentic layout)
        doc.save();
        doc.rect(50, yPos, 495, 350)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.asylum_orange)
           .lineWidth(2)
           .stroke();
        doc.restore();

        yPos += 20;

        // Personal information (authentic field layout)
        this.addAuthenticField(doc, "Full Name:", data.personal.fullName, 60, yPos);
        yPos += 35;

        this.addAuthenticField(doc, "Date of Birth:", this.formatSADate(data.personal.dateOfBirth), 60, yPos);
        yPos += 35;

        this.addAuthenticField(doc, "Country of Origin:", data.countryOfOrigin, 60, yPos);
        yPos += 35;

        this.addAuthenticField(doc, "Permit Number:", data.refugeeNumber, 60, yPos);
        yPos += 35;

        this.addAuthenticField(doc, "Date of Issue:", this.formatSADate(data.dateOfIssue), 60, yPos);
        yPos += 35;

        this.addAuthenticField(doc, "Valid Until:", this.formatSADate(data.dateOfExpiry), 60, yPos);
        yPos += 35;

        // Photo placeholder (exact positioning from template)
        doc.save();
        doc.rect(420, 180, 90, 110)
           .fill(AUTHENTIC_SA_DESIGN.colors.white)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.black)
           .lineWidth(2)
           .stroke();
        
        doc.fontSize(10)
           .fillColor(AUTHENTIC_SA_DESIGN.colors.security_blue)
           .text("PHOTOGRAPH", 440, 230, { width: 50, align: "center" });
        doc.restore();

        // Conditions section (authentic layout)
        yPos = 330;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("B. CONDITIONS", 60, yPos);
           
        yPos += 25;

        const conditions = [
          "This permit is valid only for the period indicated above",
          "The holder is not permitted to work without proper authorization",
          "The holder must report to the nearest DHA office if circumstances change",
          "This permit does not confer any rights of permanent residence"
        ];

        conditions.forEach((condition, index) => {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
             .text(`${index + 1}. ${condition}`, 60, yPos, { width: 420 });
          yPos += 20;
        });

        // Official stamp area (authentic positioning)
        doc.save();
        doc.rect(350, 500, 150, 60)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.asylum_red_stamp)
           .lineWidth(2)
           .stroke();
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.asylum_red_stamp)
           .text("OFFICIAL STAMP", 380, 525, { width: 90, align: "center" });
        doc.restore();

        // Security features
        yPos = 600;
        
        // QR Code
        const qrCode = await this.generateQRCode({ 
          ...data, 
          documentType: "asylum_seeker_permit",
          securityLevel: "high"
        });
        if (qrCode) {
          const qrBuffer = Buffer.from(qrCode.replace('data:image/png;base64,', ''), 'base64');
          doc.image(qrBuffer, 60, yPos, { width: 60, height: 60 });
        }

        // Barcode
        const barcodeData = await this.generateBarcode(data.refugeeNumber);
        if (barcodeData) {
          const barcodeBuffer = Buffer.from(barcodeData.replace('data:image/png;base64,', ''), 'base64');
          doc.image(barcodeBuffer, 300, yPos + 30, { width: 200, height: 30 });
        }

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  private addAuthenticField(doc: PDFKit, label: string, value: string, x: number, y: number): void {
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(AUTHENTIC_SA_DESIGN.colors.security_blue)
       .text(label, x, y);
       
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
       .text(value || "____________________", x + 120, y);
  }
}

/**
 * Enhanced Unabridged Birth Certificate Generator
 * Based on authentic DHA templates (multiple birth certificate images)
 */
export class EnhancedUnabridgedBirthCertificateGenerator extends BaseDocumentTemplate {
  async generateDocument(data: BirthCertificateData, isPreview: boolean = false): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: 'Unabridged Birth Certificate',
            Author: 'Department of Home Affairs - Republic of South Africa',
            Subject: 'Official Unabridged Birth Certificate',
            Creator: 'DHA Authentic Document Generation System v2.0'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Authentic watermark background
        doc.save();
        doc.rect(0, 0, 595, 842)
           .fill(AUTHENTIC_SA_DESIGN.colors.birth_watermark);
        doc.restore();

        // Header with coat of arms (authentic positioning)
        let yPos = 40;
        
        // SA Coat of Arms (centered, authentic size)
        doc.save();
        doc.rect(267, yPos, 60, 60)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.birth_green)
           .lineWidth(2)
           .stroke();
        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.birth_green)
           .text("COAT OF\nARMS", 282, yPos + 25, { width: 30, align: "center" });
        doc.restore();
        
        yPos += 80;

        // Government headers (authentic layout)
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("REPUBLIC OF SOUTH AFRICA", 50, yPos, { align: "center", width: 495 });
           
        yPos += 25;
        doc.fontSize(12)
           .fillColor(AUTHENTIC_SA_DESIGN.colors.birth_green)
           .text("DEPARTMENT OF HOME AFFAIRS", 50, yPos, { align: "center", width: 495 });
           
        yPos += 30;

        // Document number (top right, authentic positioning)
        doc.fontSize(10)
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text(`H ${data.registrationNumber}`, 450, 50);

        // Title section
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.birth_green)
           .text("UNABRIDGED", 50, yPos, { align: "center", width: 495 });
           
        yPos += 25;
        doc.fontSize(16)
           .text("BIRTH CERTIFICATE", 50, yPos, { align: "center", width: 495 });
           
        yPos += 40;

        // Particulars from the population register header
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.security_blue)
           .text("PARTICULARS FROM THE POPULATION REGISTER I.R.O.:", 50, yPos);
           
        yPos += 30;

        // Main content border (authentic design)
        doc.save();
        doc.rect(50, yPos, 495, 400)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.birth_green)
           .lineWidth(2)
           .stroke();
        doc.restore();

        yPos += 20;

        // Child section
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("CHILD", 60, yPos);
           
        yPos += 25;

        this.addBirthField(doc, "IDENTITY NUMBER:", "To be allocated", 60, yPos);
        yPos += 25;
        const fullNameParts = data.childFullName.split(' ');
        const surname = fullNameParts[fullNameParts.length - 1];
        const forenames = fullNameParts.slice(0, -1).join(' ');
        this.addBirthField(doc, "SURNAME:", surname, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "FORENAMES:", forenames, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "GENDER:", data.sex, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "DATE OF BIRTH:", this.formatSADate(data.dateOfBirth), 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "PLACE OF BIRTH:", data.placeOfBirth, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "COUNTRY OF BIRTH:", "SOUTH AFRICA", 60, yPos);
        yPos += 35;

        // Mother section
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("MOTHER", 60, yPos);
           
        yPos += 25;
        this.addBirthField(doc, "IDENTITY NUMBER/TRAVEL DOC:", "_______________", 60, yPos);
        yPos += 25;
        const motherNameParts = data.motherFullName.split(' ');
        const motherSurname = motherNameParts[motherNameParts.length - 1];
        const motherForenames = motherNameParts.slice(0, -1).join(' ');
        this.addBirthField(doc, "MAIDEN/SURNAME:", motherSurname, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "FORENAMES:", motherForenames, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "DATE OF BIRTH:", "_______________", 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "PLACE OF BIRTH:", "_______________", 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "COUNTRY OF BIRTH:", data.motherNationality || "SOUTH AFRICA", 60, yPos);
        yPos += 35;

        // Father section
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("FATHER", 60, yPos);
           
        yPos += 25;
        this.addBirthField(doc, "IDENTITY NUMBER/TRAVEL DOC:", "_______________", 60, yPos);
        yPos += 25;
        const fatherNameParts = data.fatherFullName.split(' ');
        const fatherSurname = fatherNameParts[fatherNameParts.length - 1];
        const fatherForenames = fatherNameParts.slice(0, -1).join(' ');
        this.addBirthField(doc, "SURNAME:", fatherSurname, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "FORENAMES:", fatherForenames, 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "DATE OF BIRTH:", "_______________", 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "PLACE OF BIRTH:", "_______________", 60, yPos);
        yPos += 25;
        this.addBirthField(doc, "COUNTRY OF BIRTH:", data.fatherNationality || "_______________", 60, yPos);

        // Bottom section with stamps and signatures
        yPos = 620;
        
        // Official stamp area (left side)
        doc.save();
        doc.rect(60, yPos, 120, 80)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.birth_green)
           .lineWidth(1)
           .stroke();
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.birth_green)
           .text("OFFICIAL DATE STAMP", 90, yPos + 35, { width: 60, align: "center" });
        doc.restore();

        // Director signature area
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("_________________________________", 300, yPos + 40);
        doc.fontSize(9)
           .text("DIRECTOR-GENERAL: HOME AFFAIRS", 330, yPos + 60);

        // Date printed
        doc.fontSize(9)
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text(`DATE PRINTED: ${new Date().toISOString().split('T')[0].replace(/-/g, '')}`, 60, yPos + 100);

        // Issued by code
        doc.fontSize(9)
           .text(`ISSUED BY: DHA001`, 400, yPos + 100);

        // Security features
        const qrCode = await this.generateQRCode({ 
          ...data, 
          documentType: "unabridged_birth_certificate",
          securityLevel: "maximum"
        });
        if (qrCode) {
          const qrBuffer = Buffer.from(qrCode.replace('data:image/png;base64,', ''), 'base64');
          doc.image(qrBuffer, 450, yPos - 60, { width: 50, height: 50 });
        }

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  private addBirthField(doc: PDFKit, label: string, value: string, x: number, y: number): void {
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
       .text(label, x, y, { width: 200 });
       
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(value || "____________________", x + 200, y);
  }
}

/**
 * Enhanced Certificate of South African Citizenship Generator
 * Based on authentic DHA template (IMG_6599)
 */
export class EnhancedCitizenshipCertificateGenerator extends BaseDocumentTemplate {
  async generateDocument(data: CertificateOfSouthAfricanCitizenshipData, isPreview: boolean = false): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: 'Certificate of South African Citizenship',
            Author: 'Department of Home Affairs - Republic of South Africa',
            Subject: 'Official Certificate of South African Citizenship',
            Creator: 'DHA Authentic Document Generation System v2.0'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Certificate number (top right)
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text(`1631`, 500, 50);

        let yPos = 80;

        // SA Eagle/Coat of Arms (centered, authentic positioning)
        doc.save();
        doc.rect(267, yPos, 60, 60)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.citizenship_eagle_gold)
           .lineWidth(2)
           .stroke();
        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.citizenship_eagle_gold)
           .text("SA EAGLE\nEMBLEM", 282, yPos + 25, { width: 30, align: "center" });
        doc.restore();
        
        yPos += 80;

        // Elegant government headers (authentic typography)
        doc.fontSize(16)
           .font('Times-Italic')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("Republic of South Africa", 50, yPos, { align: "center", width: 495 });
           
        yPos += 30;
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.citizenship_navy)
           .text("Department of Home Affairs", 50, yPos, { align: "center", width: 495 });
           
        yPos += 50;

        // Main title (authentic design)
        doc.fontSize(20)
           .font('Times-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("Certificate of South African Citizenship", 50, yPos, { align: "center", width: 495 });
           
        yPos += 30;

        // Legal reference (authentic positioning)
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.security_blue)
           .text("(Section 10, South African Citizenship Act 1995)", 50, yPos, { align: "center", width: 495 });
           
        yPos += 50;

        // Certificate text (authentic legal language)
        const purposeText = data.certificateText?.purposeStatement || 
          "This certificate is issued for the sole purpose of indicating the status of the person concerned on the date of issue.";
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text(purposeText, 50, yPos, { width: 495, align: "justify" });
           
        yPos += 40;

        // Certification statement (authentic wording)
        const certificationText = `It is hereby certified that ${data.holder.fullName} concerning whose particulars are set out below, is a South African citizen by ${data.certificateText?.citizenshipType || 'birth/descent/naturalisation'}.`;
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(certificationText, 50, yPos, { width: 495, align: "justify" });
           
        yPos += 50;

        // Particulars section header
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("PARTICULARS RELATING TO HOLDER", 50, yPos);
           
        yPos += 20;

        // Box for particulars (authentic design)
        doc.save();
        doc.rect(50, yPos, 495, 150)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.black)
           .lineWidth(1)
           .stroke();
        doc.restore();
        
        yPos += 20;

        // Holder details (authentic layout)
        this.addCitizenshipField(doc, "Name", data.holder.fullName, 60, yPos);
        yPos += 25;
        this.addCitizenshipField(doc, "Place of birth", data.holder.placeOfBirth, 60, yPos);
        yPos += 25;
        this.addCitizenshipField(doc, "Date of birth", this.formatSADate(data.holder.dateOfBirth), 60, yPos);
        yPos += 25;
        this.addCitizenshipField(doc, "Identity number", data.holder.identityNumber, 60, yPos);
        yPos += 25;
        this.addCitizenshipField(doc, "Particulars", data.holder.particulars || "N/A", 60, yPos);
        yPos += 25;
        this.addCitizenshipField(doc, "Reference number", data.referenceNumber, 60, yPos);
        
        yPos += 60;

        // "By order of the Minister" (authentic positioning)
        doc.fontSize(10)
           .font('Helvetica-Oblique')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("By order of the Minister", 50, yPos);
           
        yPos += 40;

        // Department signature area (authentic layout)
        doc.fontSize(10)
           .font('Helvetica')
           .text("Department of Home Affairs", 50, yPos);
        doc.text("PRETORIA", 50, yPos + 15);
        
        // Director signature line
        doc.text("_________________________________", 300, yPos + 20);
        doc.fontSize(9)
           .text("Director-General: Home Affairs", 330, yPos + 40);

        // Date (authentic positioning)
        doc.fontSize(10)
           .text(`Date: ${this.formatSADate(data.issuingDate)}`, 50, yPos + 60);

        // Official stamp indication
        doc.save();
        doc.circle(450, yPos + 30, 30)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.stamping_blue)
           .lineWidth(2)
           .stroke();
        doc.fontSize(8)
           .fillColor(AUTHENTIC_SA_DESIGN.colors.stamping_blue)
           .text("OFFICIAL\nSTAMP", 430, yPos + 20, { width: 40, align: "center" });
        doc.restore();

        // Security QR Code
        const qrCode = await this.generateQRCode({ 
          ...data, 
          documentType: "certificate_of_south_african_citizenship",
          securityLevel: "maximum"
        });
        if (qrCode) {
          const qrBuffer = Buffer.from(qrCode.replace('data:image/png;base64,', ''), 'base64');
          doc.image(qrBuffer, 50, 750, { width: 50, height: 50 });
        }

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  private addCitizenshipField(doc: PDFKit, label: string, value: string, x: number, y: number): void {
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
       .text(`${label}:`, x, y, { width: 150 });
       
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(value || "____________________", x + 150, y);
  }
}

/**
 * Enhanced South African Passport Generator
 * Based on authentic SA passport template (IMG_6619)
 */
export class EnhancedSouthAfricanPassportGenerator extends BaseDocumentTemplate {
  async generateDocument(data: SouthAfricanPassportData, isPreview: boolean = false): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [125, 88], // Passport booklet size in mm converted to points
          margin: 10,
          info: {
            Title: 'South African Passport',
            Author: 'Department of Home Affairs - Republic of South Africa',
            Subject: 'Official South African Passport',
            Creator: 'DHA Authentic Document Generation System v2.0'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Authentic passport background (green theme)
        doc.save();
        doc.rect(0, 0, 354, 250) // Passport dimensions
           .fill(AUTHENTIC_SA_DESIGN.colors.passport_sa_green);
        doc.restore();

        let yPos = 20;

        // SA Coat of Arms (top center, authentic positioning)
        doc.save();
        doc.rect(152, yPos, 50, 50)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.passport_gold)
           .lineWidth(2)
           .stroke();
        doc.fontSize(6)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.passport_gold)
           .text("COAT OF\nARMS", 165, yPos + 20, { width: 24, align: "center" });
        doc.restore();
        
        yPos += 60;

        // "REPUBLIC OF SOUTH AFRICA" (authentic typography)
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.white)
           .text("REPUBLIC OF SOUTH AFRICA", 20, yPos, { align: "center", width: 314 });
           
        yPos += 20;
        doc.fontSize(10)
           .text("REPUBLIEK VAN SUID-AFRIKA", 20, yPos, { align: "center", width: 314 });
           
        yPos += 30;

        // "PASSPORT" title (authentic design)
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.passport_gold)
           .text("PASSPORT", 20, yPos, { align: "center", width: 314 });
           
        yPos += 20;
        doc.fontSize(14)
           .text("PASPOORT", 20, yPos, { align: "center", width: 314 });

        // Photo area (right side, authentic positioning)
        doc.save();
        doc.rect(250, 90, 80, 100)
           .fill(AUTHENTIC_SA_DESIGN.colors.white)
           .strokeColor(AUTHENTIC_SA_DESIGN.colors.black)
           .lineWidth(1)
           .stroke();
        doc.fontSize(8)
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text("PHOTO", 275, 135, { width: 30, align: "center" });
        doc.restore();

        // Personal information (left side, authentic layout)
        yPos = 100;
        const leftX = 20;

        doc.fontSize(7)
           .font('Helvetica')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.white)
           .text("Type/Tipe", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text("P", leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .font('Helvetica')
           .text("Country code/Landkode", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text("ZAF", leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .text("Passport No./Paspoort Nr.", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(data.passportNumber, leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .text("Surname/Van", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(data.personal.surname, leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .text("Given names/Voornaam", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(data.personal.givenNames, leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .text("Nationality/Nasionaliteit", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text("SOUTH AFRICAN", leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .text("Date of birth/Geboortedatum", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(this.formatSADate(data.personal.dateOfBirth), leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .text("Sex/Geslag", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(data.personal.gender, leftX + 60, yPos);
        
        yPos += 15;
        doc.fontSize(7)
           .text("Place of birth/Geboorplek", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(data.personal.placeOfBirth, leftX + 60, yPos);

        // Bottom section with dates
        yPos = 200;
        doc.fontSize(7)
           .text("Date of issue/Uitgiftedatum", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(this.formatSADate(data.dateOfIssue), leftX + 60, yPos);
        
        doc.fontSize(7)
           .text("Date of expiry/Vervaldatum", leftX + 150, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text(this.formatSADate(data.dateOfExpiry), leftX + 210, yPos);

        // Authority
        yPos += 15;
        doc.fontSize(7)
           .text("Authority/Gesag", leftX, yPos);
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text("ZAF", leftX + 60, yPos);

        // MRZ Area (Machine Readable Zone) - authentic passport feature
        yPos = 220;
        doc.save();
        doc.rect(20, yPos, 314, 25)
           .fill(AUTHENTIC_SA_DESIGN.colors.white);
        doc.restore();

        // Generate authentic MRZ
        const mrz1 = `P<ZAF${data.personal.surname.replace(/\s/g, '').toUpperCase()}<<${data.personal.givenNames.replace(/\s/g, '').toUpperCase()}`;
        const mrz2 = `${data.passportNumber}ZAF${data.personal.dateOfBirth.replace(/-/g, '').slice(2)}${data.personal.gender[0]}${data.dateOfExpiry.replace(/-/g, '').slice(2)}`;

        doc.fontSize(8)
           .font('Courier-Bold')
           .fillColor(AUTHENTIC_SA_DESIGN.colors.black)
           .text(mrz1.substring(0, 44), 22, yPos + 3);
        doc.text(mrz2.substring(0, 44), 22, yPos + 13);

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export enhanced generators
export const enhancedAuthenticGenerators = {
  EnhancedAsylumSeekerPermitGenerator,
  EnhancedUnabridgedBirthCertificateGenerator,
  EnhancedCitizenshipCertificateGenerator,
  EnhancedSouthAfricanPassportGenerator
};

export default enhancedAuthenticGenerators;