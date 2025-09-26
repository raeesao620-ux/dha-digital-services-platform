/**
 * BASE DOCUMENT TEMPLATE CLASS
 * Shared base class for all document generators with security features
 */

import PDFDocument from "pdfkit";
import * as crypto from "crypto";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
// import { Canvas } from "canvas"; // Temporarily disabled due to compilation issues
import { 
  SecurityFeaturesV2, 
  UVFeature, 
  BrailleConfig, 
  HolographicEffect, 
  MRZData,
  BiometricFeatures,
  SpecialInkEffects,
  DataMatrixConfig
} from "./security-features-v2";
import { ICAOMRZGenerator, MRZGenerationOptions } from "./icao-mrz-generator";
import { cryptographicSignatureService } from "./cryptographic-signature-service";

type PDFKit = InstanceType<typeof PDFDocument>;

// Official South African government colors and design constants
export const SA_GOVERNMENT_DESIGN = {
  colors: {
    // Official South African flag colors
    green: "#007749",        // Official SA green - primary color
    gold: "#FCB514",         // Official SA gold/yellow
    red: "#DE3831",          // Official SA red
    blue: "#001489",         // Official SA blue
    black: "#000000",
    white: "#FFFFFF",
    
    // Security feature colors
    security_red: "#CC0000",
    security_blue: "#0066CC",
    security_green: "#006600",
    microprint_gray: "#808080",
    hologram_silver: "#C0C0C0",
    
    // Document-specific backgrounds
    light_teal: "#E8F5F0",   // Light green/teal backgrounds
    watermark: "#F0F8F5",    // Very light green for watermarks
    stamping_blue: "#003366" // Deep blue for official stamps
  },
  
  fonts: {
    header: "Helvetica-Bold",
    body: "Helvetica",
    official: "Times-Bold",
    microtext: "Helvetica"
  },
  
  dimensions: {
    page_width: 595.28,      // A4 width in points
    page_height: 841.89,     // A4 height in points
    margin: 50,
    security_border: 20,
    barcode_height: 30,
    qr_size: 80
  }
} as const;

/**
 * Base document template class with shared rendering methods
 */
export abstract class BaseDocumentTemplate {
  
  constructor() {}
  
  /**
   * Generate and add ICAO compliant MRZ
   */
  protected addMRZ(doc: PDFKit, options: MRZGenerationOptions, x: number, y: number): void {
    const mrzLines = ICAOMRZGenerator.generate(options);
    
    doc.save();
    doc.fontSize(8)
       .font('Courier') // Monospace font for MRZ
       .fillColor(SA_GOVERNMENT_DESIGN.colors.black);
    
    mrzLines.forEach((line, index) => {
      doc.text(line, x, y + (index * 12), {
        characterSpacing: 1,
        wordSpacing: 0
      });
    });
    
    doc.restore();
  }

  /**
   * Apply comprehensive digital signature to PDF
   */
  protected async applyDigitalSignature(pdfBuffer: Buffer, metadata: any): Promise<Buffer> {
    try {
      return await cryptographicSignatureService.signDocument(pdfBuffer, {
        documentId: metadata.documentId,
        documentType: metadata.documentType,
        issuingOfficer: metadata.issuingOfficer,
        timestamp: new Date(),
        level: 'PAdES-B-LTV' // CRITICAL: Use LTV for flawless verification
      });
    } catch (error) {
      console.error('Digital signature failed:', error);
      return pdfBuffer; // Return unsigned PDF if signing fails
    }
  }

  /**
   * Add comprehensive security features
   */
  protected addComprehensiveSecurityFeatures(doc: PDFKit, documentType: string, isPreview: boolean = false): void {
    if (isPreview) return; // Skip security features in preview mode
    
    // Add watermarks
    this.addSecurityWatermarks(doc);
    
    // Add microtext security borders
    this.addMicrotextBorders(doc);
    
    // Add guilloche patterns
    this.addGuillochePatterns(doc);
    
    // Add UV-reactive elements (simulated)
    this.addUVReactiveElements(doc);
    
    // Add holographic simulation
    this.addHolographicSimulation(doc);
  }

  /**
   * Add security watermarks
   */
  protected addSecurityWatermarks(doc: PDFKit): void {
    doc.save();
    doc.fontSize(60)
       .font(SA_GOVERNMENT_DESIGN.fonts.header)
       .fillColor(SA_GOVERNMENT_DESIGN.colors.watermark)
       .opacity(0.1)
       .text('REPUBLIC OF SOUTH AFRICA', 50, 300, {
         rotate: 45,
         align: 'center'
       });
    doc.restore();
  }

  /**
   * Add microtext security borders
   */
  protected addMicrotextBorders(doc: PDFKit): void {
    const microtext = 'DEPARTMENT OF HOME AFFAIRS REPUBLIC OF SOUTH AFRICA '.repeat(50);
    
    doc.save();
    doc.fontSize(4)
       .font(SA_GOVERNMENT_DESIGN.fonts.microtext)
       .fillColor(SA_GOVERNMENT_DESIGN.colors.microprint_gray);
    
    // Top border
    doc.text(microtext, 20, 10, { width: 555, height: 10, ellipsis: false });
    
    // Bottom border  
    doc.text(microtext, 20, 820, { width: 555, height: 10, ellipsis: false });
    
    doc.restore();
  }

  /**
   * Add guilloche security patterns
   */
  protected addGuillochePatterns(doc: PDFKit): void {
    doc.save();
    doc.strokeColor(SA_GOVERNMENT_DESIGN.colors.security_blue)
       .lineWidth(0.5)
       .opacity(0.3);
    
    // Create guilloche pattern
    for (let i = 0; i < 20; i++) {
      const x = 50 + (i * 25);
      const y = 150;
      
      doc.circle(x, y, 15)
         .stroke();
      
      doc.circle(x + 10, y + 10, 10)
         .stroke();
    }
    
    doc.restore();
  }

  /**
   * Add UV-reactive elements (simulated)
   */
  protected addUVReactiveElements(doc: PDFKit): void {
    doc.save();
    doc.fontSize(12)
       .font(SA_GOVERNMENT_DESIGN.fonts.body)
       .fillColor(SA_GOVERNMENT_DESIGN.colors.security_green)
       .opacity(0.2)
       .text('UV SECURE', 450, 200, { rotate: 25 });
    doc.restore();
  }

  /**
   * Add holographic simulation
   */
  protected addHolographicSimulation(doc: PDFKit): void {
    doc.save();
    doc.rect(450, 250, 80, 60)
       .strokeColor(SA_GOVERNMENT_DESIGN.colors.hologram_silver)
       .lineWidth(2)
       .stroke();
    
    doc.fontSize(8)
       .font(SA_GOVERNMENT_DESIGN.fonts.body)
       .fillColor(SA_GOVERNMENT_DESIGN.colors.hologram_silver)
       .text('HOLOGRAM', 460, 275);
    
    doc.restore();
  }

  /**
   * Draw official South African Coat of Arms
   */
  protected drawOfficialCoatOfArms(doc: PDFKit, x: number, y: number, width: number, height: number): void {
    doc.save();
    
    // Main shield outline
    doc.moveTo(x + width/2, y)
       .lineTo(x + width * 0.8, y + height * 0.3)
       .lineTo(x + width * 0.8, y + height * 0.7)
       .lineTo(x + width/2, y + height)
       .lineTo(x + width * 0.2, y + height * 0.7)
       .lineTo(x + width * 0.2, y + height * 0.3)
       .closePath()
       .strokeColor(SA_GOVERNMENT_DESIGN.colors.green)
       .fillColor(SA_GOVERNMENT_DESIGN.colors.light_teal)
       .fillAndStroke();
    
    // Central elements - traditional patterns
    doc.circle(x + width/2, y + height * 0.4, width * 0.15)
       .strokeColor(SA_GOVERNMENT_DESIGN.colors.gold)
       .lineWidth(1.5)
       .stroke();
    
    // Crown/protea elements
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5;
      const px = x + width/2 + Math.cos(angle) * width * 0.25;
      const py = y + height * 0.2 + Math.sin(angle) * height * 0.15;
      doc.circle(px, py, 2)
         .fillColor(SA_GOVERNMENT_DESIGN.colors.gold)
         .fill();
    }
    
    // Banner with "Unity Work Progress"
    doc.fontSize(4)
       .font(SA_GOVERNMENT_DESIGN.fonts.official)
       .fillColor(SA_GOVERNMENT_DESIGN.colors.black)
       .text('!KE E: /XARRA //KE', x + width * 0.1, y + height * 0.85, {
         width: width * 0.8,
         align: 'center'
       });
    
    doc.restore();
  }

  /**
   * Draw official DHA stamp
   */
  protected drawOfficialDHAStamp(doc: PDFKit, x: number, y: number, radius: number): void {
    doc.save();
    
    // Outer circle
    doc.circle(x, y, radius)
       .strokeColor(SA_GOVERNMENT_DESIGN.colors.stamping_blue)
       .lineWidth(2)
       .stroke();
    
    // Inner circle
    doc.circle(x, y, radius - 5)
       .strokeColor(SA_GOVERNMENT_DESIGN.colors.stamping_blue)
       .lineWidth(1)
       .stroke();
    
    // DHA text
    doc.fontSize(6)
       .font(SA_GOVERNMENT_DESIGN.fonts.header)
       .fillColor(SA_GOVERNMENT_DESIGN.colors.stamping_blue)
       .text('DEPT OF HOME', x - 15, y - 8, { width: 30, align: 'center' });
    
    doc.fontSize(5)
       .text('AFFAIRS', x - 12, y - 2, { width: 24, align: 'center' });
    
    doc.fontSize(4)
       .text('REP OF SA', x - 10, y + 4, { width: 20, align: 'center' });
    
    // Date stamp
    const today = new Date().toLocaleDateString('en-ZA', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    doc.fontSize(3)
       .text(today, x - 8, y + 10, { width: 16, align: 'center' });
    
    doc.restore();
  }

  /**
   * Add official SA government header
   */
  protected addGovernmentHeader(doc: PDFKit, documentTitle: string, formNumber?: string): void {
    const { colors, fonts, dimensions } = SA_GOVERNMENT_DESIGN;
    
    // Background header bar
    doc.save();
    doc.rect(0, 0, dimensions.page_width, 100)
       .fill(colors.light_teal);
    doc.restore();
    
    // SA Coat of Arms (official design implementation)
    this.drawOfficialCoatOfArms(doc, 30, 20, 60, 60);
    
    // Official government headers
    doc.fontSize(16)
       .font(fonts.header)
       .fillColor(colors.black)
       .text("REPUBLIC OF SOUTH AFRICA", 110, 25);
    
    doc.fontSize(14)
       .font(fonts.official)
       .fillColor(colors.green)
       .text("DEPARTMENT OF HOME AFFAIRS", 110, 48);
       
    // Document title
    doc.fontSize(12)
       .font(fonts.header)
       .fillColor(colors.blue)
       .text(documentTitle.toUpperCase(), 110, 72);
    
    // Form number (if provided)
    if (formNumber) {
      doc.fontSize(10)
         .font(fonts.body)
         .fillColor(colors.security_blue)
         .text(`Form ${formNumber}`, 450, 25);
    }
    
    // Official stamp placeholder (top right)
    doc.save();
    doc.circle(520, 50, 25)
       .strokeColor(colors.stamping_blue)
       .lineWidth(2)
       .stroke();
    doc.fontSize(8)
       .fillColor(colors.stamping_blue)
       .text("OFFICIAL\nSTAMP", 505, 45, { width: 30, align: "center" });
    doc.restore();
  }
  
  /**
   * Add comprehensive security background with all Tier 1-4 features
   */
  protected addSecurityBackground(doc: PDFKit, isPreview: boolean = false): void {
    const { colors, dimensions } = SA_GOVERNMENT_DESIGN;
    
    // Light security background
    doc.save();
    doc.rect(0, 0, dimensions.page_width, dimensions.page_height)
       .fill(colors.watermark);
    
    // Guilloche pattern
    SecurityFeaturesV2.addGuillochePattern(
      doc,
      dimensions.margin,
      dimensions.margin,
      dimensions.page_width - (dimensions.margin * 2),
      40
    );
    
    // Watermark text
    doc.save();
    doc.translate(100, 400);
    doc.rotate(-45, { origin: [0, 0] });
    doc.fontSize(40)
       .font(SA_GOVERNMENT_DESIGN.fonts.header)
       .fillColor(colors.watermark)
       .fillOpacity(0.1)
       .text("REPUBLIC OF SOUTH AFRICA", 0, 0);
    doc.restore();
    
    doc.restore();
  }
  
  /**
   * Add bilingual field (English/Afrikaans)
   */
  protected addBilingualField(doc: PDFKit, labelKey: string, value: string, x: number, y: number): void {
    const { colors, fonts } = SA_GOVERNMENT_DESIGN;
    
    const labels = this.getBilingualLabels(labelKey);
    
    // English label
    doc.fontSize(9)
       .font(fonts.body)
       .fillColor(colors.security_blue)
       .text(labels.en, x, y);
    
    // Afrikaans label
    doc.fontSize(8)
       .font(fonts.body)
       .fillColor(colors.security_green)
       .text(labels.af, x, y + 12);
    
    // Value
    doc.fontSize(11)
       .font(fonts.header)
       .fillColor(colors.black)
       .text(value, x + 120, y + 3);
  }
  
  /**
   * Get bilingual labels for common fields
   */
  private getBilingualLabels(key: string): { en: string; af: string } {
    const labels: Record<string, { en: string; af: string }> = {
      full_name: { en: "Full Name", af: "Volledige Naam" },
      id_number: { en: "ID Number", af: "ID Nommer" },
      date_of_birth: { en: "Date of Birth", af: "Geboortedatum" },
      place_of_birth: { en: "Place of Birth", af: "Geboorteplek" },
      nationality: { en: "Nationality", af: "Nasionaliteit" },
      passport_number: { en: "Passport Number", af: "Paspoort Nommer" },
      card_number: { en: "Card Number", af: "Kaart Nommer" },
      permit_number: { en: "Permit Number", af: "Permit Nommer" },
      valid_from: { en: "Valid From", af: "Geldig Van" },
      valid_until: { en: "Valid Until", af: "Geldig Tot" },
      occupation: { en: "Occupation", af: "Beroep" },
      employer: { en: "Employer", af: "Werkgewer" },
      conditions: { en: "Conditions", af: "Voorwaardes" }
    };
    
    return labels[key] || { en: key, af: key };
  }
  
  /**
   * Add microtext security feature
   */
  protected addMicrotext(doc: PDFKit, x: number, y: number): void {
    const { colors, fonts } = SA_GOVERNMENT_DESIGN;
    
    doc.save();
    doc.fontSize(4)
       .font(fonts.microtext)
       .fillColor(colors.microprint_gray);
    
    const microtext = "REPUBLIC OF SOUTH AFRICA DEPARTMENT OF HOME AFFAIRS ";
    const repeatedText = microtext.repeat(20);
    
    doc.text(repeatedText, x, y, { width: 450, height: 20 });
    doc.restore();
  }
  
  /**
   * Generate QR code for verification
   */
  protected async generateQRCode(data: any): Promise<string> {
    try {
      const qrData = JSON.stringify({
        type: data.documentType,
        id: data.documentId || crypto.randomUUID(),
        issued: new Date().toISOString(),
        hash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16)
      });
      
      return await QRCode.toDataURL(qrData, {
        width: SA_GOVERNMENT_DESIGN.dimensions.qr_size,
        margin: 2,
        color: {
          dark: SA_GOVERNMENT_DESIGN.colors.black,
          light: SA_GOVERNMENT_DESIGN.colors.white
        }
      });
    } catch (error) {
      console.error("QR Code generation failed:", error);
      return "";
    }
  }
  
  /**
   * Generate barcode for document
   */
  protected async generateBarcode(value: string): Promise<string> {
    try {
      const canvas = new Canvas(200, SA_GOVERNMENT_DESIGN.dimensions.barcode_height);
      JsBarcode(canvas, value, {
        format: "CODE128",
        width: 1,
        height: SA_GOVERNMENT_DESIGN.dimensions.barcode_height,
        displayValue: false
      });
      
      return canvas.toDataURL();
    } catch (error) {
      console.error("Barcode generation failed:", error);
      return "";
    }
  }
  
  /**
   * Format date according to SA standards
   */
  protected formatSADate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return dateString;
    }
  }
  
  /**
   * Generate unique serial number
   */
  protected generateSerialNumber(prefix: string = "ZA"): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
  
  /**
   * Apply comprehensive security features based on document type
   */
  protected async applyComprehensiveSecurityFeatures(
    doc: PDFKit,
    documentType: string,
    data: any,
    isPreview: boolean = false
  ): Promise<void> {
    const config = SecurityFeaturesV2.getDocumentSecurityConfig(documentType);
    const { dimensions } = SA_GOVERNMENT_DESIGN;
    
    // Add comprehensive microprinting patterns first (background layer)
    SecurityFeaturesV2.addComprehensiveMicroprinting(
      doc,
      documentType,
      dimensions.page_width,
      dimensions.page_height
    );
    
    // Add biometric features for ID documents and permits
    if (documentType.includes('id') || documentType.includes('passport') || documentType.includes('permit')) {
      const biometricFeatures: any = {
        photo: {
          width: 150,
          height: 200,
          borderStyle: 'official',
          position: { x: dimensions.page_width - 200, y: 120 }
        },
        fingerprints: documentType.includes('permit') ? {
          count: 2,
          ridgePattern: 'whorl',
          position: { x: 50, y: 350 }
        } : null,
        iris: documentType.includes('passport') ? {
          scanPattern: 'radial',
          uniqueId: crypto.randomBytes(8).toString('hex').toUpperCase(),
          position: { x: 100, y: 280 }
        } : null,
        chip: documentType.includes('id') || documentType.includes('passport') ? {
          type: 'dual',
          encodedData: data.documentNumber || 'ENCRYPTED',
          position: { x: dimensions.page_width - 100, y: 350 }
        } : null,
        faceRecognition: documentType.includes('passport') ? {
          alignmentMarkers: true,
          landmarks: 95,
          position: { x: 50, y: 400 }
        } : null
      };
      SecurityFeaturesV2.addBiometricFeatures(doc, biometricFeatures);
    }
    
    // Add special ink effects
    const specialInks: any = {
      metallic: {
        type: 'gold',
        element: 'OFFICIAL SEAL',
        position: { x: dimensions.page_width - 200, y: 50 }
      },
      colorShifting: {
        fromColor: '#9400D3',
        toColor: '#00FF00',
        angle: 45,
        element: 'GOVERNMENT OF SA',
        position: { x: 50, y: 80 }
      },
      thermochromic: config.thermochromic ? {
        coldColor: '#0000FF',
        hotColor: '#FF0000',
        temperature: 35,
        element: 'HEAT SENSITIVE',
        position: { x: dimensions.page_width / 2 - 50, y: 100 }
      } : null,
      uvReactive: {
        wavelength: 365,
        glowColor: '#00FFFF',
        overlayOpacity: 0.05
      },
      ovi: {
        primaryColor: '#FF00FF',
        secondaryColor: '#00FFFF',
        tertiaryColor: '#FFFF00',
        viewingAngle: 30,
        position: { x: 300, y: 80 }
      }
    };
    SecurityFeaturesV2.addSpecialInkEffects(doc, specialInks);
    
    // Add enhanced holographic features
    SecurityFeaturesV2.addHolographicCoatOfArms(doc, dimensions.page_width - 150, 40, 80);
    SecurityFeaturesV2.add3DDocumentNumber(doc, data.documentNumber || 'DOC-2024-001', 50, 50);
    SecurityFeaturesV2.addHolographicFoilStrip(doc, 0, dimensions.page_height / 2 - 10, dimensions.page_width, 20);
    SecurityFeaturesV2.addRainbowSeal(doc, dimensions.page_width - 80, 200, 35);
    
    // Add detailed artwork
    SecurityFeaturesV2.addLatentSAFlag(doc, dimensions.page_width / 2 - 50, dimensions.page_height / 2 - 30, 100, 60);
    SecurityFeaturesV2.addIntaglioEffect(doc, documentType.replace(/_/g, ' ').toUpperCase(), 50, 30, 18);
    
    // Add DataMatrix for work permits
    if (documentType.includes('work_permit')) {
      const dataMatrixConfig: any = {
        data: {
          type: documentType,
          id: data.documentNumber || 'WP-2024-001',
          issued: new Date().toISOString(),
          validity: data.validUntil || '2025-12-31'
        },
        errorCorrection: 'H',
        size: 50,
        position: { x: dimensions.page_width - 120, y: dimensions.page_height - 120 }
      };
      await SecurityFeaturesV2.addDataMatrixCode(doc, dataMatrixConfig);
    }
    
    // Tier 1: Visible Security Features
    if (config.uvFeatures) {
      const uvFeatures: UVFeature[] = [
        {
          type: 'pattern',
          content: 'SA Coat of Arms',
          position: { x: dimensions.page_width - 100, y: 50 },
          glowColor: '#00FF00',
          wavelength: 365,
          visibility: 'invisible'
        },
        {
          type: 'serial',
          content: data.serialNumber || this.generateSerialNumber('UV'),
          position: { x: 50, y: dimensions.page_height - 50 },
          glowColor: '#0000FF',
          wavelength: 365,
          visibility: 'invisible'
        },
        {
          type: 'text',
          content: 'REPUBLIC OF SOUTH AFRICA',
          position: { x: dimensions.page_width / 2 - 80, y: 100 },
          glowColor: '#00FF00',
          wavelength: 365,
          visibility: 'semi-visible'
        }
      ];
      SecurityFeaturesV2.addUVFeatures(doc, uvFeatures);
    }
    
    if (config.holographic) {
      const holographicEffect: HolographicEffect = {
        type: 'ovi',
        colors: ['#007749', '#FCB514', '#DE3831'],
        angle: 45,
        animation: 'shift'
      };
      SecurityFeaturesV2.addHolographicEffect(
        doc,
        holographicEffect,
        dimensions.page_width - 150,
        150,
        100,
        30
      );
      
      // Add kinegram for IDs and passports
      if (documentType.includes('id') || documentType.includes('passport')) {
        const kinegramEffect: HolographicEffect = {
          type: 'kinegram',
          colors: ['#C0C0C0', '#FFD700'],
          angle: 0,
          animation: 'rotate'
        };
        SecurityFeaturesV2.addHolographicEffect(
          doc,
          kinegramEffect,
          50,
          200,
          80,
          20
        );
      }
    }
    
    // Tier 2: Tactile Security Features
    if (config.braille) {
      const brailleConfig: BrailleConfig = {
        text: documentType.replace(/_/g, ' ').toUpperCase(),
        grade: 1,
        position: { x: 50, y: dimensions.page_height - 100 },
        dotSize: 1.5,
        spacing: 2
      };
      SecurityFeaturesV2.addBrailleText(doc, brailleConfig);
      
      // Add serial number in contracted braille
      if (data.serialNumber) {
        const serialBraille: BrailleConfig = {
          text: data.serialNumber,
          grade: 2,
          position: { x: 50, y: dimensions.page_height - 80 },
          dotSize: 1,
          spacing: 1.5
        };
        SecurityFeaturesV2.addBrailleText(doc, serialBraille);
      }
    }
    
    // Tier 3: Machine-Readable Features
    if (config.mrz && data.mrzData) {
      const mrzLines = SecurityFeaturesV2.generateMRZ(data.mrzData);
      SecurityFeaturesV2.addMRZToDocument(
        doc,
        mrzLines,
        50,
        dimensions.page_height - 150
      );
    }
    
    if (config.pdf417Barcode) {
      const pdf417Data = SecurityFeaturesV2.generatePDF417Data(data);
      await SecurityFeaturesV2.addPDF417Barcode(
        doc,
        pdf417Data,
        dimensions.page_width - 170,
        dimensions.page_height - 100
      );
    }
    
    // Tier 4: Forensic Security Features
    if (config.microprinting) {
      // Add microtext borders
      SecurityFeaturesV2.addMicroprinting(
        doc,
        'SADHAGENUINEDOCUMENT',
        dimensions.margin,
        dimensions.margin - 5,
        dimensions.page_width - (dimensions.margin * 2)
      );
      
      // Add document number in microtext
      if (data.documentNumber) {
        SecurityFeaturesV2.addMicroprinting(
          doc,
          data.documentNumber,
          dimensions.margin,
          dimensions.page_height - dimensions.margin + 5,
          200
        );
      }
    }
    
    if (config.securityThread) {
      SecurityFeaturesV2.addSecurityThread(
        doc,
        dimensions.page_width / 2,
        100,
        dimensions.page_height - 200
      );
    }
    
    if (config.invisibleFibers) {
      SecurityFeaturesV2.addInvisibleFibers(
        doc,
        dimensions.margin,
        dimensions.margin,
        dimensions.page_width - (dimensions.margin * 2),
        dimensions.page_height - (dimensions.margin * 2)
      );
    }
    
    // Special Pattern Features
    if (config.guilloche) {
      SecurityFeaturesV2.addGuillochePattern(
        doc,
        dimensions.margin,
        150,
        dimensions.page_width - (dimensions.margin * 2),
        60
      );
    }
    
    if (config.antiCopy) {
      SecurityFeaturesV2.addAntiCopyPattern(
        doc,
        0,
        0,
        dimensions.page_width,
        dimensions.page_height
      );
    }
    
    if (config.voidPantograph) {
      SecurityFeaturesV2.addVoidPantograph(
        doc,
        dimensions.margin,
        dimensions.margin,
        dimensions.page_width - (dimensions.margin * 2),
        dimensions.page_height - (dimensions.margin * 2)
      );
    }
    
    // Document-specific features
    if (config.ghostImage && data.photograph) {
      SecurityFeaturesV2.addGhostImage(
        doc,
        dimensions.page_width - 100,
        300,
        40,
        50
      );
    }
    
    if (config.rainbowPrinting) {
      SecurityFeaturesV2.addRainbowPrinting(
        doc,
        0,
        dimensions.page_height - 30,
        dimensions.page_width,
        30
      );
    }
    
    if (config.thermochromic) {
      SecurityFeaturesV2.addThermochromicInk(
        doc,
        'OFFICIAL',
        dimensions.page_width - 150,
        250
      );
    }
    
    if (config.metameric) {
      SecurityFeaturesV2.addMetamericInk(
        doc,
        'VERIFIED',
        dimensions.page_width - 150,
        280
      );
    }
    
    if (config.perforation) {
      SecurityFeaturesV2.addPerforation(
        doc,
        dimensions.margin,
        dimensions.page_height / 2,
        100,
        data.documentNumber || 'DOC123456'
      );
    }
    
    if (config.embossedSeal) {
      SecurityFeaturesV2.addEmbossedSeal(
        doc,
        dimensions.page_width - 80,
        dimensions.page_height - 80,
        30
      );
    }
    
    if (config.retroreflective) {
      SecurityFeaturesV2.addRetroreflectiveInk(
        doc,
        'SECURE',
        50,
        250
      );
    }
  }
  
  /**
   * Generate MRZ data for documents
   */
  protected generateMRZData(documentType: string, data: any): MRZData | null {
    if (!data.personal) return null;
    
    const formatDate = (date: string): string => {
      const d = new Date(date);
      const year = d.getFullYear().toString().slice(-2);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return year + month + day;
    };
    
    let format: 'TD1' | 'TD2' | 'TD3' = 'TD1';
    let docType = 'I';
    
    if (documentType.includes('passport')) {
      format = 'TD3';
      docType = 'P';
    } else if (documentType.includes('visa')) {
      format = 'TD2';
      docType = 'V';
    }
    
    return {
      format,
      documentType: docType,
      issuingState: 'ZAF',
      surname: data.personal.surname || data.personal.fullName?.split(' ')[0] || 'SURNAME',
      givenNames: data.personal.givenNames || data.personal.fullName?.split(' ').slice(1).join(' ') || 'GIVEN',
      documentNumber: data.documentNumber || data.permitNumber || data.passportNumber || 'A12345678',
      nationality: 'ZAF',
      dateOfBirth: formatDate(data.personal.dateOfBirth || '1990-01-01'),
      sex: data.personal.gender || 'M',
      dateOfExpiry: formatDate(data.expiryDate || data.validUntil || '2030-12-31'),
      personalNumber: data.idNumber || data.personal.idNumber
    };
  }
  
  /**
   * Abstract method for document-specific generation
   */
  abstract generateDocument(data: any, isPreview?: boolean): Promise<Buffer>;
}