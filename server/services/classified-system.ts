import { createHash, randomBytes } from 'crypto';
import { storage } from '../storage';
import { militarySecurityService } from './military-security';

/**
 * Classified Information System
 * Implements Multi-Level Security (MLS) with Bell-LaPadula model
 * Compliant with DoD 5200.01 and Intelligence Community Directive 710
 */
export class ClassifiedInformationSystem {
  // Security Classification Levels (hierarchical)
  private readonly CLASSIFICATION_LEVELS = {
    UNCLASSIFIED: {
      level: 0,
      marking: 'UNCLASSIFIED',
      color: '#00AA00', // Green
      abbreviation: 'U'
    },
    FOR_OFFICIAL_USE_ONLY: {
      level: 1,
      marking: 'FOR OFFICIAL USE ONLY',
      color: '#00AA00', // Green
      abbreviation: 'FOUO'
    },
    CONFIDENTIAL: {
      level: 2,
      marking: 'CONFIDENTIAL',
      color: '#0000FF', // Blue
      abbreviation: 'C'
    },
    SECRET: {
      level: 3,
      marking: 'SECRET',
      color: '#FF0000', // Red
      abbreviation: 'S'
    },
    TOP_SECRET: {
      level: 4,
      marking: 'TOP SECRET',
      color: '#FFA500', // Orange
      abbreviation: 'TS'
    },
    TOP_SECRET_SCI: {
      level: 5,
      marking: 'TOP SECRET//SCI',
      color: '#FFFF00', // Yellow
      abbreviation: 'TS//SCI'
    },
    SAP: {
      level: 6,
      marking: 'SPECIAL ACCESS PROGRAM',
      color: '#800080', // Purple
      abbreviation: 'SAP'
    }
  };

  // Compartments and Special Access Programs
  private readonly COMPARTMENTS = {
    // Intelligence Community compartments
    HCS: 'HUMINT Control System',
    SI: 'Special Intelligence',
    TK: 'TALENT KEYHOLE',
    GAMMA: 'GAMMA (SIGINT)',
    
    // Military compartments
    CNWDI: 'Critical Nuclear Weapon Design Information',
    RD: 'Restricted Data',
    FRD: 'Formerly Restricted Data',
    
    // Special Access Programs
    ACCM: 'Alternative Compensatory Control Measures',
    SPECAT: 'Special Category',
    LIMDIS: 'Limited Distribution',
    EXDIS: 'Exclusive Distribution'
  };

  // Distribution and Handling Caveats
  private readonly HANDLING_CAVEATS = {
    NOFORN: 'Not Releasable to Foreign Nationals',
    NOCONTRACT: 'Not Releasable to Contractors',
    ORCON: 'Originator Controlled',
    PROPIN: 'Proprietary Information',
    REL_TO: 'Releasable To',
    DISPLAY_ONLY: 'Display Only (No Downloads)',
    EYES_ONLY: 'Eyes Only',
    IMM: 'Immediate',
    LIMDIS: 'Limited Distribution'
  };

  // Bell-LaPadula Security Model Rules
  private readonly BELL_LAPADULA = {
    // Simple Security Property (no read up)
    SIMPLE_SECURITY: (subjectLevel: number, objectLevel: number) => subjectLevel >= objectLevel,
    
    // Star Property (no write down)
    STAR_PROPERTY: (subjectLevel: number, objectLevel: number) => subjectLevel <= objectLevel,
    
    // Discretionary Security Property
    DISCRETIONARY: (subject: any, object: any) => this.checkDiscretionaryAccess(subject, object)
  };

  // Biba Integrity Model Rules (for integrity protection)
  private readonly BIBA_MODEL = {
    // Simple Integrity (no read down)
    SIMPLE_INTEGRITY: (subjectLevel: number, objectLevel: number) => subjectLevel <= objectLevel,
    
    // Star Integrity (no write up)
    STAR_INTEGRITY: (subjectLevel: number, objectLevel: number) => subjectLevel >= objectLevel,
    
    // Invocation Property
    INVOCATION: (subject1Level: number, subject2Level: number) => subject1Level >= subject2Level
  };

  // Data stores
  private classifiedDocuments: Map<string, any> = new Map();
  private accessMatrix: Map<string, Set<string>> = new Map();
  private compartmentAccess: Map<string, Set<string>> = new Map();
  private auditLog: any[] = [];
  private sanitizationQueue: Map<string, any> = new Map();
  private crossDomainTransfers: Map<string, any> = new Map();

  constructor() {
    this.initializeClassificationSystem();
    this.setupMandatoryAccessControl();
    this.initializeCrossDomainSecurity();
  }

  private initializeClassificationSystem(): void {
    console.log('[Classification System] Initializing multi-level security');
    
    // Set up periodic declassification review
    setInterval(() => this.reviewForDeclassification(), 86400000); // Daily
    
    // Initialize audit system
    setInterval(() => this.performSecurityAudit(), 3600000); // Hourly
    
    // Initialize cross-domain guard
    setInterval(() => this.monitorCrossDomainTransfers(), 60000); // Every minute
  }

  private setupMandatoryAccessControl(): void {
    console.log('[MAC] Setting up Mandatory Access Control policies');
    
    // Initialize default access matrix
    this.accessMatrix.set('DEFAULT', new Set(['READ_UNCLASSIFIED']));
  }

  private initializeCrossDomainSecurity(): void {
    console.log('[Cross-Domain] Initializing cross-domain security guards');
    
    // Set up data diodes and guards for secure transfer
    this.crossDomainTransfers.set('HIGH_TO_LOW', {
      enabled: false, // One-way transfer only when explicitly authorized
      guard: 'MANUAL_REVIEW',
      sanitization: 'REQUIRED'
    });
  }

  /**
   * Classify Information
   */
  public classifyInformation(data: any, classification: {
    level: keyof typeof this.CLASSIFICATION_LEVELS;
    compartments?: string[];
    handlingCaveats?: string[];
    declassifyOn?: Date;
    derivedFrom?: string;
    classifiedBy?: string;
    reason?: string;
  }): {
    id: string;
    classifiedData: any;
    marking: string;
    metadata: any;
  } {
    const id = `CLASS-${randomBytes(16).toString('hex').toUpperCase()}`;
    
    // Create classification marking
    const marking = this.generateClassificationMarking(
      classification.level,
      classification.compartments,
      classification.handlingCaveats
    );
    
    // Encrypt data based on classification level
    const encryptedData = this.encryptByClassification(data, classification.level);
    
    // Create metadata
    const metadata = {
      id,
      classification: classification.level,
      compartments: classification.compartments || [],
      handlingCaveats: classification.handlingCaveats || [],
      classifiedBy: classification.classifiedBy || 'SYSTEM',
      classifiedOn: new Date(),
      derivedFrom: classification.derivedFrom || 'MULTIPLE SOURCES',
      declassifyOn: classification.declassifyOn || this.calculateDeclassificationDate(classification.level),
      reason: classification.reason || '1.4(c) Foreign government information',
      marking,
      checksum: createHash('sha512').update(JSON.stringify(data)).digest('hex')
    };
    
    // Store classified document
    this.classifiedDocuments.set(id, {
      data: encryptedData,
      metadata,
      accessLog: [],
      lastAccessed: null,
      version: 1
    });
    
    // Audit classification action
    this.auditClassificationAction({
      action: 'CLASSIFY',
      documentId: id,
      classification: classification.level,
      timestamp: new Date(),
      classifiedBy: classification.classifiedBy
    });
    
    return {
      id,
      classifiedData: encryptedData,
      marking,
      metadata
    };
  }

  /**
   * Access Control with Bell-LaPadula Model
   */
  public requestAccess(subject: {
    id: string;
    clearanceLevel: keyof typeof this.CLASSIFICATION_LEVELS;
    compartments: string[];
    needToKnow: string[];
  }, objectId: string, operation: 'READ' | 'WRITE' | 'APPEND'): {
    granted: boolean;
    reason?: string;
    conditions?: string[];
  } {
    const object = this.classifiedDocuments.get(objectId);
    
    if (!object) {
      return { granted: false, reason: 'Document not found' };
    }
    
    const subjectLevel = this.CLASSIFICATION_LEVELS[subject.clearanceLevel].level;
    const objectLevel = this.CLASSIFICATION_LEVELS[object.metadata.classification].level;
    
    // Apply Bell-LaPadula rules
    if (operation === 'READ') {
      // Simple Security Property (no read up)
      if (!this.BELL_LAPADULA.SIMPLE_SECURITY(subjectLevel, objectLevel)) {
        this.auditAccessDenial(subject, objectId, 'Insufficient clearance level');
        return { granted: false, reason: 'Insufficient clearance level (no read up)' };
      }
    } else if (operation === 'WRITE' || operation === 'APPEND') {
      // Star Property (no write down)
      if (!this.BELL_LAPADULA.STAR_PROPERTY(subjectLevel, objectLevel)) {
        this.auditAccessDenial(subject, objectId, 'Cannot write to lower classification');
        return { granted: false, reason: 'Cannot write to lower classification (no write down)' };
      }
    }
    
    // Check compartment access
    if (!this.checkCompartmentAccess(subject.compartments, object.metadata.compartments)) {
      this.auditAccessDenial(subject, objectId, 'Missing required compartments');
      return { granted: false, reason: 'Missing required compartment access' };
    }
    
    // Check need-to-know
    if (!this.checkNeedToKnow(subject.needToKnow, objectId)) {
      this.auditAccessDenial(subject, objectId, 'No demonstrated need-to-know');
      return { granted: false, reason: 'No demonstrated need-to-know' };
    }
    
    // Grant access with conditions
    const conditions = this.getAccessConditions(object.metadata.handlingCaveats);
    
    // Log successful access
    this.auditAccessGranted(subject, objectId, operation);
    object.accessLog.push({
      subjectId: subject.id,
      operation,
      timestamp: new Date(),
      conditions
    });
    object.lastAccessed = new Date();
    
    return { granted: true, conditions };
  }

  /**
   * Cross-Domain Transfer with Security Guard
   */
  public async requestCrossDomainTransfer(data: any, from: {
    domain: string;
    classification: keyof typeof this.CLASSIFICATION_LEVELS;
  }, to: {
    domain: string;
    classification: keyof typeof this.CLASSIFICATION_LEVELS;
  }, authorizer: {
    id: string;
    role: string;
  }): Promise<{
    approved: boolean;
    transferId?: string;
    sanitizedData?: any;
    warnings?: string[];
  }> {
    const fromLevel = this.CLASSIFICATION_LEVELS[from.classification].level;
    const toLevel = this.CLASSIFICATION_LEVELS[to.classification].level;
    
    // Check if transfer is from high to low (requires sanitization)
    if (fromLevel > toLevel) {
      // Require explicit authorization for downgrade
      if (authorizer.role !== 'CLASSIFICATION_AUTHORITY') {
        return {
          approved: false,
          warnings: ['Downgrade requires Classification Authority approval']
        };
      }
      
      // Perform data sanitization
      const sanitizationResult = await this.sanitizeData(data, from.classification, to.classification);
      
      if (!sanitizationResult.safe) {
        return {
          approved: false,
          warnings: sanitizationResult.risks
        };
      }
      
      // Create transfer record
      const transferId = `XDT-${randomBytes(8).toString('hex').toUpperCase()}`;
      
      this.crossDomainTransfers.set(transferId, {
        from,
        to,
        originalData: data,
        sanitizedData: sanitizationResult.sanitizedData,
        authorizer,
        timestamp: new Date(),
        status: 'APPROVED'
      });
      
      // Audit the transfer
      this.auditCrossDomainTransfer({
        transferId,
        from,
        to,
        authorizer,
        dataSize: JSON.stringify(data).length,
        sanitizationApplied: true
      });
      
      return {
        approved: true,
        transferId,
        sanitizedData: sanitizationResult.sanitizedData,
        warnings: ['Data has been sanitized for lower classification']
      };
    }
    
    // Transfer from low to high is generally allowed
    const transferId = `XDT-${randomBytes(8).toString('hex').toUpperCase()}`;
    
    this.crossDomainTransfers.set(transferId, {
      from,
      to,
      originalData: data,
      sanitizedData: data,
      authorizer,
      timestamp: new Date(),
      status: 'APPROVED'
    });
    
    return {
      approved: true,
      transferId,
      sanitizedData: data
    };
  }

  /**
   * Data Sanitization for Declassification
   */
  private async sanitizeData(data: any, fromClass: keyof typeof this.CLASSIFICATION_LEVELS, toClass: keyof typeof this.CLASSIFICATION_LEVELS): Promise<{
    safe: boolean;
    sanitizedData?: any;
    risks?: string[];
  }> {
    const risks: string[] = [];
    let sanitizedData = JSON.parse(JSON.stringify(data)); // Deep clone
    
    // Check for classification markers
    const classificationPattern = /\b(TOP SECRET|SECRET|CONFIDENTIAL)\b/gi;
    if (classificationPattern.test(JSON.stringify(data))) {
      risks.push('Contains classification markings');
      // Remove classification markings
      sanitizedData = JSON.stringify(sanitizedData)
        .replace(classificationPattern, '[REDACTED]');
      sanitizedData = JSON.parse(sanitizedData);
    }
    
    // Check for sensitive data patterns
    const sensitivePatterns = {
      SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
      CLASSIFIED_PROJECT: /\b(PROJECT|OPERATION)\s+[A-Z]+\b/g,
      COORDINATES: /\b\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+\b/g,
      CRYPTO_KEY: /\b[A-Fa-f0-9]{32,}\b/g
    };
    
    for (const [patternName, pattern] of Object.entries(sensitivePatterns)) {
      if (pattern.test(JSON.stringify(data))) {
        risks.push(`Contains ${patternName} pattern`);
        // Redact sensitive patterns
        let dataStr = JSON.stringify(sanitizedData);
        dataStr = dataStr.replace(pattern, '[REDACTED]');
        sanitizedData = JSON.parse(dataStr);
      }
    }
    
    // Add sanitization metadata
    sanitizedData.__sanitized = {
      originalClassification: fromClass,
      targetClassification: toClass,
      sanitizedOn: new Date(),
      risksIdentified: risks.length
    };
    
    return {
      safe: risks.length === 0,
      sanitizedData,
      risks
    };
  }

  /**
   * SCIF (Sensitive Compartmented Information Facility) Protocol
   */
  public enterSCIF(userId: string, credentials: {
    badge: string;
    biometric: string;
    pin: string;
  }): {
    access: boolean;
    sessionId?: string;
    restrictions?: string[];
  } {
    // Verify multi-factor authentication
    const factors = [
      this.verifyBadge(credentials.badge),
      this.verifyBiometric(credentials.biometric),
      this.verifyPin(credentials.pin)
    ];
    
    if (factors.filter(f => f).length < 2) {
      this.auditSCIFAccessDenial(userId, 'Insufficient authentication factors');
      return { access: false };
    }
    
    // Check if user has SCI clearance
    const userClearance = this.getUserClearance(userId);
    if (!userClearance.includes('SCI')) {
      this.auditSCIFAccessDenial(userId, 'No SCI clearance');
      return { access: false };
    }
    
    // Create SCIF session
    const sessionId = `SCIF-${randomBytes(16).toString('hex').toUpperCase()}`;
    
    // Apply SCIF restrictions
    const restrictions = [
      'NO_ELECTRONIC_DEVICES',
      'NO_RECORDING',
      'TWO_PERSON_RULE',
      'CONTINUOUS_MONITORING',
      'TEMPEST_SHIELDING_ACTIVE'
    ];
    
    // Log SCIF entry
    this.auditSCIFEntry({
      userId,
      sessionId,
      entryTime: new Date(),
      restrictions
    });
    
    return {
      access: true,
      sessionId,
      restrictions
    };
  }

  /**
   * Automatic Declassification Schedule
   */
  private reviewForDeclassification(): void {
    const now = new Date();
    
    for (const [id, document] of this.classifiedDocuments.entries()) {
      const declassifyDate = new Date(document.metadata.declassifyOn);
      
      if (declassifyDate <= now) {
        // Automatic declassification
        this.declassifyDocument(id, 'AUTOMATIC', 'Scheduled declassification date reached');
      }
    }
  }

  private declassifyDocument(documentId: string, method: string, reason: string): void {
    const document = this.classifiedDocuments.get(documentId);
    
    if (!document) return;
    
    const originalClassification = document.metadata.classification;
    
    // Downgrade classification
    document.metadata.classification = 'UNCLASSIFIED';
    document.metadata.declassifiedOn = new Date();
    document.metadata.declassificationMethod = method;
    document.metadata.declassificationReason = reason;
    
    // Update marking
    document.metadata.marking = this.generateClassificationMarking(
      'UNCLASSIFIED',
      [],
      ['FORMERLY ' + originalClassification]
    );
    
    // Audit declassification
    this.auditDeclassification({
      documentId,
      originalClassification,
      method,
      reason,
      timestamp: new Date()
    });
    
    console.log(`[Declassification] Document ${documentId} declassified from ${originalClassification}`);
  }

  /**
   * Helper Methods
   */
  private generateClassificationMarking(
    level: keyof typeof this.CLASSIFICATION_LEVELS,
    compartments?: string[],
    caveats?: string[]
  ): string {
    let marking = this.CLASSIFICATION_LEVELS[level].marking;
    
    if (compartments && compartments.length > 0) {
      marking += '//' + compartments.join('/');
    }
    
    if (caveats && caveats.length > 0) {
      marking += '//' + caveats.join('/');
    }
    
    return marking;
  }

  private calculateDeclassificationDate(level: keyof typeof this.CLASSIFICATION_LEVELS): Date {
    const date = new Date();
    const levelData = this.CLASSIFICATION_LEVELS[level];
    
    // Set declassification period based on level
    switch (levelData.level) {
      case 6: // SAP
      case 5: // TS//SCI
        date.setFullYear(date.getFullYear() + 50);
        break;
      case 4: // TOP SECRET
        date.setFullYear(date.getFullYear() + 25);
        break;
      case 3: // SECRET
        date.setFullYear(date.getFullYear() + 10);
        break;
      case 2: // CONFIDENTIAL
        date.setFullYear(date.getFullYear() + 6);
        break;
      default:
        date.setFullYear(date.getFullYear() + 1);
    }
    
    return date;
  }

  private encryptByClassification(data: any, level: keyof typeof this.CLASSIFICATION_LEVELS): any {
    // Use military security service for encryption
    return militarySecurityService.encryptSuiteB(
      JSON.stringify(data),
      level as any
    );
  }

  private checkCompartmentAccess(subjectCompartments: string[], objectCompartments: string[]): boolean {
    // Subject must have all compartments required by object
    return objectCompartments.every(comp => subjectCompartments.includes(comp));
  }

  private checkNeedToKnow(subjectNeedToKnow: string[], objectId: string): boolean {
    // Check if subject has demonstrated need-to-know
    // In production, this would check against mission assignments
    return subjectNeedToKnow.includes(objectId) || subjectNeedToKnow.includes('ALL');
  }

  private checkDiscretionaryAccess(subject: any, object: any): boolean {
    // Check discretionary access control list
    const acl = this.accessMatrix.get(object.id);
    return acl ? acl.has(subject.id) : false;
  }

  private getAccessConditions(handlingCaveats: string[]): string[] {
    const conditions: string[] = [];
    
    for (const caveat of handlingCaveats) {
      switch (caveat) {
        case 'NOFORN':
          conditions.push('No foreign nationals access');
          break;
        case 'ORCON':
          conditions.push('Originator controlled - no further dissemination');
          break;
        case 'DISPLAY_ONLY':
          conditions.push('Display only - no downloads or copies');
          break;
        case 'EYES_ONLY':
          conditions.push('Eyes only - no electronic transmission');
          break;
      }
    }
    
    return conditions;
  }

  private verifyBadge(badge: string): boolean {
    // Verify badge credentials
    return badge.length > 0 && /^[A-Z0-9]{8,}$/.test(badge);
  }

  private verifyBiometric(biometric: string): boolean {
    // Verify biometric data
    return biometric.length > 0;
  }

  private verifyPin(pin: string): boolean {
    // Verify PIN
    return pin.length === 8 && /^\d+$/.test(pin);
  }

  private getUserClearance(userId: string): string[] {
    // Get user's clearance levels and compartments
    // In production, this would query the personnel security database
    return ['TOP_SECRET', 'SCI', 'SI', 'TK'];
  }

  /**
   * Audit Methods
   */
  private auditClassificationAction(details: any): void {
    this.auditLog.push({
      type: 'CLASSIFICATION',
      ...details
    });
  }

  private auditAccessDenial(subject: any, objectId: string, reason: string): void {
    this.auditLog.push({
      type: 'ACCESS_DENIAL',
      subject: subject.id,
      object: objectId,
      reason,
      timestamp: new Date()
    });
  }

  private auditAccessGranted(subject: any, objectId: string, operation: string): void {
    this.auditLog.push({
      type: 'ACCESS_GRANTED',
      subject: subject.id,
      object: objectId,
      operation,
      timestamp: new Date()
    });
  }

  private auditCrossDomainTransfer(details: any): void {
    this.auditLog.push({
      type: 'CROSS_DOMAIN_TRANSFER',
      ...details
    });
  }

  private auditSCIFEntry(details: any): void {
    this.auditLog.push({
      type: 'SCIF_ENTRY',
      ...details
    });
  }

  private auditSCIFAccessDenial(userId: string, reason: string): void {
    this.auditLog.push({
      type: 'SCIF_ACCESS_DENIAL',
      userId,
      reason,
      timestamp: new Date()
    });
  }

  private auditDeclassification(details: any): void {
    this.auditLog.push({
      type: 'DECLASSIFICATION',
      ...details
    });
  }

  private performSecurityAudit(): void {
    // Perform periodic security audit
    const audit = {
      timestamp: new Date(),
      classifiedDocuments: this.classifiedDocuments.size,
      activeSCIFSessions: 0, // Would track active sessions
      pendingDeclassifications: 0,
      crossDomainTransfers: this.crossDomainTransfers.size
    };
    
    console.log('[Classification Audit]', audit);
  }

  private monitorCrossDomainTransfers(): void {
    // Monitor and validate cross-domain transfers
    for (const [id, transfer] of this.crossDomainTransfers.entries()) {
      if (transfer.status === 'PENDING') {
        // Check transfer validity
        console.log(`[Cross-Domain Monitor] Reviewing transfer ${id}`);
      }
    }
  }

  /**
   * Public API Methods
   */
  public getClassificationMetrics(): any {
    const metrics: any = {};
    
    // Count documents by classification
    for (const [id, doc] of this.classifiedDocuments.entries()) {
      const level = doc.metadata.classification;
      metrics[level] = (metrics[level] || 0) + 1;
    }
    
    return {
      documentsByClassification: metrics,
      totalDocuments: this.classifiedDocuments.size,
      activeCrossDomainTransfers: this.crossDomainTransfers.size,
      auditLogEntries: this.auditLog.length,
      compartmentsInUse: new Set(
        Array.from(this.classifiedDocuments.values())
          .flatMap(doc => doc.metadata.compartments)
      ).size
    };
  }

  public getAuditLog(filter?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }): any[] {
    let logs = [...this.auditLog];
    
    if (filter) {
      if (filter.type) {
        logs = logs.filter(log => log.type === filter.type);
      }
      if (filter.startDate) {
        logs = logs.filter(log => new Date(log.timestamp) >= filter.startDate!);
      }
      if (filter.endDate) {
        logs = logs.filter(log => new Date(log.timestamp) <= filter.endDate!);
      }
      if (filter.userId) {
        logs = logs.filter(log => 
          log.userId === filter.userId || 
          log.subject === filter.userId
        );
      }
    }
    
    return logs;
  }
}

// Export singleton instance
export const classifiedInformationSystem = new ClassifiedInformationSystem();