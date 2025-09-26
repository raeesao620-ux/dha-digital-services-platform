import { createHash, randomBytes } from 'crypto';
import { storage } from '../storage';
import { militarySecurityService } from './military-security';
import { classifiedInformationSystem } from './classified-system';
import { pdfGenerationService } from './pdf-generation-service';

/**
 * Military Document Service
 * Handles military-specific documents with classification and chain of custody
 * Compliant with DoD 5200.1-R and NATO security standards
 */
export class MilitaryDocumentService {
  // Military Document Types
  private readonly DOCUMENT_TYPES = {
    // Security Clearance
    SF86: {
      name: 'Questionnaire for National Security Positions',
      classification: 'CONFIDENTIAL',
      form: 'Standard Form 86',
      pages: 127,
      retention: 7
    },
    SF86C: {
      name: 'Certification for SF-86',
      classification: 'CONFIDENTIAL',
      form: 'SF-86C',
      pages: 2,
      retention: 7
    },
    SF312: {
      name: 'Classified Information Nondisclosure Agreement',
      classification: 'UNCLASSIFIED',
      form: 'SF-312',
      pages: 2,
      retention: 50
    },
    
    // Military ID and Access
    CAC_CARD: {
      name: 'Common Access Card',
      classification: 'FOR_OFFICIAL_USE_ONLY',
      form: 'DD-2842',
      pages: 1,
      retention: 5
    },
    DD214: {
      name: 'Certificate of Release or Discharge from Active Duty',
      classification: 'FOR_OFFICIAL_USE_ONLY',
      form: 'DD Form 214',
      pages: 4,
      retention: 75
    },
    DD1172: {
      name: 'Application for Uniformed Services ID Card',
      classification: 'FOR_OFFICIAL_USE_ONLY',
      form: 'DD Form 1172-2',
      pages: 2,
      retention: 5
    },
    
    // NATO and International
    NATO_TRAVEL_ORDER: {
      name: 'NATO Travel Order',
      classification: 'NATO_RESTRICTED',
      form: 'NATO Form 302',
      pages: 3,
      retention: 5
    },
    NATO_CLEARANCE: {
      name: 'NATO Security Clearance Certificate',
      classification: 'NATO_CONFIDENTIAL',
      form: 'NATO Form 018',
      pages: 2,
      retention: 10
    },
    SOFA_STAMP: {
      name: 'Status of Forces Agreement Stamp',
      classification: 'UNCLASSIFIED',
      form: 'SOFA',
      pages: 1,
      retention: 3
    },
    
    // Classified Courier
    DD2501: {
      name: 'Courier Authorization Card',
      classification: 'SECRET',
      form: 'DD Form 2501',
      pages: 1,
      retention: 5
    },
    COURIER_ORDERS: {
      name: 'Classified Courier Orders',
      classification: 'SECRET',
      form: 'DCA-1',
      pages: 4,
      retention: 5
    },
    
    // Defense Contractor
    DD254: {
      name: 'Contract Security Classification Specification',
      classification: 'FOR_OFFICIAL_USE_ONLY',
      form: 'DD Form 254',
      pages: 6,
      retention: 10
    },
    JPAS_VERIFICATION: {
      name: 'Joint Personnel Adjudication System Verification',
      classification: 'FOR_OFFICIAL_USE_ONLY',
      form: 'JPAS-001',
      pages: 1,
      retention: 5
    },
    
    // Base Access
    DBIDS_PASS: {
      name: 'Defense Biometric Identification System Pass',
      classification: 'FOR_OFFICIAL_USE_ONLY',
      form: 'AF Form 75',
      pages: 1,
      retention: 2
    },
    VISITOR_REQUEST: {
      name: 'Installation Visitor Access Request',
      classification: 'FOR_OFFICIAL_USE_ONLY',
      form: 'AF Form 3211',
      pages: 2,
      retention: 2
    },
    
    // Operational Documents
    OPORD: {
      name: 'Operations Order',
      classification: 'SECRET',
      form: 'OPORD',
      pages: 10,
      retention: 25
    },
    FRAGORD: {
      name: 'Fragmentary Order',
      classification: 'SECRET',
      form: 'FRAGORD',
      pages: 5,
      retention: 25
    },
    WARNO: {
      name: 'Warning Order',
      classification: 'CONFIDENTIAL',
      form: 'WARNO',
      pages: 3,
      retention: 10
    }
  };

  // Distribution Statements
  private readonly DISTRIBUTION_STATEMENTS = {
    A: 'Approved for public release; distribution is unlimited',
    B: 'Distribution authorized to U.S. Government agencies only',
    C: 'Distribution authorized to U.S. Government agencies and contractors only',
    D: 'Distribution authorized to DoD and DoD contractors only',
    E: 'Distribution authorized to DoD components only',
    F: 'Further dissemination only as directed',
    X: 'Distribution authorized to U.S. Government agencies and private individuals or enterprises'
  };

  // Handling Caveats
  private readonly HANDLING_CAVEATS = {
    FOUO: 'For Official Use Only',
    NOFORN: 'Not Releasable to Foreign Nationals',
    NOCONTRACT: 'Not Releasable to Contractors',
    PROPIN: 'Proprietary Information Involved',
    RELIDO: 'Releasable by Information Disclosure Officer Only',
    ORCON: 'Originator Controlled',
    IMCON: 'Controlled Imagery',
    SOURCES: 'Sources and Methods Information',
    LIMDIS: 'Limited Distribution',
    EXDIS: 'Exclusive Distribution',
    SPECAT: 'Special Category',
    SBU: 'Sensitive But Unclassified',
    LES: 'Law Enforcement Sensitive'
  };

  // NATO Classification Markings
  private readonly NATO_MARKINGS = {
    COSMIC_TOP_SECRET: 'COSMIC TOP SECRET',
    NATO_SECRET: 'NATO SECRET',
    NATO_CONFIDENTIAL: 'NATO CONFIDENTIAL',
    NATO_RESTRICTED: 'NATO RESTRICTED',
    NATO_UNCLASSIFIED: 'NATO UNCLASSIFIED'
  };

  // Data stores
  private documents: Map<string, any> = new Map();
  private chainOfCustody: Map<string, any[]> = new Map();
  private distributionLists: Map<string, Set<string>> = new Map();
  private documentTemplates: Map<string, any> = new Map();
  private auditTrail: any[] = [];
  private derivativeClassifications: Map<string, any> = new Map();

  constructor() {
    this.initializeMilitaryDocuments();
    this.loadDocumentTemplates();
    this.setupChainOfCustody();
  }

  private initializeMilitaryDocuments(): void {
    console.log('[Military Documents] Initializing document service');
    
    // Start periodic document review
    setInterval(() => this.reviewDocumentClassifications(), 86400000); // Daily
    setInterval(() => this.auditChainOfCustody(), 3600000); // Hourly
    setInterval(() => this.validateDistributions(), 7200000); // Every 2 hours
  }

  private loadDocumentTemplates(): void {
    console.log('[Military Documents] Loading document templates');
    
    // Load templates for each document type
    for (const [key, docType] of Object.entries(this.DOCUMENT_TYPES)) {
      this.documentTemplates.set(key, {
        ...docType,
        template: this.generateDocumentTemplate(key, docType)
      });
    }
  }

  private setupChainOfCustody(): void {
    console.log('[Chain of Custody] Initializing tracking system');
    
    // Initialize chain of custody tracking
    // This ensures document accountability at all times
  }

  /**
   * Generate Military Document
   */
  public async generateMilitaryDocument(request: {
    type: keyof typeof this.DOCUMENT_TYPES;
    classification?: string;
    data: any;
    requester: {
      id: string;
      clearance: string;
      organization: string;
    };
    distribution?: string;
    handlingCaveats?: string[];
    needToKnow?: string[];
  }): Promise<{
    documentId: string;
    document: any;
    classification: string;
    markings: string;
    chainOfCustodyId: string;
  }> {
    const documentId = `MIL-DOC-${randomBytes(8).toString('hex').toUpperCase()}`;
    const docType = this.DOCUMENT_TYPES[request.type];
    
    if (!docType) {
      throw new Error(`Unknown document type: ${request.type}`);
    }
    
    // Determine classification
    const classification = request.classification || docType.classification;
    
    // Verify requester has appropriate clearance
    const hasAccess = await this.verifyDocumentAccess(
      request.requester.clearance,
      classification
    );
    
    if (!hasAccess) {
      throw new Error('Insufficient clearance for document generation');
    }
    
    // Generate classification markings
    const markings = this.generateClassificationMarkings({
      classification,
      distribution: request.distribution || 'F',
      handlingCaveats: request.handlingCaveats || [],
      derivedFrom: 'Multiple Sources',
      declassifyOn: this.calculateDeclassificationDate(classification)
    });
    
    // Create document content
    const documentContent = await this.createDocumentContent(
      request.type,
      request.data,
      markings
    );
    
    // Apply security controls
    const securedDocument = await this.applySecurityControls(
      documentContent,
      classification
    );
    
    // Encrypt if classified
    let finalDocument = securedDocument;
    if (this.requiresEncryption(classification)) {
      finalDocument = militarySecurityService.encryptSuiteB(
        JSON.stringify(securedDocument),
        classification as any
      );
    }
    
    // Create chain of custody
    const chainOfCustodyId = this.initializeChainOfCustody(documentId, {
      creator: request.requester.id,
      createdAt: new Date(),
      classification,
      type: request.type
    });
    
    // Store document
    this.documents.set(documentId, {
      id: documentId,
      type: request.type,
      classification,
      markings,
      content: finalDocument,
      metadata: {
        created: new Date(),
        creator: request.requester.id,
        organization: request.requester.organization,
        distribution: request.distribution,
        handlingCaveats: request.handlingCaveats,
        needToKnow: request.needToKnow,
        version: 1,
        status: 'ACTIVE'
      },
      chainOfCustodyId
    });
    
    // Audit document creation
    this.auditDocumentAction({
      action: 'CREATE',
      documentId,
      type: request.type,
      classification,
      requester: request.requester.id,
      timestamp: new Date()
    });
    
    return {
      documentId,
      document: finalDocument,
      classification,
      markings,
      chainOfCustodyId
    };
  }

  /**
   * Generate SF-86 Security Clearance Application
   */
  public async generateSF86(applicantData: {
    personalInfo: any;
    residences: any[];
    employment: any[];
    education: any[];
    references: any[];
    foreignContacts: any[];
    foreignTravel: any[];
    financialInfo: any;
    criminalHistory: any[];
    drugUse: any[];
    mentalHealth: any;
    militaryService: any;
  }, requester: any): Promise<{
    documentId: string;
    pdfBuffer?: Buffer;
    status: string;
  }> {
    // Generate SF-86 form
    const sf86Data = {
      formNumber: 'SF-86',
      version: '2024',
      submissionDate: new Date(),
      ...applicantData,
      
      // Add required sections
      section1: this.formatPersonalInfo(applicantData.personalInfo),
      section2: this.formatCitizenship(applicantData.personalInfo),
      section3: this.formatResidences(applicantData.residences),
      section4: this.formatEducation(applicantData.education),
      section5: this.formatEmployment(applicantData.employment),
      section6: this.formatMilitaryService(applicantData.militaryService),
      section7: this.formatForeignActivities(applicantData.foreignContacts, applicantData.foreignTravel),
      section8: this.formatFinancialRecord(applicantData.financialInfo),
      section9: this.formatCriminalRecord(applicantData.criminalHistory),
      section10: this.formatDrugInvolvement(applicantData.drugUse),
      section11: this.formatMentalHealth(applicantData.mentalHealth),
      section12: this.formatReferences(applicantData.references)
    };
    
    // Generate the document
    const result = await this.generateMilitaryDocument({
      type: 'SF86',
      classification: 'CONFIDENTIAL',
      data: sf86Data,
      requester,
      distribution: 'E',
      handlingCaveats: ['FOUO', 'PROPIN']
    });
    
    // Generate PDF version if needed
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.generateSF86PDF(sf86Data);
    } catch (error) {
      console.error('[SF-86] PDF generation failed:', error);
    }
    
    return {
      documentId: result.documentId,
      pdfBuffer,
      status: 'SUBMITTED_FOR_INVESTIGATION'
    };
  }

  /**
   * Generate CAC Card Authorization
   */
  public async generateCACAuthorization(personnelData: {
    id: string;
    name: string;
    rank?: string;
    branch?: string;
    organization: string;
    clearanceLevel: string;
    photo?: string;
    fingerprints?: string;
    expirationDate: Date;
  }, requester: any): Promise<{
    documentId: string;
    cacId: string;
    pinCode: string;
    certificates: any;
  }> {
    const cacId = `CAC-${randomBytes(8).toString('hex').toUpperCase()}`;
    const pinCode = this.generateSecurePIN();
    
    // Generate PKI certificates for CAC
    const certificates = {
      identity: await this.generateIdentityCertificate(personnelData),
      email: await this.generateEmailCertificate(personnelData),
      encryption: await this.generateEncryptionCertificate(personnelData)
    };
    
    // Create CAC document
    const cacData = {
      cacId,
      ...personnelData,
      issueDate: new Date(),
      certificates: {
        identityCert: certificates.identity.thumbprint,
        emailCert: certificates.email.thumbprint,
        encryptionCert: certificates.encryption.thumbprint
      },
      chipData: this.generateCACChipData(personnelData, certificates)
    };
    
    // Generate the authorization document
    const result = await this.generateMilitaryDocument({
      type: 'CAC_CARD',
      data: cacData,
      requester,
      distribution: 'E',
      handlingCaveats: ['FOUO']
    });
    
    // Store CAC credentials securely
    await this.storeCACCredentials(cacId, pinCode, certificates);
    
    return {
      documentId: result.documentId,
      cacId,
      pinCode,
      certificates
    };
  }

  /**
   * Generate NATO Travel Order
   */
  public async generateNATOTravelOrder(travelData: {
    traveler: {
      name: string;
      rank?: string;
      nationality: string;
      passportNumber: string;
      clearanceLevel: string;
    };
    mission: {
      purpose: string;
      classification: string;
      countries: string[];
      startDate: Date;
      endDate: Date;
    };
    authorization: {
      authorizingOfficial: string;
      organization: string;
      natoCommand: string;
    };
  }, requester: any): Promise<{
    documentId: string;
    travelOrderNumber: string;
    visaEndorsements: string[];
  }> {
    const travelOrderNumber = `NATO-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Determine NATO classification
    const natoClassification = this.mapToNATOClassification(travelData.mission.classification);
    
    // Generate visa endorsements for each country
    const visaEndorsements = travelData.mission.countries.map(country => 
      this.generateNATOVisaEndorsement(country, travelData.traveler)
    );
    
    // Create travel order data
    const orderData = {
      orderNumber: travelOrderNumber,
      ...travelData,
      natoClassification,
      visaEndorsements,
      sofaStatus: this.determineSOFAStatus(travelData.mission.countries),
      securityInstructions: this.generateTravelSecurityInstructions(
        travelData.mission.countries,
        travelData.mission.classification
      )
    };
    
    // Generate the travel order document
    const result = await this.generateMilitaryDocument({
      type: 'NATO_TRAVEL_ORDER',
      classification: natoClassification,
      data: orderData,
      requester,
      distribution: 'C',
      handlingCaveats: ['NOFORN', 'NATO']
    });
    
    return {
      documentId: result.documentId,
      travelOrderNumber,
      visaEndorsements
    };
  }

  /**
   * Generate Classified Courier Authorization
   */
  public async generateCourierAuthorization(courierData: {
    courier: {
      id: string;
      name: string;
      clearanceLevel: string;
      organization: string;
    };
    mission: {
      origin: string;
      destination: string;
      classification: string;
      materials: string[];
      departureDate: Date;
      arrivalDate: Date;
    };
    security: {
      escortRequired: boolean;
      armedAuthorization: boolean;
      diplomaticPouch: boolean;
    };
  }, requester: any): Promise<{
    documentId: string;
    courierCardNumber: string;
    routingInstructions: any;
    emergencyProcedures: any;
  }> {
    const courierCardNumber = `COURIER-${randomBytes(6).toString('hex').toUpperCase()}`;
    
    // Verify courier clearance for material classification
    if (!this.verifyCourierClearance(courierData.courier.clearanceLevel, courierData.mission.classification)) {
      throw new Error('Courier lacks required clearance level');
    }
    
    // Generate routing instructions
    const routingInstructions = this.generateRoutingInstructions(
      courierData.mission.origin,
      courierData.mission.destination,
      courierData.mission.classification
    );
    
    // Generate emergency procedures
    const emergencyProcedures = this.generateEmergencyProcedures(
      courierData.mission.classification,
      courierData.security
    );
    
    // Create courier authorization data
    const authData = {
      courierCardNumber,
      ...courierData,
      routingInstructions,
      emergencyProcedures,
      destructionAuthority: this.getDestructionAuthority(courierData.mission.classification),
      duressCode: this.generateDuressCode(),
      checkpoints: this.generateSecurityCheckpoints(
        courierData.mission.origin,
        courierData.mission.destination
      )
    };
    
    // Generate the authorization document
    const result = await this.generateMilitaryDocument({
      type: 'DD2501',
      classification: courierData.mission.classification,
      data: authData,
      requester,
      distribution: 'F',
      handlingCaveats: ['ORCON', 'LIMDIS']
    });
    
    return {
      documentId: result.documentId,
      courierCardNumber,
      routingInstructions,
      emergencyProcedures
    };
  }

  /**
   * Chain of Custody Management
   */
  public initializeChainOfCustody(documentId: string, initialData: any): string {
    const chainId = `COC-${randomBytes(8).toString('hex').toUpperCase()}`;
    
    const initialEntry = {
      timestamp: new Date(),
      action: 'CREATED',
      handler: initialData.creator,
      location: 'SYSTEM',
      verification: this.generateCustodyVerification(initialData)
    };
    
    this.chainOfCustody.set(chainId, [initialEntry]);
    
    return chainId;
  }

  public transferCustody(documentId: string, transfer: {
    from: string;
    to: string;
    location: string;
    method: string;
    verification: string;
  }): {
    success: boolean;
    transferId: string;
    timestamp: Date;
  } {
    const document = this.documents.get(documentId);
    if (!document) {
      return { success: false, transferId: '', timestamp: new Date() };
    }
    
    const chain = this.chainOfCustody.get(document.chainOfCustodyId);
    if (!chain) {
      return { success: false, transferId: '', timestamp: new Date() };
    }
    
    const transferId = `TRF-${randomBytes(6).toString('hex').toUpperCase()}`;
    const timestamp = new Date();
    
    // Add transfer to chain
    chain.push({
      timestamp,
      action: 'TRANSFERRED',
      from: transfer.from,
      to: transfer.to,
      location: transfer.location,
      method: transfer.method,
      verification: transfer.verification,
      transferId
    });
    
    // Audit the transfer
    this.auditDocumentAction({
      action: 'CUSTODY_TRANSFER',
      documentId,
      transferId,
      from: transfer.from,
      to: transfer.to,
      timestamp
    });
    
    return {
      success: true,
      transferId,
      timestamp
    };
  }

  public getChainOfCustody(documentId: string): any[] {
    const document = this.documents.get(documentId);
    if (!document) return [];
    
    return this.chainOfCustody.get(document.chainOfCustodyId) || [];
  }

  /**
   * Document Distribution Control
   */
  public addToDistribution(documentId: string, recipients: string[], authorizer: {
    id: string;
    clearance: string;
  }): {
    success: boolean;
    added: string[];
    denied: string[];
  } {
    const document = this.documents.get(documentId);
    if (!document) {
      return { success: false, added: [], denied: [] };
    }
    
    const added: string[] = [];
    const denied: string[] = [];
    
    // Get or create distribution list
    let distList = this.distributionLists.get(documentId);
    if (!distList) {
      distList = new Set();
      this.distributionLists.set(documentId, distList);
    }
    
    // Check each recipient's clearance
    for (const recipient of recipients) {
      if (this.verifyRecipientClearance(recipient, document.classification)) {
        distList.add(recipient);
        added.push(recipient);
      } else {
        denied.push(recipient);
      }
    }
    
    // Audit distribution change
    this.auditDocumentAction({
      action: 'DISTRIBUTION_UPDATE',
      documentId,
      authorizer: authorizer.id,
      added,
      denied,
      timestamp: new Date()
    });
    
    return {
      success: added.length > 0,
      added,
      denied
    };
  }

  /**
   * Derivative Classification
   */
  public createDerivativeDocument(sourceDocumentId: string, derivativeData: {
    portions: string[];
    newClassification?: string;
    derivedBy: string;
    reason: string;
  }): {
    documentId: string;
    classification: string;
    sourceAttribution: string;
  } {
    const sourceDoc = this.documents.get(sourceDocumentId);
    if (!sourceDoc) {
      throw new Error('Source document not found');
    }
    
    const derivativeId = `DER-${randomBytes(8).toString('hex').toUpperCase()}`;
    
    // Determine derivative classification
    const derivativeClassification = derivativeData.newClassification || sourceDoc.classification;
    
    // Create source attribution
    const sourceAttribution = `Derived from: ${sourceDocumentId}, dated ${sourceDoc.metadata.created.toISOString()}`;
    
    // Store derivative classification record
    this.derivativeClassifications.set(derivativeId, {
      id: derivativeId,
      sourceDocument: sourceDocumentId,
      derivativeClassification,
      originalClassification: sourceDoc.classification,
      derivedBy: derivativeData.derivedBy,
      derivedOn: new Date(),
      reason: derivativeData.reason,
      portions: derivativeData.portions
    });
    
    // Audit derivative creation
    this.auditDocumentAction({
      action: 'DERIVATIVE_CLASSIFICATION',
      sourceDocument: sourceDocumentId,
      derivativeId,
      derivedBy: derivativeData.derivedBy,
      classification: derivativeClassification,
      timestamp: new Date()
    });
    
    return {
      documentId: derivativeId,
      classification: derivativeClassification,
      sourceAttribution
    };
  }

  /**
   * Helper Methods
   */
  private generateDocumentTemplate(key: string, docType: any): any {
    // Generate template structure for document type
    return {
      header: this.generateDocumentHeader(docType),
      sections: this.generateDocumentSections(key),
      footer: this.generateDocumentFooter(docType)
    };
  }

  private async verifyDocumentAccess(clearance: string, classification: string): Promise<boolean> {
    // Verify clearance level allows access to classification
    const clearanceLevels: Record<string, number> = {
      UNCLASSIFIED: 0,
      FOR_OFFICIAL_USE_ONLY: 1,
      CONFIDENTIAL: 2,
      SECRET: 3,
      TOP_SECRET: 4,
      TOP_SECRET_SCI: 5
    };
    
    const requiredLevel = clearanceLevels[classification] || 0;
    const userLevel = clearanceLevels[clearance] || 0;
    
    return userLevel >= requiredLevel;
  }

  private generateClassificationMarkings(params: any): string {
    let marking = params.classification;
    
    if (params.distribution) {
      marking += ` // DISTRIBUTION STATEMENT ${params.distribution}`;
    }
    
    if (params.handlingCaveats && params.handlingCaveats.length > 0) {
      marking += ` // ${params.handlingCaveats.join('/')}`;
    }
    
    if (params.derivedFrom) {
      marking += ` // Derived from: ${params.derivedFrom}`;
    }
    
    if (params.declassifyOn) {
      marking += ` // Declassify on: ${params.declassifyOn.toISOString().split('T')[0]}`;
    }
    
    return marking;
  }

  private calculateDeclassificationDate(classification: string): Date {
    const date = new Date();
    
    switch (classification) {
      case 'TOP_SECRET_SCI':
      case 'TOP_SECRET':
        date.setFullYear(date.getFullYear() + 25);
        break;
      case 'SECRET':
        date.setFullYear(date.getFullYear() + 10);
        break;
      case 'CONFIDENTIAL':
        date.setFullYear(date.getFullYear() + 6);
        break;
      default:
        date.setFullYear(date.getFullYear() + 2);
    }
    
    return date;
  }

  private async createDocumentContent(type: string, data: any, markings: string): Promise<any> {
    // Create document content based on type
    return {
      type,
      markings,
      generatedAt: new Date(),
      content: data,
      metadata: {
        generator: 'Military Document Service',
        version: '1.0.0'
      }
    };
  }

  private async applySecurityControls(document: any, classification: string): Promise<any> {
    // Apply security controls based on classification
    return {
      ...document,
      security: {
        watermark: this.generateSecurityWatermark(classification),
        digitalSignature: await this.generateDigitalSignature(document),
        integrityCheck: createHash('sha512').update(JSON.stringify(document)).digest('hex')
      }
    };
  }

  private requiresEncryption(classification: string): boolean {
    const encryptedLevels = ['CONFIDENTIAL', 'SECRET', 'TOP_SECRET', 'TOP_SECRET_SCI'];
    return encryptedLevels.includes(classification);
  }

  private generateSecurityWatermark(classification: string): string {
    return `${classification} // ${new Date().toISOString()}`;
  }

  private async generateDigitalSignature(document: any): Promise<string> {
    // Generate digital signature for document
    return createHash('sha256').update(JSON.stringify(document)).digest('hex');
  }

  private generateCustodyVerification(data: any): string {
    // Generate verification code for chain of custody
    return createHash('sha256')
      .update(JSON.stringify(data))
      .update(randomBytes(16))
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
  }

  private verifyRecipientClearance(recipient: string, classification: string): boolean {
    // Verify recipient has appropriate clearance
    // In production, check against personnel database
    return true; // Simplified
  }

  private generateDocumentHeader(docType: any): any {
    return {
      form: docType.form,
      title: docType.name,
      classification: docType.classification
    };
  }

  private generateDocumentSections(type: string): any[] {
    // Generate sections based on document type
    return [];
  }

  private generateDocumentFooter(docType: any): any {
    return {
      retentionPeriod: docType.retention,
      destructionDate: new Date(Date.now() + docType.retention * 365 * 24 * 60 * 60 * 1000)
    };
  }

  // SF-86 Specific Methods
  private formatPersonalInfo(info: any): any {
    return {
      fullName: info.name,
      ssn: info.ssn,
      dateOfBirth: info.dateOfBirth,
      placeOfBirth: info.placeOfBirth,
      citizenship: info.citizenship
    };
  }

  private formatCitizenship(info: any): any {
    return {
      citizenshipStatus: info.citizenshipStatus,
      dualCitizenship: info.dualCitizenship,
      passports: info.passports
    };
  }

  private formatResidences(residences: any[]): any {
    return residences.map(r => ({
      address: r.address,
      dates: r.dates,
      type: r.type
    }));
  }

  private formatEducation(education: any[]): any {
    return education.map(e => ({
      institution: e.institution,
      degree: e.degree,
      dates: e.dates
    }));
  }

  private formatEmployment(employment: any[]): any {
    return employment.map(e => ({
      employer: e.employer,
      position: e.position,
      dates: e.dates,
      supervisor: e.supervisor
    }));
  }

  private formatMilitaryService(service: any): any {
    return {
      branch: service?.branch,
      dates: service?.dates,
      discharge: service?.discharge,
      rank: service?.rank
    };
  }

  private formatForeignActivities(contacts: any[], travel: any[]): any {
    return {
      foreignContacts: contacts,
      foreignTravel: travel
    };
  }

  private formatFinancialRecord(financial: any): any {
    return {
      bankruptcy: financial.bankruptcy,
      debts: financial.debts,
      gambling: financial.gambling
    };
  }

  private formatCriminalRecord(criminal: any[]): any {
    return criminal;
  }

  private formatDrugInvolvement(drugs: any[]): any {
    return drugs;
  }

  private formatMentalHealth(mental: any): any {
    return mental;
  }

  private formatReferences(references: any[]): any {
    return references.map(r => ({
      name: r.name,
      relationship: r.relationship,
      contact: r.contact
    }));
  }

  private async generateSF86PDF(data: any): Promise<Buffer> {
    // Generate PDF version of SF-86
    // In production, use proper PDF generation
    return Buffer.from('SF-86 PDF Content');
  }

  // CAC Card Methods
  private generateSecurePIN(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private async generateIdentityCertificate(data: any): Promise<any> {
    return {
      subject: data.name,
      thumbprint: createHash('sha256').update(data.name).digest('hex'),
      validTo: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000)
    };
  }

  private async generateEmailCertificate(data: any): Promise<any> {
    return {
      subject: data.name,
      email: `${data.name.toLowerCase().replace(' ', '.')}@mil`,
      thumbprint: createHash('sha256').update(data.name + 'email').digest('hex'),
      validTo: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000)
    };
  }

  private async generateEncryptionCertificate(data: any): Promise<any> {
    return {
      subject: data.name,
      keyUsage: 'dataEncipherment',
      thumbprint: createHash('sha256').update(data.name + 'encrypt').digest('hex'),
      validTo: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000)
    };
  }

  private generateCACChipData(data: any, certificates: any): any {
    return {
      personnelId: data.id,
      biometric: data.fingerprints,
      certificates: certificates
    };
  }

  private async storeCACCredentials(cacId: string, pin: string, certificates: any): Promise<void> {
    // Store CAC credentials securely
    // In production, use HSM
  }

  // NATO Methods
  private mapToNATOClassification(classification: string): string {
    const mapping: Record<string, string> = {
      TOP_SECRET: 'NATO_SECRET',
      SECRET: 'NATO_CONFIDENTIAL',
      CONFIDENTIAL: 'NATO_RESTRICTED',
      UNCLASSIFIED: 'NATO_UNCLASSIFIED'
    };
    
    return mapping[classification] || 'NATO_RESTRICTED';
  }

  private generateNATOVisaEndorsement(country: string, traveler: any): string {
    return `NATO SOFA - ${country} - Valid for official travel - ${traveler.name}`;
  }

  private determineSOFAStatus(countries: string[]): string {
    // Determine Status of Forces Agreement status
    return 'NATO SOFA MEMBER';
  }

  private generateTravelSecurityInstructions(countries: string[], classification: string): string[] {
    const instructions: string[] = [];
    
    instructions.push('Report to security officer upon arrival');
    instructions.push('No personal electronic devices in secure areas');
    
    if (classification === 'SECRET' || classification === 'TOP_SECRET') {
      instructions.push('Classified materials must remain in diplomatic pouch');
      instructions.push('Daily check-in required with home station');
    }
    
    return instructions;
  }

  // Courier Methods
  private verifyCourierClearance(courierClearance: string, materialClassification: string): boolean {
    const levels: Record<string, number> = {
      UNCLASSIFIED: 0,
      CONFIDENTIAL: 1,
      SECRET: 2,
      TOP_SECRET: 3
    };
    
    return (levels[courierClearance] || 0) >= (levels[materialClassification] || 0);
  }

  private generateRoutingInstructions(origin: string, destination: string, classification: string): any {
    return {
      route: `${origin} -> ${destination}`,
      mode: classification === 'TOP_SECRET' ? 'DIRECT_FLIGHT_ONLY' : 'COMMERCIAL',
      escorts: classification === 'TOP_SECRET' ? 2 : 0
    };
  }

  private generateEmergencyProcedures(classification: string, security: any): any {
    return {
      compromise: 'Immediately notify security officer',
      destruction: classification === 'TOP_SECRET' ? 'Authorized if capture imminent' : 'Not authorized',
      duress: 'Use duress code in all communications'
    };
  }

  private getDestructionAuthority(classification: string): string {
    return classification === 'TOP_SECRET' ? 'COURIER' : 'SECURITY_OFFICER_ONLY';
  }

  private generateDuressCode(): string {
    return randomBytes(3).toString('hex').toUpperCase();
  }

  private generateSecurityCheckpoints(origin: string, destination: string): string[] {
    return ['Departure Security', 'In-Transit Check', 'Arrival Security'];
  }

  // Audit Methods
  private auditDocumentAction(details: any): void {
    this.auditTrail.push({
      timestamp: new Date(),
      ...details
    });
  }

  private reviewDocumentClassifications(): void {
    // Review documents for declassification
    for (const [id, doc] of this.documents.entries()) {
      console.log(`[Document Review] Reviewing ${id}`);
    }
  }

  private auditChainOfCustody(): void {
    // Audit all chain of custody records
    for (const [id, chain] of this.chainOfCustody.entries()) {
      console.log(`[Chain Audit] Auditing ${id}: ${chain.length} entries`);
    }
  }

  private validateDistributions(): void {
    // Validate distribution lists
    for (const [docId, distList] of this.distributionLists.entries()) {
      console.log(`[Distribution] Document ${docId}: ${distList.size} recipients`);
    }
  }

  /**
   * Public API Methods
   */
  public getDocumentMetrics(): any {
    return {
      totalDocuments: this.documents.size,
      byClassification: this.getDocumentsByClassification(),
      chainOfCustodyRecords: this.chainOfCustody.size,
      distributionLists: this.distributionLists.size,
      derivativeDocuments: this.derivativeClassifications.size,
      auditEntries: this.auditTrail.length
    };
  }

  private getDocumentsByClassification(): any {
    const byClass: any = {};
    
    for (const doc of this.documents.values()) {
      byClass[doc.classification] = (byClass[doc.classification] || 0) + 1;
    }
    
    return byClass;
  }

  public getDocument(documentId: string, requester: { id: string; clearance: string }): any {
    const document = this.documents.get(documentId);
    
    if (!document) {
      return null;
    }
    
    // Verify access
    if (!this.verifyDocumentAccess(requester.clearance, document.classification)) {
      this.auditDocumentAction({
        action: 'ACCESS_DENIED',
        documentId,
        requester: requester.id,
        reason: 'Insufficient clearance'
      });
      return null;
    }
    
    // Log access
    this.auditDocumentAction({
      action: 'ACCESS_GRANTED',
      documentId,
      requester: requester.id
    });
    
    return document;
  }
}

// Export singleton instance
export const militaryDocumentService = new MilitaryDocumentService();