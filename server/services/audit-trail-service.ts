import { storage } from "../storage";
import { type InsertAuditLog, type InsertComplianceEvent, AuditAction, ComplianceEventType } from "@shared/schema";
import { EventEmitter } from "events";

export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  entityType?: string;
  entityId?: string;
  previousState?: unknown;
  newState?: unknown;
  actionDetails: unknown;
  riskScore?: number;
  complianceFlags?: unknown;
}

export class AuditTrailService extends EventEmitter {
  private static instance: AuditTrailService;
  
  private constructor() {
    super();
  }
  
  static getInstance(): AuditTrailService {
    if (!AuditTrailService.instance) {
      AuditTrailService.instance = new AuditTrailService();
    }
    return AuditTrailService.instance;
  }

  /**
   * Log user action with full audit trail
   */
  async logUserAction(
    action: string,
    outcome: 'success' | 'failure' | 'partial',
    context: AuditContext
  ): Promise<void> {
    try {
      // Create audit log entry
      const auditLog: InsertAuditLog = {
        userId: context.userId || null,
        action,
        entityType: context.entityType || null,
        entityId: context.entityId || null,
        previousState: context.previousState || null,
        newState: context.newState || null,
        actionDetails: context.actionDetails,
        outcome,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        location: context.location || null,
        riskScore: context.riskScore || null,
        complianceFlags: context.complianceFlags || null,
      };

      const createdLog = await storage.createAuditLog(auditLog);

      // Emit audit event for real-time monitoring
      this.emit('auditLog', {
        auditLog: createdLog,
        context
      });

      // Check if this requires compliance logging
      await this.handleComplianceLogging(action, context);

      // Analyze risk patterns
      if (context.userId) {
        await this.analyzeActionRisk(context.userId, action, outcome, context);
      }

      console.log(`Audit logged: ${action} - ${outcome}`, {
        userId: context.userId,
        action,
        outcome
      });

    } catch (error) {
      console.error("Failed to log audit trail:", error);
      // Don't throw - audit failures shouldn't break application flow
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    eventType: 'login_attempt' | 'login_success' | 'login_failed' | 'logout' | 'password_changed',
    userId: string | null,
    context: Omit<AuditContext, 'userId'>
  ): Promise<void> {
    const actionMap = {
      login_attempt: AuditAction.LOGIN_ATTEMPT,
      login_success: AuditAction.LOGIN_SUCCESS,
      login_failed: AuditAction.LOGIN_FAILED,
      logout: AuditAction.LOGOUT,
      password_changed: AuditAction.PASSWORD_CHANGED
    };

    await this.logUserAction(
      actionMap[eventType],
      eventType === 'login_failed' ? 'failure' : 'success',
      { ...context, userId: userId || undefined }
    );
  }

  /**
   * Log document-related events
   */
  async logDocumentEvent(
    eventType: 'uploaded' | 'downloaded' | 'viewed' | 'deleted' | 'modified' | 'verified',
    userId: string,
    documentId: string,
    context: Omit<AuditContext, 'userId' | 'entityType' | 'entityId'>
  ): Promise<void> {
    const actionMap = {
      uploaded: AuditAction.DOCUMENT_UPLOADED,
      downloaded: AuditAction.DOCUMENT_DOWNLOADED,
      viewed: AuditAction.DOCUMENT_VIEWED,
      deleted: AuditAction.DOCUMENT_DELETED,
      modified: AuditAction.DOCUMENT_MODIFIED,
      verified: AuditAction.DOCUMENT_VERIFIED
    };

    await this.logUserAction(
      actionMap[eventType],
      'success',
      {
        ...context,
        userId,
        entityType: 'document',
        entityId: documentId
      }
    );
  }

  /**
   * Log admin actions
   */
  async logAdminAction(
    action: string,
    adminId: string,
    targetEntityType?: string,
    targetEntityId?: string,
    context?: Partial<AuditContext>
  ): Promise<void> {
    await this.logUserAction(
      action,
      'success',
      {
        ...context,
        userId: adminId,
        entityType: targetEntityType,
        entityId: targetEntityId,
        actionDetails: {
          adminAction: true,
          ...(context?.actionDetails && typeof context.actionDetails === 'object' ? context.actionDetails as Record<string, unknown> : {})
        }
      }
    );
  }

  /**
   * Log API and integration events
   */
  async logApiEvent(
    eventType: 'api_call' | 'dha_call' | 'saps_call' | 'icao_call',
    userId: string | null,
    endpoint: string,
    method: string,
    statusCode: number,
    context: Partial<AuditContext> = {}
  ): Promise<void> {
    const actionMap = {
      api_call: AuditAction.API_CALL,
      dha_call: AuditAction.DHA_API_CALL,
      saps_call: AuditAction.SAPS_API_CALL,
      icao_call: AuditAction.ICAO_API_CALL
    };

    await this.logUserAction(
      actionMap[eventType],
      statusCode < 400 ? 'success' : 'failure',
      {
        ...context,
        userId: userId || undefined,
        actionDetails: {
          endpoint,
          method,
          statusCode,
          ...(context.actionDetails && typeof context.actionDetails === 'object' ? context.actionDetails as Record<string, unknown> : {})
        }
      }
    );
  }

  /**
   * Handle compliance-specific logging for POPIA
   */
  private async handleComplianceLogging(action: string, context: AuditContext): Promise<void> {
    const complianceActions = [
      AuditAction.DOCUMENT_VIEWED,
      AuditAction.DOCUMENT_DOWNLOADED,
      AuditAction.DOCUMENT_MODIFIED,
      AuditAction.DOCUMENT_DELETED,
      AuditAction.USER_CREATED,
      AuditAction.USER_UPDATED
    ];

    if (!complianceActions.includes(action as (typeof complianceActions)[number]) || !context.userId) {
      return;
    }

    const eventTypeMap: Record<string, string> = {
      [AuditAction.DOCUMENT_VIEWED]: ComplianceEventType.DATA_ACCESSED,
      [AuditAction.DOCUMENT_DOWNLOADED]: ComplianceEventType.DATA_ACCESSED,
      [AuditAction.DOCUMENT_MODIFIED]: ComplianceEventType.DATA_MODIFIED,
      [AuditAction.DOCUMENT_DELETED]: ComplianceEventType.DATA_DELETED,
      [AuditAction.USER_CREATED]: ComplianceEventType.DATA_ACCESSED,
      [AuditAction.USER_UPDATED]: ComplianceEventType.DATA_MODIFIED
    };

    const complianceEvent: InsertComplianceEvent = {
      eventType: eventTypeMap[action],
      userId: context.userId,
      dataSubjectId: context.userId, // In most cases, user is acting on their own data
      dataCategory: context.entityType === 'document' ? 'document' : 'personal',
      processingPurpose: this.getProcessingPurpose(action),
      legalBasis: 'consent',
      processingDetails: {
        action,
        entityType: context.entityType,
        entityId: context.entityId,
        timestamp: new Date().toISOString()
      },
      complianceStatus: 'compliant'
    };

    await storage.createComplianceEvent(complianceEvent);
  }

  /**
   * Analyze action risk patterns
   */
  private async analyzeActionRisk(
    userId: string,
    action: string,
    outcome: string,
    context: AuditContext
  ): Promise<void> {
    try {
      // Get recent user actions
      const recentActions = await storage.getAuditLogs({
        userId,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        limit: 100
      });

      // Calculate risk factors
      let riskScore = 0;
      const riskFactors: string[] = [];

      // High volume of actions
      if (recentActions.length > 50) {
        riskScore += 20;
        riskFactors.push('high_activity_volume');
      }

      // Failed actions ratio
      const failedActions = recentActions.filter(log => log.outcome === 'failure').length;
      const failureRate = failedActions / Math.max(recentActions.length, 1);
      if (failureRate > 0.3) {
        riskScore += 30;
        riskFactors.push('high_failure_rate');
      }

      // Suspicious time patterns
      const currentHour = new Date().getHours();
      if (currentHour < 6 || currentHour > 22) {
        riskScore += 15;
        riskFactors.push('unusual_time');
      }

      // Multiple IP addresses
      const ipAddresses = Array.from(new Set(recentActions.map(log => log.ipAddress).filter(Boolean)));
      if (ipAddresses.length > 3) {
        riskScore += 25;
        riskFactors.push('multiple_ip_addresses');
      }

      // Update user behavior profile
      if (riskScore > 40) {
        const existingProfile = await storage.getUserBehaviorProfile(userId);
        if (existingProfile) {
          await storage.updateUserBehaviorProfile(userId, {
            riskFactors: riskFactors,
            lastAnalyzed: new Date()
          });
        } else {
          await storage.createUserBehaviorProfile({
            userId,
            typicalLocations: context.location ? [context.location] : [],
            typicalDevices: [],
            typicalTimes: { currentHour: [currentHour] },
            loginPatterns: {},
            documentPatterns: {},
            riskFactors: riskFactors,
            baselineScore: riskScore
          });
        }

        // Emit risk event for real-time monitoring
        this.emit('riskDetected', {
          userId,
          riskScore,
          riskFactors,
          action,
          context
        });
      }

    } catch (error) {
      console.error("Failed to analyze action risk:", error);
    }
  }

  /**
   * Get POPIA processing purpose based on action
   */
  private getProcessingPurpose(action: string): string {
    const purposeMap: Record<string, string> = {
      [AuditAction.DOCUMENT_VIEWED]: 'Document verification and processing',
      [AuditAction.DOCUMENT_DOWNLOADED]: 'Document access for official purposes',
      [AuditAction.DOCUMENT_MODIFIED]: 'Document correction and updates',
      [AuditAction.DOCUMENT_DELETED]: 'Data retention compliance',
      [AuditAction.USER_CREATED]: 'Account creation and identity verification',
      [AuditAction.USER_UPDATED]: 'Profile maintenance and accuracy'
    };

    return purposeMap[action] || 'System operation and service delivery';
  }

  /**
   * Get audit logs with advanced filtering
   */
  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    entityType?: string;
    dateRange?: { start: Date; end: Date };
    riskThreshold?: number;
    limit?: number;
  }) {
    return await storage.getAuditLogs({
      userId: filters.userId,
      action: filters.action,
      entityType: filters.entityType,
      startDate: filters.dateRange?.start,
      endDate: filters.dateRange?.end,
      limit: filters.limit || 50
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(regulation: 'POPIA' | 'GDPR', period: { start: Date; end: Date }) {
    return await storage.getComplianceReport(regulation, period.start, period.end);
  }
}

export const auditTrailService = AuditTrailService.getInstance();