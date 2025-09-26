import { storage } from "../storage";
import { InsertDocument } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import CryptoJS from "crypto-js";
// import sharp from "sharp"; // Temporarily disabled for deployment  
let sharp: any = null;
try {
  sharp = require("sharp");
} catch (error) {
  console.warn("[DocumentProcessor] Sharp not available - image processing disabled");
}
import { createWorker } from "tesseract.js";
import { privacyProtectionService } from "./privacy-protection";
import { enhancedSAOCR, type SAOCRResult, type SAOCROptions } from "./enhanced-sa-ocr";
import { saPermitValidator, type PermitValidationRequest, type PermitValidationResult } from "./sa-permit-validator";
import { aiAssistantService } from "./ai-assistant";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const DOCUMENT_ENCRYPTION_KEY = (() => {
  if (process.env.DOCUMENT_ENCRYPTION_KEY) {
    return process.env.DOCUMENT_ENCRYPTION_KEY;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: DOCUMENT_ENCRYPTION_KEY environment variable is required for document encryption in production');
  }
  return 'dev-document-key-for-testing-only-12345678901234567890123456789012';
})();
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch((error) => {
  console.error("Failed to create upload directory:", error?.message || "Unknown error");
});

export interface ProcessingResult {
  success: boolean;
  documentId?: string;
  ocrText?: string;
  ocrConfidence?: number;
  verificationScore?: number;
  isAuthentic?: boolean;
  documentType?: string;
  extractedFields?: Record<string, any>;
  saValidationResult?: {
    isValidSADocument: boolean;
    documentCategory: string;
    permitNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    issuingOffice?: string;
    validationErrors: string[];
    complianceScore: number;
  };
  error?: string;
}

export interface DocumentVerificationResult {
  isAuthentic: boolean;
  confidence: number;
  issues: string[];
  metadata: {
    fileSize: number;
    format: string;
    resolution?: string;
    pageCount?: number;
  };
}

// Configure multer for file uploads
export const documentUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

export class DocumentProcessorService {
  
  /**
   * Health check for critical dependencies
   */
  async performHealthCheck(): Promise<{
    success: boolean;
    dependencies: {
      tesseract: { available: boolean; version?: string; error?: string };
      sharp: { available: boolean; version?: string; error?: string };
      ocrPipeline: { working: boolean; error?: string };
    };
    timestamp: Date;
  }> {
    const healthCheck = {
      success: false,
      dependencies: {
        tesseract: { available: false } as any,
        sharp: { available: false } as any,
        ocrPipeline: { working: false } as any
      },
      timestamp: new Date()
    };

    try {
      // Check tesseract.js availability with timeout
      await this.checkTesseractHealth(healthCheck.dependencies.tesseract);
      
      // Check sharp availability
      await this.checkSharpHealth(healthCheck.dependencies.sharp);
      
      // Test OCR pipeline with sample data
      await this.checkOCRPipelineHealth(healthCheck.dependencies.ocrPipeline);
      
      healthCheck.success = healthCheck.dependencies.tesseract.available && 
                           healthCheck.dependencies.sharp.available &&
                           healthCheck.dependencies.ocrPipeline.working;
                           
    } catch (error) {
      console.error('Health check failed:', error);
    }

    return healthCheck;
  }

  private async checkTesseractHealth(result: any): Promise<void> {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tesseract health check timeout')), 10000); // 10s timeout
      });

      const healthCheckPromise = (async () => {
        const worker = await createWorker();
        await worker.load();
        await worker.reinitialize('eng');
        await worker.terminate();
        return true;
      })();

      await Promise.race([healthCheckPromise, timeoutPromise]);
      
      result.available = true;
      result.version = 'tesseract.js-4.x'; // Would need to get actual version
    } catch (error) {
      result.available = false;
      result.error = error instanceof Error ? error.message : 'Unknown tesseract error';
    }
  }

  private async checkSharpHealth(result: any): Promise<void> {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sharp health check timeout')), 5000); // 5s timeout
      });

      const healthCheckPromise = (async () => {
        // Create a small test image buffer and process it
        const testBuffer = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
          0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
          0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
          0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        
        await sharp(testBuffer).resize(100, 100).png().toBuffer();
        return true;
      })();

      await Promise.race([healthCheckPromise, timeoutPromise]);
      
      result.available = true;
      result.version = 'sharp-0.33.x'; // Would need to get actual version
    } catch (error) {
      result.available = false;
      result.error = error instanceof Error ? error.message : 'Unknown sharp error';
    }
  }

  private async checkOCRPipelineHealth(result: any): Promise<void> {
    try {
      // Use a simple test - check if enhanced SA OCR service can be instantiated
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OCR pipeline health check timeout')), 15000); // 15s timeout
      });

      const pipelineCheckPromise = (async () => {
        // Test if the enhanced SA OCR service loads correctly
        if (typeof enhancedSAOCR.processDocument === 'function') {
          return true;
        }
        throw new Error('Enhanced SA OCR service not properly loaded');
      })();

      await Promise.race([pipelineCheckPromise, timeoutPromise]);
      
      result.working = true;
    } catch (error) {
      result.working = false;
      result.error = error instanceof Error ? error.message : 'Unknown OCR pipeline error';
    }
  }

  async processDocument(
    file: Express.Multer.File,
    userId: string,
    options: {
      performOCR?: boolean;
      verifyAuthenticity?: boolean;
      extractData?: boolean;
      encrypt?: boolean;
      documentType?: string;
      enableSAValidation?: boolean;
      enableFieldExtraction?: boolean;
      enableWorkflowManagement?: boolean;
      enablePOPIACompliance?: boolean;
      enableAIEnhancement?: boolean;
      enableSmartClassification?: boolean;
      enableFraudDetection?: boolean;
    } = {}
  ): Promise<ProcessingResult> {
    try {
      let encryptionKey: string | undefined;
      let encryptedPath = file.path;
      
      // Encrypt file if requested
      if (options.encrypt) {
        encryptionKey = crypto.randomBytes(32).toString('hex');
        encryptedPath = await this.encryptFile(file.path, encryptionKey);
      }
      
      // Create document record
      const documentData: InsertDocument = {
        userId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: encryptedPath,
        encryptionKey,
        isEncrypted: !!options.encrypt,
        processingStatus: "processing"
      };
      
      const document = await storage.createDocument(documentData);
      
      // AI-powered smart document classification
      let classifiedDocumentType = options.documentType;
      if (options.enableSmartClassification && !options.documentType) {
        classifiedDocumentType = await this.classifyDocumentWithAI(file.path, file.originalname);
        // Note: documentType is stored separately for classification purposes
      }
      
      // Perform OCR if requested
      let ocrResult: any;
      let saOCRResult: SAOCRResult | undefined;
      let aiEnhancedOCRResult: any;
      
      if (options.performOCR) {
        // Use AI-enhanced OCR if enabled
        if (options.enableAIEnhancement) {
          aiEnhancedOCRResult = await this.performAIEnhancedOCR(file.path, file.mimetype, classifiedDocumentType);
          ocrResult = aiEnhancedOCRResult;
        } else {
          // Use enhanced SA OCR for SA permit documents
          const isSAPermitDocument = classifiedDocumentType && 
            ['work_permit', 'residence_permit', 'temporary_permit', 'permanent_visa'].includes(classifiedDocumentType);
        
          if (isSAPermitDocument && options.enableSAValidation) {
          const saOCROptions: SAOCROptions = {
            documentType: options.documentType as any,
            enablePreprocessing: true,
            enableMultiLanguage: true,
            extractFields: options.enableFieldExtraction || false,
            validateExtractedData: true,
            enhanceImageQuality: true
          };
          
          saOCRResult = await enhancedSAOCR.processDocument(file.path, file.mimetype, saOCROptions);
          
          if (saOCRResult.success) {
            ocrResult = {
              success: true,
              text: saOCRResult.fullText,
              confidence: saOCRResult.confidence
            };
          } else {
            // Fallback to basic OCR if SA OCR fails
            ocrResult = await this.performOCR(file.path, file.mimetype);
          }
        } else {
          // Use basic OCR for general documents
          ocrResult = await this.performOCR(file.path, file.mimetype);
        }
        }
        
        if (ocrResult.success) {
          const updateData: any = {
            ocrText: ocrResult.text,
            ocrConfidence: ocrResult.confidence
          };
          
          // Add SA-specific data if available
          if (saOCRResult && saOCRResult.success) {
            updateData.documentType = saOCRResult.documentType;
            if (saOCRResult.extractedFields.length > 0) {
              const fieldsObj: Record<string, any> = {};
              saOCRResult.extractedFields.forEach(field => {
                fieldsObj[field.name] = {
                  value: field.value,
                  confidence: field.confidence
                };
              });
              updateData.extractedFields = JSON.stringify(fieldsObj);
            }
          }
          
          await storage.updateDocument(document.id, updateData);
        }
      }
      
      // Verify authenticity if requested
      let verificationResult;
      if (options.verifyAuthenticity) {
        verificationResult = await this.verifyDocumentAuthenticity(file.path, file.mimetype);
        await storage.updateDocument(document.id, {
          isVerified: verificationResult.isAuthentic,
          verificationScore: verificationResult.confidence
        });
      }
      
      // Update processing status
      await storage.updateDocument(document.id, {
        processingStatus: "completed"
      });
      
      // Log processing event
      await storage.createSecurityEvent({
        userId,
        eventType: "document_processed",
        severity: "low",
        details: {
          documentId: document.id,
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          ocrPerformed: options.performOCR,
          verificationPerformed: options.verifyAuthenticity,
          encrypted: options.encrypt,
          ocrConfidence: ocrResult?.confidence,
          verificationScore: verificationResult?.confidence
        }
      });
      
      const result: ProcessingResult = {
        success: true,
        documentId: document.id,
        ocrText: ocrResult?.text,
        ocrConfidence: ocrResult?.confidence,
        verificationScore: verificationResult?.confidence,
        isAuthentic: verificationResult?.isAuthentic
      };
      
      // Add SA OCR-specific results and comprehensive permit validation
      if (saOCRResult && saOCRResult.success) {
        result.documentType = saOCRResult.documentType;
        
        let fieldsObj: Record<string, any> = {};
        if (saOCRResult.extractedFields.length > 0) {
          saOCRResult.extractedFields.forEach(field => {
            fieldsObj[field.name] = field.value;
          });
          result.extractedFields = fieldsObj;
        }
        
        // Perform comprehensive permit validation if permit number is available
        let permitValidationResult: PermitValidationResult | undefined;
        const permitNumber = saOCRResult.extractedFields.find(f => f.name === 'permitNumber')?.value;
        
        if (permitNumber && ['work_permit', 'residence_permit', 'temporary_permit', 'permanent_visa'].includes(saOCRResult.documentType)) {
          try {
            const validationRequest: PermitValidationRequest = {
              permitNumber,
              documentType: saOCRResult.documentType as any,
              extractedFields: fieldsObj,
              documentImagePath: file.path,
              applicantId: userId,
              skipDatabaseChecks: true // Skip external database checks for now
            };
            
            permitValidationResult = await saPermitValidator.validatePermit(validationRequest);
          } catch (validationError) {
            console.error('Permit validation error:', validationError);
          }
        }
        
        // Create enhanced SA validation result
        result.saValidationResult = {
          isValidSADocument: permitValidationResult ? 
            permitValidationResult.isValid : 
            (saOCRResult.validationResults.formatValid && saOCRResult.validationResults.requiredFieldsPresent),
          documentCategory: saOCRResult.documentType,
          permitNumber,
          issueDate: saOCRResult.extractedFields.find(f => f.name === 'issueDate')?.value,
          expiryDate: saOCRResult.extractedFields.find(f => f.name === 'validUntil')?.value,
          issuingOffice: saOCRResult.extractedFields.find(f => f.name === 'dhaOffice')?.value,
          validationErrors: permitValidationResult ? 
            permitValidationResult.issuesFound.map(issue => issue.description) :
            saOCRResult.validationResults.issuesFound,
          complianceScore: permitValidationResult ? 
            permitValidationResult.validationScore :
            Math.round(
              (saOCRResult.validationResults.formatValid ? 25 : 0) +
              (saOCRResult.validationResults.requiredFieldsPresent ? 25 : 0) +
              (saOCRResult.validationResults.dateFormatsValid ? 25 : 0) +
              (saOCRResult.validationResults.referenceNumbersValid ? 25 : 0)
            )
        };
      }
      
      return result;
      
    } catch (error) {
      console.error("Document processing error:", error);
      
      // Clean up file on error
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        console.error("Failed to clean up file:", unlinkError);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Document processing failed"
      };
    }
  }
  
  private async performOCR(filePath: string, mimeType: string): Promise<{
    success: boolean;
    text?: string;
    confidence?: number;
    error?: string;
  }> {
    try {
      // Configure for different document types
      if (mimeType === 'application/pdf') {
        return {
          success: false,
          error: "PDF OCR not implemented in this demo. Use image formats."
        };
      }

      // Add timeout protection for OCR operations
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OCR operation timeout after 30 seconds')), 30000);
      });

      const ocrPromise = (async () => {
        const worker = await createWorker();
        
        try {
          await worker.load();
          await worker.reinitialize('eng');
          
          const { data: { text, confidence } } = await worker.recognize(filePath);
          
          return {
            success: true,
            text: text.trim(),
            confidence: Math.round(confidence)
          };
        } finally {
          await worker.terminate();
        }
      })();

      return await Promise.race([ocrPromise, timeoutPromise]);
      
    } catch (error) {
      console.error("OCR error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "OCR processing failed"
      };
    }
  }
  
  private async verifyDocumentAuthenticity(filePath: string, mimeType: string): Promise<DocumentVerificationResult> {
    try {
      const stats = await fs.stat(filePath);
      const issues: string[] = [];
      let confidence = 100;
      
      // Basic file integrity checks
      if (stats.size === 0) {
        issues.push("File is empty");
        confidence -= 50;
      }
      
      if (stats.size > MAX_FILE_SIZE) {
        issues.push("File size exceeds maximum allowed");
        confidence -= 20;
      }
      
      // Check file format consistency
      const fileExtension = path.extname(filePath).toLowerCase();
      const expectedExtensions = this.getExpectedExtensions(mimeType);
      
      if (!expectedExtensions.includes(fileExtension)) {
        issues.push("File extension doesn't match MIME type");
        confidence -= 30;
      }
      
      // Read file header to verify format
      const buffer = await fs.readFile(filePath, { encoding: null });
      const isValidFormat = this.verifyFileHeader(buffer, mimeType);
      
      if (!isValidFormat) {
        issues.push("File header doesn't match declared format");
        confidence -= 40;
      }
      
      // Check for signs of tampering (basic implementation)
      const tamperingScore = await this.detectTampering(buffer, mimeType);
      confidence -= tamperingScore;
      
      if (tamperingScore > 30) {
        issues.push("Possible signs of tampering detected");
      }
      
      const isAuthentic = confidence >= 70 && issues.length === 0;
      
      return {
        isAuthentic,
        confidence: Math.max(confidence, 0),
        issues,
        metadata: {
          fileSize: stats.size,
          format: mimeType,
          pageCount: mimeType === 'application/pdf' ? 1 : undefined // Simplified
        }
      };
      
    } catch (error) {
      console.error("Document verification error:", error);
      return {
        isAuthentic: false,
        confidence: 0,
        issues: ["Verification process failed"],
        metadata: {
          fileSize: 0,
          format: mimeType
        }
      };
    }
  }
  
  private getExpectedExtensions(mimeType: string): string[] {
    const mimeToExtensions: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    };
    
    return mimeToExtensions[mimeType] || [];
  }
  
  private verifyFileHeader(buffer: Buffer, mimeType: string): boolean {
    const signatures: Record<string, number[][]> = {
      'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      'image/tiff': [[0x49, 0x49, 0x2A, 0x00], [0x4D, 0x4D, 0x00, 0x2A]]
    };
    
    const expectedSignatures = signatures[mimeType];
    if (!expectedSignatures) return true; // Unknown type, assume valid
    
    return expectedSignatures.some(signature => {
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) return false;
      }
      return true;
    });
  }
  
  private async detectTampering(buffer: Buffer, mimeType: string): Promise<number> {
    let tamperingScore = 0;
    
    // Check for unusual patterns in file structure
    if (mimeType.startsWith('image/')) {
      // Look for repeated patterns that might indicate editing
      const chunks = [];
      for (let i = 0; i < Math.min(buffer.length, 1024); i += 16) {
        chunks.push(buffer.subarray(i, i + 16).toString('hex'));
      }
      
      const uniqueChunks = new Set(chunks);
      const repetitionRatio = 1 - (uniqueChunks.size / chunks.length);
      
      if (repetitionRatio > 0.3) {
        tamperingScore += 20;
      }
    }
    
    // Check for metadata inconsistencies
    // This would require format-specific parsing in production
    
    return tamperingScore;
  }
  
  private async encryptFile(filePath: string, key: string): Promise<string> {
    const data = await fs.readFile(filePath);
    const encrypted = CryptoJS.AES.encrypt(data.toString('base64'), key).toString();
    
    const encryptedPath = `${filePath}.encrypted`;
    await fs.writeFile(encryptedPath, encrypted);
    
    // Remove original file
    await fs.unlink(filePath);
    
    return encryptedPath;
  }
  
  async getDocument(documentId: string, userId: string): Promise<{
    success: boolean;
    document?: any;
    error?: string;
  }> {
    try {
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return {
          success: false,
          error: "Document not found"
        };
      }
      
      if (document.userId !== userId) {
        return {
          success: false,
          error: "Access denied"
        };
      }
      
      return {
        success: true,
        document: {
          id: document.id,
          filename: document.originalName,
          mimeType: document.mimeType,
          size: document.size,
          isEncrypted: document.isEncrypted,
          ocrText: document.ocrText,
          ocrConfidence: document.ocrConfidence,
          isVerified: document.isVerified,
          verificationScore: document.verificationScore,
          processingStatus: document.processingStatus,
          createdAt: document.createdAt
        }
      };
      
    } catch (error) {
      console.error("Get document error:", error);
      return {
        success: false,
        error: "Failed to retrieve document"
      };
    }
  }
  
  async getUserDocuments(userId: string) {
    const documents = await storage.getDocuments(userId);
    
    return documents.map(doc => ({
      id: doc.id,
      filename: doc.originalName,
      mimeType: doc.mimeType,
      size: doc.size,
      isEncrypted: doc.isEncrypted,
      isVerified: doc.isVerified,
      verificationScore: doc.verificationScore,
      processingStatus: doc.processingStatus,
      createdAt: doc.createdAt
    }));
  }
  
  // AI-Enhanced Methods
  private async classifyDocumentWithAI(filePath: string, fileName: string): Promise<string> {
    try {
      // Read a portion of the file for classification
      const fileContent = await fs.readFile(filePath);
      const sampleContent = fileContent.toString('utf8').substring(0, 1000);
      
      const result = await aiAssistantService.analyzeDocument(
        `Filename: ${fileName}\nContent sample: ${sampleContent}`,
        'unknown'
      );
      
      // Map AI classification to known document types
      const documentTypes = [
        'passport', 'id_document', 'birth_certificate', 'work_permit',
        'residence_permit', 'asylum_document', 'marriage_certificate',
        'medical_certificate', 'police_clearance', 'bank_statement'
      ];
      
      // Extract document type from AI analysis
      if (result.extractedFields?.documentType) {
        const aiType = result.extractedFields.documentType.toLowerCase();
        const matchedType = documentTypes.find(type => aiType.includes(type.replace('_', ' ')));
        return matchedType || 'general_document';
      }
      
      return 'general_document';
    } catch (error) {
      console.error('AI document classification error:', error);
      return 'general_document';
    }
  }
  
  private async performAIEnhancedOCR(filePath: string, mimeType: string, documentType?: string): Promise<any> {
    try {
      // First perform standard OCR
      const standardOCR = await this.performOCR(filePath, mimeType);
      
      if (!standardOCR.success) {
        return standardOCR;
      }
      
      // Enhance with AI analysis
      const aiAnalysis = await aiAssistantService.analyzeDocument(
        standardOCR.text || '',
        documentType || 'general_document'
      );
      
      // Combine results
      return {
        success: true,
        text: standardOCR.text || '',
        confidence: Math.max(standardOCR.confidence || 0, aiAnalysis.completeness || 0),
        extractedFields: aiAnalysis.extractedFields,
        validationIssues: aiAnalysis.validationIssues,
        suggestions: aiAnalysis.suggestions,
        aiEnhanced: true
      };
    } catch (error) {
      console.error('AI-enhanced OCR error:', error);
      // Fallback to standard OCR
      return this.performOCR(filePath, mimeType);
    }
  }
  
  async detectFraudWithAI(documentData: any, documentType: string): Promise<{
    fraudScore: number;
    fraudIndicators: string[];
    recommendation: string;
  }> {
    try {
      const anomalies = await aiAssistantService.detectAnomalies(
        [documentData],
        `document_${documentType}`
      );
      
      // Calculate fraud score based on anomalies
      let fraudScore = 0;
      const fraudIndicators: string[] = [];
      
      anomalies.anomalies.forEach((anomaly, index) => {
        fraudIndicators.push(anomaly);
        const severity = anomalies.severity[index];
        if (severity === 'critical') fraudScore += 30;
        else if (severity === 'high') fraudScore += 20;
        else if (severity === 'medium') fraudScore += 10;
        else fraudScore += 5;
      });
      
      // Cap fraud score at 100
      fraudScore = Math.min(fraudScore, 100);
      
      let recommendation = 'Document appears authentic';
      if (fraudScore > 70) {
        recommendation = 'High fraud risk - Manual review required';
      } else if (fraudScore > 40) {
        recommendation = 'Medium fraud risk - Additional verification recommended';
      } else if (fraudScore > 20) {
        recommendation = 'Low fraud risk - Standard verification sufficient';
      }
      
      return {
        fraudScore,
        fraudIndicators,
        recommendation
      };
    } catch (error) {
      console.error('AI fraud detection error:', error);
      return {
        fraudScore: 0,
        fraudIndicators: [],
        recommendation: 'Unable to perform AI fraud detection'
      };
    }
  }
  
  async extractFormFieldsWithAI(documentText: string, formType: string): Promise<Record<string, any>> {
    try {
      const result = await aiAssistantService.generateFormResponse(
        formType,
        `Extract form fields from this document: ${documentText}`,
        {}
      );
      
      return result.filledFields || {};
    } catch (error) {
      console.error('AI form field extraction error:', error);
      return {};
    }
  }
}

export const documentProcessorService = new DocumentProcessorService();
