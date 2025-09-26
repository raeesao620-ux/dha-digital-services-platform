/**
 * Enhanced Verification Utilities Service
 * Provides comprehensive document verification capabilities including:
 * - 16-character verification codes (XXXX-XXXX-XXXX-XXXX format)
 * - QR codes with full document metadata
 * - Code128 barcode generation
 * - Anti-tampering features with multiple hash locations
 * - Blockchain-style document anchoring
 */

import crypto from 'crypto';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
// import { Canvas, createCanvas } from 'canvas'; // Temporarily disabled due to compilation issues
import * as fs from 'fs/promises';
import * as path from 'path';

const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR || './documents';

// Ensure documents directory exists
fs.mkdir(DOCUMENTS_DIR, { recursive: true }).catch(console.error);

export interface VerificationData {
  documentId: string;
  documentType: string;
  documentHash: string;
  issuingDate: string;
  expiryDate?: string;
  holderName?: string;
  issueOffice?: string;
  controlNumber?: string;
  serialNumber?: string;
  permitNumber?: string;
  biometricHash?: string;
  securityFeatures?: {
    brailleEncoded?: boolean;
    holographicSeal?: boolean;
    digitalSignature?: string;
    blockchainAnchor?: string;
  };
}

export interface QRCodeData {
  v: string; // Version
  id: string; // Document ID
  t: string; // Document Type
  h: string; // Document Hash (short)
  d: string; // Issue Date (YYYYMMDD)
  e?: string; // Expiry Date (YYYYMMDD)
  n?: string; // Holder Name (initials only for privacy)
  c: string; // Verification Code
  s: string; // Digital Signature
  b?: string; // Blockchain Anchor
}

export interface BarcodeData {
  officeCode: string; // e.g., "JHB" for Johannesburg
  date: string; // YYYYMMDD
  sequence: string; // 6-digit sequence
  documentType: string; // 2-letter code
  checkDigit: string; // Modulo 10 check digit
}

export class EnhancedVerificationUtilities {
  private readonly SECRET_KEY: string;
  private readonly BLOCKCHAIN_PREFIX = 'DHA_DOC_';
  
  constructor() {
    this.SECRET_KEY = process.env.VERIFICATION_SECRET || crypto.randomBytes(32).toString('hex');
    if (!process.env.VERIFICATION_SECRET && process.env.NODE_ENV === 'production') {
      console.warn('WARNING: Using generated VERIFICATION_SECRET. Set environment variable for production.');
    }
  }

  /**
   * Generate a 16-character verification code in XXXX-XXXX-XXXX-XXXX format
   * Uses cryptographically secure random generation with checksum
   */
  generateVerificationCode(): string {
    // Character set: uppercase letters and numbers (excluding similar looking characters)
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segments: string[] = [];
    
    // Generate 4 segments of 4 characters each
    for (let i = 0; i < 4; i++) {
      let segment = '';
      for (let j = 0; j < 4; j++) {
        const randomIndex = crypto.randomInt(0, charset.length);
        segment += charset[randomIndex];
      }
      segments.push(segment);
    }
    
    // Special markers for different segments
    // First segment: Document type marker
    segments[0] = this.addDocumentTypeMarker(segments[0]);
    
    // Last segment: Add checksum character
    const checksum = this.calculateChecksum(segments.join(''));
    segments[3] = segments[3].substring(0, 3) + checksum;
    
    return segments.join('-');
  }

  /**
   * Add document type marker to first segment
   */
  private addDocumentTypeMarker(segment: string): string {
    // Ensure first two characters indicate this is a DHA document
    return 'AA' + segment.substring(2);
  }

  /**
   * Calculate checksum character for verification code
   */
  private calculateChecksum(code: string): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let sum = 0;
    
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const value = charset.indexOf(char);
      if (value !== -1) {
        sum += value * (i + 1);
      }
    }
    
    return charset[sum % charset.length];
  }

  /**
   * Validate a verification code format and checksum
   */
  validateVerificationCode(code: string): boolean {
    // Check format: XXXX-XXXX-XXXX-XXXX
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!pattern.test(code)) {
      return false;
    }
    
    // Verify checksum
    const segments = code.split('-');
    const checksumChar = segments[3].charAt(3);
    const codeWithoutChecksum = segments[0] + segments[1] + segments[2] + segments[3].substring(0, 3);
    const expectedChecksum = this.calculateChecksum(codeWithoutChecksum);
    
    return checksumChar === expectedChecksum;
  }

  /**
   * Generate comprehensive QR code with all verification data
   */
  async generateEnhancedQRCode(data: VerificationData, verificationCode: string): Promise<string> {
    try {
      // Create compact QR data structure
      const qrData: QRCodeData = {
        v: '2.0', // Version 2.0 with enhanced features
        id: data.documentId.substring(0, 8), // Short ID
        t: this.getDocumentTypeCode(data.documentType),
        h: data.documentHash.substring(0, 8), // First 8 chars of hash
        d: data.issuingDate.replace(/-/g, ''),
        e: data.expiryDate ? data.expiryDate.replace(/-/g, '') : undefined,
        n: data.holderName ? this.getInitials(data.holderName) : undefined,
        c: verificationCode,
        s: this.generateDigitalSignature(data, verificationCode),
        b: data.securityFeatures?.blockchainAnchor
      };
      
      // Remove undefined fields
      Object.keys(qrData).forEach(key => {
        if (qrData[key as keyof QRCodeData] === undefined) {
          delete qrData[key as keyof QRCodeData];
        }
      });
      
      // Create verification URL with embedded data
      const baseUrl = process.env.VERIFICATION_URL || 'https://verify.dha.gov.za';
      const encodedData = Buffer.from(JSON.stringify(qrData)).toString('base64url');
      const verificationUrl = `${baseUrl}/qr/${verificationCode}?d=${encodedData}`;
      
      // Generate high-quality QR code
      const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
        errorCorrectionLevel: 'H', // High error correction
        type: 'png',
        quality: 1,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300 // High resolution
      });
      
      // Save QR code image
      const filename = `qr_${verificationCode}_enhanced.png`;
      const filepath = path.join(DOCUMENTS_DIR, filename);
      await fs.writeFile(filepath, qrCodeBuffer);
      
      return filepath;
    } catch (error) {
      console.error('Error generating enhanced QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate Code128 barcode for document tracking
   */
  async generateCode128Barcode(
    officeCode: string,
    documentType: string,
    sequence: number
  ): Promise<{ barcodeData: string; imagePath: string }> {
    try {
      // Create barcode data
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const sequenceStr = sequence.toString().padStart(6, '0');
      const typeCode = this.getDocumentTypeCode(documentType).substring(0, 2);
      
      // Generate barcode string
      const barcodeString = `${officeCode}${date}${typeCode}${sequenceStr}`;
      const checkDigit = this.calculateBarcodeCheckDigit(barcodeString);
      const fullBarcodeData = barcodeString + checkDigit;
      
      // Create canvas for barcode
      const canvas = createCanvas(400, 100);
      
      // Generate barcode on canvas
      JsBarcode(canvas, fullBarcodeData, {
        format: 'CODE128',
        width: 2,
        height: 70,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000'
      });
      
      // Save barcode image
      const buffer = canvas.toBuffer('image/png');
      const filename = `barcode_${fullBarcodeData}.png`;
      const filepath = path.join(DOCUMENTS_DIR, filename);
      await fs.writeFile(filepath, buffer);
      
      return {
        barcodeData: fullBarcodeData,
        imagePath: filepath
      };
    } catch (error) {
      console.error('Error generating Code128 barcode:', error);
      throw new Error('Failed to generate barcode');
    }
  }

  /**
   * Calculate barcode check digit using Modulo 10
   */
  private calculateBarcodeCheckDigit(data: string): string {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const digit = parseInt(data[i]) || 0;
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    return ((10 - (sum % 10)) % 10).toString();
  }

  /**
   * Generate comprehensive document hash for anti-tampering
   */
  generateDocumentHash(data: VerificationData): string {
    const hashContent = JSON.stringify({
      documentId: data.documentId,
      documentType: data.documentType,
      issuingDate: data.issuingDate,
      expiryDate: data.expiryDate,
      holderName: data.holderName,
      issueOffice: data.issueOffice,
      biometricHash: data.biometricHash,
      timestamp: Date.now()
    });
    
    return crypto.createHash('sha256').update(hashContent).digest('hex');
  }

  /**
   * Generate cryptographic signature for document
   */
  generateDigitalSignature(data: VerificationData, verificationCode: string): string {
    const signatureContent = {
      documentHash: data.documentHash,
      verificationCode,
      timestamp: Date.now(),
      issuer: 'DHA'
    };
    
    const signature = crypto
      .createHmac('sha256', this.SECRET_KEY)
      .update(JSON.stringify(signatureContent))
      .digest('hex');
    
    return signature.substring(0, 16); // Short signature for QR code
  }

  /**
   * Create blockchain-style anchor for permanent record
   */
  generateBlockchainAnchor(documentHash: string): string {
    const anchorData = {
      prefix: this.BLOCKCHAIN_PREFIX,
      hash: documentHash,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex')
    };
    
    // Generate proof-of-work style hash
    let anchor = '';
    let attempts = 0;
    
    while (!anchor.startsWith('0000') && attempts < 100000) {
      anchorData.nonce = crypto.randomBytes(8).toString('hex');
      anchor = crypto
        .createHash('sha256')
        .update(JSON.stringify(anchorData))
        .digest('hex');
      attempts++;
    }
    
    return anchor;
  }

  /**
   * Verify document integrity using multiple hash locations
   */
  verifyDocumentIntegrity(
    documentHash: string,
    qrHash: string,
    metadataHash: string,
    signatureHash: string
  ): { isValid: boolean; tamperedLocations: string[] } {
    const tamperedLocations: string[] = [];
    
    // Check if all hashes match
    if (documentHash !== qrHash) {
      tamperedLocations.push('QR_CODE');
    }
    
    if (documentHash !== metadataHash) {
      tamperedLocations.push('METADATA');
    }
    
    if (documentHash !== signatureHash) {
      tamperedLocations.push('SIGNATURE');
    }
    
    return {
      isValid: tamperedLocations.length === 0,
      tamperedLocations
    };
  }

  /**
   * Get document type code for compact representation
   */
  private getDocumentTypeCode(documentType: string): string {
    const typeCodes: { [key: string]: string } = {
      'work_permit': 'WP',
      'work_permit_19_1': 'W1',
      'work_permit_19_2': 'W2',
      'work_permit_19_3': 'W3',
      'work_permit_19_4': 'W4',
      'birth_certificate': 'BC',
      'death_certificate': 'DC',
      'marriage_certificate': 'MC',
      'passport': 'PP',
      'sa_id': 'ID',
      'smart_id': 'SI',
      'study_permit': 'SP',
      'business_permit': 'BP',
      'refugee_permit': 'RP',
      'permanent_residence': 'PR',
      'temporary_residence': 'TR'
    };
    
    return typeCodes[documentType] || 'XX';
  }

  /**
   * Get initials from full name for privacy
   */
  private getInitials(fullName: string): string {
    return fullName
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .join('');
  }

  /**
   * Parse QR code data from URL
   */
  parseQRCodeData(url: string): { verificationCode: string; data?: QRCodeData } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const verificationCode = pathParts[pathParts.length - 1];
      
      const encodedData = urlObj.searchParams.get('d');
      if (encodedData) {
        const decodedData = Buffer.from(encodedData, 'base64url').toString();
        const data = JSON.parse(decodedData) as QRCodeData;
        return { verificationCode, data };
      }
      
      return { verificationCode };
    } catch (error) {
      console.error('Error parsing QR code data:', error);
      throw new Error('Invalid QR code format');
    }
  }
}

// Export singleton instance
export const enhancedVerificationUtilities = new EnhancedVerificationUtilities();