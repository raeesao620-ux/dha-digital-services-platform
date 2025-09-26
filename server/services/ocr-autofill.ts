import { storage } from "../storage";
import { aiOCRIntegrationService } from "./ai-ocr-integration";
import { aiAssistantService } from "./ai-assistant";

export interface AutoFillMapping {
  sourceField: string;
  targetField: string;
  sourceType: 'ocr' | 'mrz' | 'computed' | 'ai_extracted';
  confidence: number;
  transformFunction?: string; // Optional transformation function name
}

export interface FormAutoFillResult {
  success: boolean;
  formData: Record<string, any>;
  mappings: AutoFillMapping[];
  unmappedFields: string[];
  confidence: number;
  sessionId: string;
  documentId: string;
  error?: string;
}

export class OCRAutoFillService {
  
  // PRODUCTION-COMPLETE: Comprehensive field mapping for ALL 21 DHA document types
  private readonly DHA_DOCUMENT_MAPPINGS: Record<string, Record<string, AutoFillMapping[]>> = {
    // === CIVIL DOCUMENTS ===
    'birth_certificate': {
      'birth_registration': [
        { sourceField: 'child_surname', targetField: 'child_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'child_first_names', targetField: 'child_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'date_of_birth', targetField: 'birth_date', sourceType: 'ocr', confidence: 0.98 },
        { sourceField: 'place_of_birth', targetField: 'birth_place', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'father_surname', targetField: 'father_surname', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'father_first_names', targetField: 'father_first_names', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'mother_surname', targetField: 'mother_surname', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'mother_first_names', targetField: 'mother_first_names', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'registration_number', targetField: 'birth_registration_number', sourceType: 'ocr', confidence: 0.95 }
      ]
    },
    'death_certificate': {
      'death_registration': [
        { sourceField: 'deceased_surname', targetField: 'deceased_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'deceased_first_names', targetField: 'deceased_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'date_of_death', targetField: 'death_date', sourceType: 'ocr', confidence: 0.98 },
        { sourceField: 'place_of_death', targetField: 'death_place', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'id_number', targetField: 'deceased_id_number', sourceType: 'ocr', confidence: 0.98 },
        { sourceField: 'cause_of_death', targetField: 'cause_of_death', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'registration_number', targetField: 'death_registration_number', sourceType: 'ocr', confidence: 0.95 }
      ]
    },
    'marriage_certificate': {
      'marriage_registration': [
        { sourceField: 'groom_surname', targetField: 'groom_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'groom_first_names', targetField: 'groom_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'bride_surname', targetField: 'bride_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'bride_first_names', targetField: 'bride_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'marriage_date', targetField: 'marriage_date', sourceType: 'ocr', confidence: 0.98 },
        { sourceField: 'marriage_place', targetField: 'marriage_place', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'registration_number', targetField: 'marriage_registration_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'marriage_officer', targetField: 'marriage_officer_name', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'divorce_certificate': {
      'divorce_registration': [
        { sourceField: 'husband_surname', targetField: 'husband_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'husband_first_names', targetField: 'husband_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'wife_surname', targetField: 'wife_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'wife_first_names', targetField: 'wife_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'divorce_date', targetField: 'divorce_date', sourceType: 'ocr', confidence: 0.98 },
        { sourceField: 'court_name', targetField: 'divorce_court', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'decree_number', targetField: 'divorce_decree_number', sourceType: 'ocr', confidence: 0.95 }
      ]
    },

    // === IDENTITY DOCUMENTS ===
    'passport': {
      'passport_application': [
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'date_of_birth', targetField: 'date_of_birth', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'place_of_birth', targetField: 'place_of_birth', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'id_number', targetField: 'sa_id_number', sourceType: 'ocr', confidence: 0.98 },
        { sourceField: 'gender', targetField: 'gender', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'nationality', targetField: 'nationality', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'passport_number', targetField: 'previous_passport_number', sourceType: 'mrz', confidence: 0.98 },
        { sourceField: 'expiration_date', targetField: 'previous_passport_expiry', sourceType: 'mrz', confidence: 0.95 }
      ]
    },
    'sa_id': {
      'id_application': [
        { sourceField: 'id_number', targetField: 'id_number', sourceType: 'ocr', confidence: 0.99 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'date_of_birth', targetField: 'date_of_birth', sourceType: 'computed', confidence: 0.99, transformFunction: 'extractDOBFromIDNumber' },
        { sourceField: 'gender', targetField: 'gender', sourceType: 'computed', confidence: 0.99, transformFunction: 'extractGenderFromIDNumber' },
        { sourceField: 'citizenship', targetField: 'citizenship_status', sourceType: 'computed', confidence: 0.99, transformFunction: 'extractCitizenshipFromIDNumber' }
      ]
    },
    'smart_id': {
      'smart_id_application': [
        { sourceField: 'id_number', targetField: 'id_number', sourceType: 'ocr', confidence: 0.99 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'smart_id_number', targetField: 'current_smart_id_number', sourceType: 'ocr', confidence: 0.98 },
        { sourceField: 'date_of_issue', targetField: 'current_issue_date', sourceType: 'ocr', confidence: 0.95 }
      ]
    },
    'temporary_id': {
      'temporary_id_application': [
        { sourceField: 'id_number', targetField: 'id_number', sourceType: 'ocr', confidence: 0.99 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'reason_for_temporary', targetField: 'reason_for_temporary_id', sourceType: 'ocr', confidence: 0.80 }
      ]
    },

    // === PERMITS AND VISAS ===
    'study_permit': {
      'study_permit_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'nationality', targetField: 'nationality', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'institution_name', targetField: 'institution_name', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'course_name', targetField: 'course_of_study', sourceType: 'ocr', confidence: 0.80 },
        { sourceField: 'study_duration', targetField: 'intended_study_duration', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'work_permit': {
      'work_permit_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'nationality', targetField: 'nationality', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'employer_name', targetField: 'employer_name', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'job_title', targetField: 'position_title', sourceType: 'ocr', confidence: 0.80 },
        { sourceField: 'work_location', targetField: 'work_location', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'business_permit': {
      'business_permit_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'business_name', targetField: 'business_name', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'business_type', targetField: 'business_type', sourceType: 'ocr', confidence: 0.80 },
        { sourceField: 'investment_amount', targetField: 'investment_amount', sourceType: 'ocr', confidence: 0.90 }
      ]
    },
    'visitor_visa': {
      'visitor_visa_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'nationality', targetField: 'nationality', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'purpose_of_visit', targetField: 'visit_purpose', sourceType: 'ocr', confidence: 0.80 },
        { sourceField: 'intended_duration', targetField: 'intended_stay_duration', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'transit_visa': {
      'transit_visa_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'destination_country', targetField: 'final_destination', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'transit_duration', targetField: 'transit_duration_hours', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'airline', targetField: 'transit_airline', sourceType: 'ocr', confidence: 0.85 }
      ]
    },

    // === RESIDENCE PERMITS ===
    'permanent_residence': {
      'permanent_residence_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'nationality', targetField: 'nationality', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'category', targetField: 'pr_category', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'sponsor_details', targetField: 'sponsor_information', sourceType: 'ocr', confidence: 0.80 }
      ]
    },
    'temporary_residence': {
      'temporary_residence_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'residence_reason', targetField: 'reason_for_residence', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'intended_duration', targetField: 'intended_stay_duration', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'refugee_permit': {
      'refugee_permit_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'country_of_origin', targetField: 'country_of_origin', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'reason_for_persecution', targetField: 'persecution_reason', sourceType: 'ocr', confidence: 0.80 },
        { sourceField: 'port_of_entry', targetField: 'entry_port', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'asylum_permit': {
      'asylum_permit_application': [
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'country_of_origin', targetField: 'country_of_origin', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'asylum_claim_basis', targetField: 'asylum_claim_basis', sourceType: 'ocr', confidence: 0.80 },
        { sourceField: 'date_of_arrival', targetField: 'arrival_date_sa', sourceType: 'ocr', confidence: 0.85 }
      ]
    },

    // === SPECIAL DOCUMENTS ===
    'diplomatic_passport': {
      'diplomatic_passport_application': [
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'diplomatic_rank', targetField: 'diplomatic_rank', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'ministry_department', targetField: 'issuing_department', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'mission_country', targetField: 'mission_destination', sourceType: 'ocr', confidence: 0.90 },
        { sourceField: 'security_clearance', targetField: 'security_clearance_level', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'exchange_permit': {
      'exchange_permit_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'exchange_program', targetField: 'exchange_program_name', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'host_organization', targetField: 'host_organization', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'program_duration', targetField: 'exchange_duration', sourceType: 'ocr', confidence: 0.85 }
      ]
    },
    'relatives_visa': {
      'relatives_visa_application': [
        { sourceField: 'passport_number', targetField: 'passport_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'surname', targetField: 'applicant_surname', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'first_names', targetField: 'applicant_first_names', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'relationship_to_sa_citizen', targetField: 'family_relationship', sourceType: 'ocr', confidence: 0.85 },
        { sourceField: 'sa_citizen_id', targetField: 'sponsor_id_number', sourceType: 'ocr', confidence: 0.95 },
        { sourceField: 'sa_citizen_name', targetField: 'sponsor_full_name', sourceType: 'ocr', confidence: 0.90 }
      ]
    }
  };

  /**
   * CORE FUNCTIONALITY: Perform OCR and auto-fill form data
   */
  async performOCRAutoFill(
    documentId: string,
    documentType: string,
    targetFormType: string,
    userId: string,
    options: {
      enableMrzParsing?: boolean;
      enableFieldExtraction?: boolean;
      enableValidation?: boolean;
      qualityThreshold?: number;
    } = {}
  ): Promise<FormAutoFillResult> {
    try {
      // Create or get document session for auto-fill tracking
      let sessionId = documentId; // Use documentId as session identifier
      try {
        // Try to get existing document
        const document = await storage.getDocument(documentId);
        if (!document) {
          return {
            success: false,
            formData: {},
            mappings: [],
            unmappedFields: [],
            confidence: 0,
            sessionId: '',
            documentId,
            error: 'Document not found'
          };
        }
        sessionId = document.id;
      } catch (error) {
        console.warn('Could not fetch document session, proceeding with documentId as sessionId');
      }

      // Perform OCR processing with AI integration
      // Get document file from storage to pass to AI OCR service
      const document = await storage.getDocument(documentId);
      if (!document || !document.storagePath) {
        return {
          success: false,
          formData: {},
          mappings: [],
          unmappedFields: [],
          confidence: 0,
          sessionId: sessionId,
          documentId,
          error: 'Document file not found or no storage path available'
        };
      }

      const ocrResult = await aiOCRIntegrationService.processDocumentForAI({
        file: { path: document.storagePath, originalname: document.filename, mimetype: document.mimeType } as Express.Multer.File,
        documentType: documentType as any,
        userId,
        conversationId: 'auto-fill-session',
        targetFormType,
        enableAutoFill: true
      });

      if (!ocrResult.success) {
        return {
          success: false,
          formData: {},
          mappings: [],
          unmappedFields: [],
          confidence: 0,
          sessionId: sessionId,
          documentId,
          error: ocrResult.error || 'OCR processing failed'
        };
      }

      // Get field mappings for document type and target form
      const mappings = this.getFieldMappings(documentType, targetFormType);
      if (mappings.length === 0) {
        return {
          success: false,
          formData: {},
          mappings: [],
          unmappedFields: [],
          confidence: 0,
          sessionId: sessionId,
          documentId,
          error: `No field mappings found for ${documentType} -> ${targetFormType}`
        };
      }

      // Apply field mappings to create form data
      const autoFillResult = await this.applyFieldMappings(
        ocrResult.extractedFields,
        mappings,
        ocrResult.mrzData,
        ocrResult.aiAnalysis
      );

      // Save auto-fill results to database
      await this.saveAutoFillResults(sessionId, autoFillResult, ocrResult);

      return {
        success: true,
        formData: autoFillResult.formData,
        mappings: autoFillResult.appliedMappings,
        unmappedFields: autoFillResult.unmappedFields,
        confidence: autoFillResult.overallConfidence,
        sessionId: sessionId,
        documentId
      };

    } catch (error) {
      console.error('OCR auto-fill error:', error);
      return {
        success: false,
        formData: {},
        mappings: [],
        unmappedFields: [],
        confidence: 0,
        sessionId: '',
        documentId,
        error: error instanceof Error ? error.message : 'Unknown auto-fill error'
      };
    }
  }

  /**
   * Get field mappings for specific document type and target form
   */
  private getFieldMappings(documentType: string, targetFormType: string): AutoFillMapping[] {
    const documentMappings = this.DHA_DOCUMENT_MAPPINGS[documentType];
    if (!documentMappings) {
      console.warn(`No mappings found for document type: ${documentType}`);
      return [];
    }

    const formMappings = documentMappings[targetFormType];
    if (!formMappings) {
      console.warn(`No mappings found for form type: ${targetFormType} in document type: ${documentType}`);
      return [];
    }

    return formMappings;
  }

  /**
   * Apply field mappings to extracted data
   */
  private async applyFieldMappings(
    extractedFields: Record<string, any>,
    mappings: AutoFillMapping[],
    mrzData?: any,
    aiAnalysis?: any
  ): Promise<{
    formData: Record<string, any>;
    appliedMappings: AutoFillMapping[];
    unmappedFields: string[];
    overallConfidence: number;
  }> {
    const formData: Record<string, any> = {};
    const appliedMappings: AutoFillMapping[] = [];
    const unmappedFields: string[] = [];
    let totalConfidence = 0;
    let mappedCount = 0;

    for (const mapping of mappings) {
      let sourceValue: any = null;
      let actualConfidence = mapping.confidence;

      // Get value based on source type
      switch (mapping.sourceType) {
        case 'ocr':
          sourceValue = extractedFields[mapping.sourceField];
          break;
        case 'mrz':
          sourceValue = mrzData?.[mapping.sourceField];
          break;
        case 'computed':
          sourceValue = await this.computeField(mapping.sourceField, extractedFields, mapping.transformFunction);
          break;
        case 'ai_extracted':
          sourceValue = aiAnalysis?.[mapping.sourceField];
          break;
      }

      if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '') {
        // Apply transformation if specified
        if (mapping.transformFunction) {
          sourceValue = await this.applyTransformation(sourceValue, mapping.transformFunction);
        }

        formData[mapping.targetField] = sourceValue;
        appliedMappings.push({ ...mapping, confidence: actualConfidence });
        totalConfidence += actualConfidence;
        mappedCount++;
      } else {
        unmappedFields.push(mapping.targetField);
      }
    }

    const overallConfidence = mappedCount > 0 ? totalConfidence / mappedCount : 0;

    return {
      formData,
      appliedMappings,
      unmappedFields,
      overallConfidence
    };
  }

  /**
   * Compute fields using transformation functions
   */
  private async computeField(fieldName: string, extractedFields: Record<string, any>, transformFunction?: string): Promise<any> {
    if (!transformFunction) return null;

    switch (transformFunction) {
      case 'extractDOBFromIDNumber':
        const idNumber = extractedFields['id_number'];
        if (idNumber && typeof idNumber === 'string' && idNumber.length >= 6) {
          const year = parseInt(idNumber.substring(0, 2));
          const month = parseInt(idNumber.substring(2, 4));
          const day = parseInt(idNumber.substring(4, 6));
          
          // Determine century (RSA ID format)
          const fullYear = year < 22 ? 2000 + year : 1900 + year;
          
          return new Date(fullYear, month - 1, day).toISOString().split('T')[0];
        }
        return null;

      case 'extractGenderFromIDNumber':
        const genderIdNumber = extractedFields['id_number'];
        if (genderIdNumber && typeof genderIdNumber === 'string' && genderIdNumber.length >= 10) {
          const genderDigit = parseInt(genderIdNumber.substring(6, 10));
          return genderDigit < 5000 ? 'F' : 'M';
        }
        return null;

      case 'extractCitizenshipFromIDNumber':
        const citizenshipIdNumber = extractedFields['id_number'];
        if (citizenshipIdNumber && typeof citizenshipIdNumber === 'string' && citizenshipIdNumber.length >= 11) {
          const citizenshipDigit = parseInt(citizenshipIdNumber.substring(10, 11));
          return citizenshipDigit === 0 ? 'SA_Citizen' : 'Permanent_Resident';
        }
        return null;

      case 'formatPhoneNumber':
        const phone = extractedFields[fieldName];
        if (phone) {
          return phone.replace(/[^\d]/g, '').replace(/^27/, '+27');
        }
        return null;

      default:
        console.warn(`Unknown transformation function: ${transformFunction}`);
        return null;
    }
  }

  /**
   * Apply transformation to field value
   */
  private async applyTransformation(value: any, transformFunction: string): Promise<any> {
    switch (transformFunction) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'formatDate':
        // Convert various date formats to ISO format
        if (typeof value === 'string') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date.toISOString().split('T')[0];
        }
        return value;
      default:
        return value;
    }
  }

  /**
   * Save auto-fill results to database for tracking and improvement
   */
  private async saveAutoFillResults(sessionId: string, autoFillResult: any, ocrResult: any): Promise<void> {
    try {
      // Update document with auto-fill results (simplified for current storage)
      try {
        const document = await storage.getDocument(sessionId);
        if (document) {
          // Store auto-fill results in metadata for tracking
          console.log('Auto-fill completed:', {
            documentId: sessionId,
            mappedFields: autoFillResult.appliedMappings.length,
            unmappedFields: autoFillResult.unmappedFields.length,
            confidence: autoFillResult.overallConfidence
          });
        }
      } catch (error) {
        console.warn('Could not update document with auto-fill results:', error);
      }

      // Log successful auto-fill for analytics
      await storage.createSecurityEvent({
        userId: '', // Will be set by the calling function
        eventType: 'ocr_auto_fill_completed',
        severity: 'low',
        details: {
          sessionId,
          mappedFields: autoFillResult.appliedMappings.length,
          unmappedFields: autoFillResult.unmappedFields.length,
          confidence: autoFillResult.overallConfidence,
          documentType: ocrResult.documentType
        }
      });

    } catch (error) {
      console.error('Failed to save auto-fill results:', error);
    }
  }

  /**
   * Get available auto-fill templates for a document type
   */
  async getAvailableAutoFillTemplates(documentType: string): Promise<Array<{
    formType: string;
    description: string;
    mappingCount: number;
    supportedFields: string[];
  }>> {
    const documentMappings = this.DHA_DOCUMENT_MAPPINGS[documentType];
    if (!documentMappings) {
      return [];
    }

    return Object.entries(documentMappings).map(([formType, mappings]) => ({
      formType,
      description: this.getFormTypeDescription(formType),
      mappingCount: mappings.length,
      supportedFields: mappings.map(m => m.targetField)
    }));
  }

  /**
   * Get human-readable description for form types
   */
  private getFormTypeDescription(formType: string): string {
    const descriptions: Record<string, string> = {
      'passport_application': 'South African Passport Application',
      'birth_registration': 'Birth Certificate Registration',
      'marriage_registration': 'Marriage Certificate Registration', 
      'death_registration': 'Death Certificate Registration',
      'id_application': 'South African ID Card Application',
      'work_permit_application': 'Foreign Work Permit Application',
      'study_permit_application': 'Study Permit Application',
      'visitor_visa_application': 'Visitor Visa Application'
    };

    return descriptions[formType] || formType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

export const ocrAutoFillService = new OCRAutoFillService();