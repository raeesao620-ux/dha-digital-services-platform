import { storage } from "../storage";
import { EnhancedSAOCRService, type SAOCRResult } from "./enhanced-sa-ocr";
import { dhaMRZParser, type MRZParsingResponse } from "./dha-mrz-parser";
import { dhaPKDAdapter, type PKDValidationResponse } from "./dha-pkd-adapter";
import { aiAssistantService } from "./ai-assistant";
import { documentProcessorService } from "./document-processor";
import { auditTrailService } from "./audit-trail-service";
import type { 
  AiDocumentSession, 
  InsertAiDocumentSession,
  DocumentAutoFillTemplate,
  OcrFieldDefinition
} from "@shared/schema";

export interface AIDocumentUpload {
  file: Express.Multer.File;
  documentType: 'passport' | 'sa_id' | 'work_permit' | 'birth_certificate' | 'marriage_certificate' | 'death_certificate' | string;
  userId: string;
  conversationId?: string;
  targetFormType?: string;
  enableAutoFill?: boolean;
}

export interface OCRAutoFillResult {
  success: boolean;
  sessionId: string;
  documentId: string;
  ocrResults: SAOCRResult;
  mrzData?: MRZParsingResponse;
  pkdValidation?: PKDValidationResponse;
  extractedFields: Record<string, any>;
  autoFillData?: Record<string, any>;
  aiAnalysis: {
    documentAuthenticity: 'authentic' | 'suspicious' | 'fraudulent' | 'inconclusive';
    qualityAssessment: 'excellent' | 'good' | 'fair' | 'poor';
    completenessScore: number; // 0-100
    suggestions: string[];
    issues: string[];
    recommendedActions: string[];
  };
  confidence: number;
  processingTime: number;
  error?: string;
}

export interface AutoFillMapping {
  formFieldName: string;
  sourceField: string;
  sourceType: 'ocr' | 'mrz' | 'computed' | 'manual';
  confidence: number;
  value: any;
  transformation?: 'date_format' | 'name_format' | 'uppercase' | 'lowercase' | 'none';
  validation?: {
    pattern?: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  };
}

export interface FormAutoFillData {
  formType: string;
  mappings: AutoFillMapping[];
  populatedFields: Record<string, any>;
  missingRequiredFields: string[];
  validationIssues: Array<{
    field: string;
    issue: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  completenessPercentage: number;
  aiSuggestions: string[];
}

export class AIOCRIntegrationService {
  private saOCRService: EnhancedSAOCRService;

  constructor() {
    this.saOCRService = new EnhancedSAOCRService();
  }

  /**
   * Process uploaded document with comprehensive OCR and AI analysis
   */
  async processDocumentForAI(upload: AIDocumentUpload): Promise<OCRAutoFillResult> {
    const startTime = Date.now();
    
    try {
      // 1. Store document
      const documentData = await documentProcessorService.processDocument(
        upload.file,
        upload.userId,
        upload.documentType as any
      );

      if (!documentData.success || !documentData.documentId) {
        throw new Error(documentData.error || 'Document processing failed');
      }

      // 2. Perform enhanced OCR based on document type
      let ocrResults: SAOCRResult;
      let mrzData: MRZParsingResponse | undefined;
      let pkdValidation: PKDValidationResponse | undefined;

      if (upload.documentType === 'passport') {
        const result = await this.processPassportDocument(upload.file.path);
        ocrResults = result.ocrResults;
        mrzData = result.mrzData;
        pkdValidation = result.pkdValidation;
      } else {
        ocrResults = await this.saOCRService.processDocument(upload.file.path, {
          documentType: upload.documentType as any,
          enablePreprocessing: true,
          enableMultiLanguage: true,
          extractFields: true,
          validateExtractedData: true,
          enhanceImageQuality: true
        });
      }

      // 3. Extract and normalize fields
      const extractedFields = this.extractNormalizedFields(ocrResults, mrzData);

      // 4. Get AI analysis of the document
      const aiAnalysis = await this.getAIDocumentAnalysis(
        ocrResults,
        upload.documentType,
        extractedFields,
        mrzData
      );

      // 5. Create AI document session
      const sessionData: InsertAiDocumentSession = {
        userId: upload.userId,
        conversationId: upload.conversationId || null,
        documentId: documentData.documentId,
        documentType: upload.documentType as any,
        ocrResults: ocrResults,
        extractedFields: extractedFields,
        mrzData: mrzData || null,
        aiAnalysis: aiAnalysis,
        suggestions: aiAnalysis.suggestions,
        validationIssues: aiAnalysis.issues.map(issue => ({ issue, severity: 'warning' })),
        processingStatus: 'validated',
        confidenceScore: Math.round(ocrResults.confidence),
        qualityScore: this.calculateQualityScore(ocrResults, mrzData),
        processingCompleted: new Date(),
        processingDuration: Date.now() - startTime
      };

      const session = await storage.createAiDocumentSession(sessionData);

      // 6. Generate auto-fill data if requested
      let autoFillData: Record<string, any> | undefined;
      if (upload.enableAutoFill && upload.targetFormType) {
        const autoFillResult = await this.generateAutoFillData(
          session.id,
          upload.targetFormType,
          extractedFields,
          mrzData
        );
        autoFillData = autoFillResult.populatedFields;
        
        // Update session with auto-fill data
        await storage.updateAiDocumentSession(session.id, {
          autoFillData: autoFillData,
          fieldMappings: autoFillResult.mappings
        });
      }

      // 7. Log audit trail
      await auditTrailService.logEvent({
        applicationId: documentData.documentId,
        applicantId: upload.userId,
        eventType: 'ai_ocr_processing_completed',
        eventCategory: 'document_processing',
        eventDescription: `AI OCR processing completed for ${upload.documentType}`,
        actorType: 'system',
        actorId: 'ai-ocr-integration',
        contextData: {
          sessionId: session.id,
          confidence: ocrResults.confidence,
          qualityScore: sessionData.qualityScore,
          processingTime: Date.now() - startTime
        }
      });

      return {
        success: true,
        sessionId: session.id,
        documentId: documentData.documentId,
        ocrResults,
        mrzData,
        pkdValidation,
        extractedFields,
        autoFillData,
        aiAnalysis,
        confidence: ocrResults.confidence,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('AI OCR integration error:', error);
      return {
        success: false,
        sessionId: '',
        documentId: '',
        ocrResults: {} as SAOCRResult,
        extractedFields: {},
        aiAnalysis: {
          documentAuthenticity: 'inconclusive',
          qualityAssessment: 'poor',
          completenessScore: 0,
          suggestions: ['Document processing failed - please try uploading again'],
          issues: [error instanceof Error ? error.message : 'Unknown error'],
          recommendedActions: ['Upload a clearer image of the document']
        },
        confidence: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  /**
   * Specialized passport processing with MRZ and PKD validation
   */
  private async processPassportDocument(filePath: string): Promise<{
    ocrResults: SAOCRResult;
    mrzData?: MRZParsingResponse;
    pkdValidation?: PKDValidationResponse;
  }> {
    // Perform OCR with passport-specific settings
    const ocrResults = await this.saOCRService.processDocument(filePath, {
      documentType: 'work_permit', // Using work_permit as closest match for passport
      enablePreprocessing: true,
      enableMultiLanguage: true,
      extractFields: true,
      validateExtractedData: true,
      enhanceImageQuality: true
    });

    let mrzData: MRZParsingResponse | undefined;
    let pkdValidation: PKDValidationResponse | undefined;

    try {
      // Extract MRZ lines from OCR text
      const mrzLines = this.extractMRZFromOCR(ocrResults.fullText);
      
      if (mrzLines.line1 && mrzLines.line2) {
        mrzData = await dhaMRZParser.parseMRZ({
          applicantId: 'system',
          applicationId: 'ai-processing',
          mrzLine1: mrzLines.line1,
          mrzLine2: mrzLines.line2,
          validateChecksums: true,
          strictValidation: true
        });

        // If MRZ parsing is successful and we have certificate data, validate with PKD
        if (mrzData.success && mrzData.parsedData.isValid) {
          // Note: PKD validation would require actual certificate data from passport chip
          // For now, we'll skip this step as it requires physical chip reading
        }
      }
    } catch (error) {
      console.warn('MRZ processing failed:', error);
    }

    return { ocrResults, mrzData, pkdValidation };
  }

  /**
   * Extract MRZ lines from OCR text using pattern matching
   */
  private extractMRZFromOCR(ocrText: string): { line1?: string; line2?: string } {
    const lines = ocrText.split('\n');
    const mrzPattern = /^[A-Z0-9<]{44}$/; // Standard MRZ line length
    
    const mrzLines = lines
      .map(line => line.trim().toUpperCase())
      .filter(line => mrzPattern.test(line))
      .slice(0, 2); // Take first 2 valid MRZ lines

    return {
      line1: mrzLines[0],
      line2: mrzLines[1]
    };
  }

  /**
   * Extract and normalize field data from OCR results
   */
  private extractNormalizedFields(ocrResults: SAOCRResult, mrzData?: MRZParsingResponse): Record<string, any> {
    const fields: Record<string, any> = {};

    // Extract fields from OCR
    ocrResults.extractedFields.forEach(field => {
      fields[field.name] = {
        value: field.value,
        confidence: field.confidence,
        source: 'ocr',
        position: field.position
      };
    });

    // Add MRZ data if available
    if (mrzData?.success && mrzData.parsedData) {
      const mrz = mrzData.parsedData;
      
      fields.passport_number = {
        value: mrz.passportNumber,
        confidence: 100,
        source: 'mrz',
        verified: mrz.checksumValidation.passportCheckDigit
      };

      fields.full_name = {
        value: mrz.fullName,
        confidence: 100,
        source: 'mrz'
      };

      fields.nationality = {
        value: mrz.nationality,
        confidence: 100,
        source: 'mrz'
      };

      fields.date_of_birth = {
        value: mrz.parsedDateOfBirth.toISOString(),
        confidence: 100,
        source: 'mrz',
        verified: mrz.checksumValidation.dateOfBirthCheckDigit
      };

      fields.expiration_date = {
        value: mrz.parsedExpirationDate.toISOString(),
        confidence: 100,
        source: 'mrz',
        verified: mrz.checksumValidation.expirationCheckDigit
      };

      fields.sex = {
        value: mrz.sex,
        confidence: 100,
        source: 'mrz'
      };

      fields.issuing_state = {
        value: mrz.issuingState,
        confidence: 100,
        source: 'mrz'
      };

      fields.age = {
        value: mrz.age,
        confidence: 100,
        source: 'computed'
      };

      fields.is_expired = {
        value: mrz.isExpired,
        confidence: 100,
        source: 'computed'
      };
    }

    return fields;
  }

  /**
   * Get AI analysis of the processed document
   */
  private async getAIDocumentAnalysis(
    ocrResults: SAOCRResult,
    documentType: string,
    extractedFields: Record<string, any>,
    mrzData?: MRZParsingResponse
  ): Promise<{
    documentAuthenticity: 'authentic' | 'suspicious' | 'fraudulent' | 'inconclusive';
    qualityAssessment: 'excellent' | 'good' | 'fair' | 'poor';
    completenessScore: number;
    suggestions: string[];
    issues: string[];
    recommendedActions: string[];
  }> {
    try {
      const analysis = await aiAssistantService.analyzeDocument(
        JSON.stringify({ ocrResults, extractedFields, mrzData }),
        documentType
      );

      if (analysis.success) {
        return {
          documentAuthenticity: this.assessAuthenticity(ocrResults, mrzData),
          qualityAssessment: this.assessQuality(ocrResults),
          completenessScore: analysis.completeness || 0,
          suggestions: analysis.suggestions || [],
          issues: analysis.validationIssues || [],
          recommendedActions: this.generateRecommendedActions(ocrResults, analysis.validationIssues || [])
        };
      }
    } catch (error) {
      console.error('AI document analysis error:', error);
    }

    // Fallback analysis
    return {
      documentAuthenticity: 'inconclusive',
      qualityAssessment: this.assessQuality(ocrResults),
      completenessScore: this.calculateCompletenessScore(ocrResults),
      suggestions: ['Consider uploading a clearer image for better analysis'],
      issues: ocrResults.validationResults.issuesFound,
      recommendedActions: ['Verify document details manually']
    };
  }

  /**
   * Assess document authenticity based on OCR and MRZ results
   */
  private assessAuthenticity(
    ocrResults: SAOCRResult,
    mrzData?: MRZParsingResponse
  ): 'authentic' | 'suspicious' | 'fraudulent' | 'inconclusive' {
    let authenticityScore = 0;

    // OCR-based checks
    if (ocrResults.validationResults.formatValid) authenticityScore += 25;
    if (ocrResults.validationResults.requiredFieldsPresent) authenticityScore += 25;
    if (ocrResults.layoutAnalysis.hasOfficialStamps) authenticityScore += 15;
    if (ocrResults.layoutAnalysis.hasWatermarks) authenticityScore += 15;

    // MRZ-based checks (for passports)
    if (mrzData?.success && mrzData.parsedData) {
      if (mrzData.parsedData.checksumValidation.allValid) authenticityScore += 20;
      if (!mrzData.parsedData.isExpired) authenticityScore += 10;
      if (mrzData.dataQuality.formatCompliance === 'full') authenticityScore += 10;
    }

    if (authenticityScore >= 85) return 'authentic';
    if (authenticityScore >= 60) return 'suspicious';
    if (authenticityScore >= 30) return 'inconclusive';
    return 'fraudulent';
  }

  /**
   * Assess document quality
   */
  private assessQuality(ocrResults: SAOCRResult): 'excellent' | 'good' | 'fair' | 'poor' {
    const confidence = ocrResults.confidence;
    
    if (confidence >= 90) return 'excellent';
    if (confidence >= 75) return 'good';
    if (confidence >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Calculate completeness score
   */
  private calculateCompletenessScore(ocrResults: SAOCRResult): number {
    const totalFields = ocrResults.extractedFields.length;
    const highConfidenceFields = ocrResults.extractedFields.filter(f => f.confidence > 70).length;
    
    return totalFields > 0 ? Math.round((highConfidenceFields / totalFields) * 100) : 0;
  }

  /**
   * Calculate quality score combining multiple factors
   */
  private calculateQualityScore(ocrResults: SAOCRResult, mrzData?: MRZParsingResponse): number {
    let score = ocrResults.confidence;

    // Bonus for MRZ validation
    if (mrzData?.success && mrzData.parsedData?.checksumValidation.allValid) {
      score += 10;
    }

    // Bonus for security features
    if (ocrResults.layoutAnalysis.hasOfficialStamps) score += 5;
    if (ocrResults.layoutAnalysis.hasWatermarks) score += 5;

    return Math.min(100, Math.round(score));
  }

  /**
   * Generate recommended actions based on analysis
   */
  private generateRecommendedActions(ocrResults: SAOCRResult, issues: string[]): string[] {
    const actions: string[] = [];

    if (ocrResults.confidence < 70) {
      actions.push('Upload a clearer, higher-resolution image');
    }

    if (issues.length > 0) {
      actions.push('Verify document details manually');
    }

    if (!ocrResults.layoutAnalysis.hasOfficialStamps) {
      actions.push('Ensure document includes official stamps and seals');
    }

    if (ocrResults.validationResults.issuesFound.length > 0) {
      actions.push('Review document for completeness and accuracy');
    }

    return actions;
  }

  /**
   * Generate auto-fill data for forms
   */
  async generateAutoFillData(
    sessionId: string,
    formType: string,
    extractedFields: Record<string, any>,
    mrzData?: MRZParsingResponse
  ): Promise<FormAutoFillData> {
    try {
      // Get auto-fill template for the form type
      const template = await this.getAutoFillTemplate(formType);
      
      if (!template) {
        throw new Error(`No auto-fill template found for form type: ${formType}`);
      }

      const mappings: AutoFillMapping[] = [];
      const populatedFields: Record<string, any> = {};
      const validationIssues: Array<{ field: string; issue: string; severity: 'error' | 'warning' | 'info' }> = [];
      const missingRequiredFields: string[] = [];

      // Process field mappings from template
      if (template.fieldMappings) {
        const templateMappings = template.fieldMappings as Record<string, any>;
        
        for (const [formField, sourceConfig] of Object.entries(templateMappings)) {
          const sourceField = sourceConfig.sourceField || sourceConfig;
          let value = extractedFields[sourceField]?.value;
          let confidence = extractedFields[sourceField]?.confidence || 0;
          let sourceType: 'ocr' | 'mrz' | 'computed' | 'manual' = extractedFields[sourceField]?.source || 'ocr';

          // Apply transformations if specified
          if (value && sourceConfig.transformation) {
            value = this.applyTransformation(value, sourceConfig.transformation);
          }

          // Validate the value
          if (sourceConfig.validation) {
            const validationResult = this.validateFieldValue(value, sourceConfig.validation);
            if (!validationResult.isValid) {
              validationIssues.push({
                field: formField,
                issue: validationResult.error || 'Validation failed',
                severity: sourceConfig.required ? 'error' : 'warning'
              });
            }
          }

          if (value !== undefined && value !== null && value !== '') {
            mappings.push({
              formFieldName: formField,
              sourceField,
              sourceType,
              confidence,
              value,
              transformation: sourceConfig.transformation,
              validation: sourceConfig.validation
            });
            populatedFields[formField] = value;
          } else if (sourceConfig.required) {
            missingRequiredFields.push(formField);
          }
        }
      }

      // Calculate completeness percentage
      const totalRequiredFields = template.requiredFields ? (template.requiredFields as string[]).length : 0;
      const populatedRequiredFields = totalRequiredFields - missingRequiredFields.length;
      const completenessPercentage = totalRequiredFields > 0 ? 
        Math.round((populatedRequiredFields / totalRequiredFields) * 100) : 100;

      // Generate AI suggestions for improvement
      const aiSuggestions = await this.generateAutoFillSuggestions(
        formType,
        populatedFields,
        missingRequiredFields,
        validationIssues
      );

      return {
        formType,
        mappings,
        populatedFields,
        missingRequiredFields,
        validationIssues,
        completenessPercentage,
        aiSuggestions
      };

    } catch (error) {
      console.error('Auto-fill data generation error:', error);
      return {
        formType,
        mappings: [],
        populatedFields: {},
        missingRequiredFields: [],
        validationIssues: [{
          field: 'system',
          issue: error instanceof Error ? error.message : 'Auto-fill generation failed',
          severity: 'error'
        }],
        completenessPercentage: 0,
        aiSuggestions: ['Please fill in the form manually']
      };
    }
  }

  /**
   * Get auto-fill template from storage
   */
  private async getAutoFillTemplate(formType: string): Promise<DocumentAutoFillTemplate | null> {
    try {
      const templates = await storage.getDocumentAutoFillTemplates({ targetFormType: formType, isActive: true });
      return templates.length > 0 ? templates[0] : null;
    } catch (error) {
      console.error('Error fetching auto-fill template:', error);
      return null;
    }
  }

  /**
   * Apply data transformation
   */
  private applyTransformation(value: any, transformation: string): any {
    switch (transformation) {
      case 'date_format':
        if (value instanceof Date) return value.toISOString().split('T')[0];
        if (typeof value === 'string') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date.toISOString().split('T')[0];
        }
        return value;
      
      case 'name_format':
        return typeof value === 'string' ? 
          value.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(' ') : 
          value;
      
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      
      default:
        return value;
    }
  }

  /**
   * Validate field value against validation rules
   */
  private validateFieldValue(value: any, validation: any): { isValid: boolean; error?: string } {
    if (validation.required && (value === undefined || value === null || value === '')) {
      return { isValid: false, error: 'This field is required' };
    }

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return { isValid: false, error: 'Value does not match required format' };
      }
    }

    if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
      return { isValid: false, error: `Value must be at least ${validation.minLength} characters long` };
    }

    if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
      return { isValid: false, error: `Value must be no more than ${validation.maxLength} characters long` };
    }

    return { isValid: true };
  }

  /**
   * Generate AI suggestions for auto-fill improvement
   */
  private async generateAutoFillSuggestions(
    formType: string,
    populatedFields: Record<string, any>,
    missingFields: string[],
    validationIssues: Array<{ field: string; issue: string; severity: string }>
  ): Promise<string[]> {
    try {
      const response = await aiAssistantService.generateFormResponse(
        formType,
        `Auto-fill analysis: ${Object.keys(populatedFields).length} fields populated, ${missingFields.length} missing, ${validationIssues.length} issues`,
        { populatedFields, missingFields, validationIssues }
      );

      if (response.success && response.response) {
        return [response.response];
      }
    } catch (error) {
      console.error('AI suggestions generation error:', error);
    }

    const suggestions: string[] = [];
    
    if (missingFields.length > 0) {
      suggestions.push(`Please provide the following missing information: ${missingFields.join(', ')}`);
    }
    
    if (validationIssues.length > 0) {
      suggestions.push('Please review and correct the validation issues highlighted in the form');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('All required fields have been populated successfully from your document');
    }

    return suggestions;
  }

  /**
   * Get processing session by ID
   */
  async getProcessingSession(sessionId: string): Promise<AiDocumentSession | null> {
    try {
      return await storage.getAiDocumentSession(sessionId);
    } catch (error) {
      console.error('Error fetching processing session:', error);
      return null;
    }
  }

  /**
   * Update processing session
   */
  async updateProcessingSession(sessionId: string, updates: Partial<AiDocumentSession>): Promise<boolean> {
    try {
      await storage.updateAiDocumentSession(sessionId, updates);
      return true;
    } catch (error) {
      console.error('Error updating processing session:', error);
      return false;
    }
  }
}

export const aiOCRIntegrationService = new AIOCRIntegrationService();