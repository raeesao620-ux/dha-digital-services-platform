import { storage } from "../storage";
import { auditTrailService } from "./audit-trail-service";
import { type InsertSecurityIncident, type InsertSecurityRule } from "@shared/schema";
import { EventEmitter } from "events";

export interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  conditions: PatternCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: PatternAction[];
  enabled: boolean;
}

export interface PatternCondition {
  type: 'event_frequency' | 'user_behavior' | 'time_pattern' | 'location_anomaly' | 'correlation';
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'pattern';
  value: any;
  timeWindow?: number; // in minutes
}

export interface PatternAction {
  type: 'create_incident' | 'send_alert' | 'block_user' | 'require_mfa' | 'log_event';
  parameters: any;
}

export interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  userId?: string;
  details: any;
  timestamp: Date;
  correlatedEvents?: string[];
}

export class SecurityCorrelationEngine extends EventEmitter {
  private static instance: SecurityCorrelationEngine;
  private patterns: Map<string, SecurityPattern> = new Map();
  private eventBuffer: SecurityEvent[] = [];
  private correlationWindow = 30 * 60 * 1000; // 30 minutes
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.initializeDefaultPatterns();
    this.startCorrelationProcessing();
    this.setupEventListeners();
  }

  static getInstance(): SecurityCorrelationEngine {
    if (!SecurityCorrelationEngine.instance) {
      SecurityCorrelationEngine.instance = new SecurityCorrelationEngine();
    }
    return SecurityCorrelationEngine.instance;
  }

  /**
   * Add security event to correlation engine
   */
  async addSecurityEvent(event: SecurityEvent): Promise<void> {
    this.eventBuffer.push(event);
    
    // Keep buffer size manageable
    if (this.eventBuffer.length > 1000) {
      this.eventBuffer = this.eventBuffer.slice(-500);
    }

    // Immediate correlation check for critical events
    if (event.severity === 'critical' || event.severity === 'high') {
      await this.performImmediateCorrelation(event);
    }

    this.emit('securityEvent', event);
  }

  /**
   * Register a new security pattern
   */
  async registerPattern(pattern: SecurityPattern): Promise<void> {
    this.patterns.set(pattern.id, pattern);
    
    // Store pattern as security rule
    await storage.createSecurityRule({
      name: pattern.name,
      description: pattern.description,
      category: 'correlation',
      ruleType: 'pattern',
      conditions: pattern.conditions,
      actions: pattern.actions,
      severity: pattern.severity,
      isActive: pattern.enabled,
      createdBy: 'system' // System-created rule
    });

    console.log(`Security pattern registered: ${pattern.name}`);
  }

  /**
   * Initialize default security patterns
   */
  private async initializeDefaultPatterns(): Promise<void> {
    const defaultPatterns: SecurityPattern[] = [
      {
        id: 'multiple_failed_logins',
        name: 'Multiple Failed Login Attempts',
        description: 'Detects multiple failed login attempts from same IP or user',
        conditions: [
          {
            type: 'event_frequency',
            field: 'login_failed',
            operator: 'gt',
            value: 5,
            timeWindow: 15
          }
        ],
        severity: 'high',
        actions: [
          { type: 'create_incident', parameters: { type: 'brute_force_attack' } },
          { type: 'send_alert', parameters: { priority: 'high' } }
        ],
        enabled: true
      },
      {
        id: 'unusual_document_access',
        name: 'Unusual Document Access Pattern',
        description: 'Detects unusual patterns in document access',
        conditions: [
          {
            type: 'event_frequency',
            field: 'document_accessed',
            operator: 'gt',
            value: 20,
            timeWindow: 60
          },
          {
            type: 'time_pattern',
            field: 'timestamp',
            operator: 'pattern',
            value: 'outside_business_hours'
          }
        ],
        severity: 'medium',
        actions: [
          { type: 'send_alert', parameters: { priority: 'medium' } },
          { type: 'require_mfa', parameters: { duration: 3600 } }
        ],
        enabled: true
      },
      {
        id: 'geographic_anomaly',
        name: 'Geographic Access Anomaly',
        description: 'Detects access from unusual geographic locations',
        conditions: [
          {
            type: 'location_anomaly',
            field: 'location',
            operator: 'pattern',
            value: 'unusual_location'
          }
        ],
        severity: 'medium',
        actions: [
          { type: 'send_alert', parameters: { priority: 'medium' } },
          { type: 'log_event', parameters: { category: 'location_anomaly' } }
        ],
        enabled: true
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation Attempt',
        description: 'Detects potential privilege escalation attempts',
        conditions: [
          {
            type: 'correlation',
            field: 'admin_action',
            operator: 'pattern',
            value: 'unauthorized_admin_access'
          }
        ],
        severity: 'critical',
        actions: [
          { type: 'create_incident', parameters: { type: 'privilege_escalation' } },
          { type: 'send_alert', parameters: { priority: 'critical' } },
          { type: 'block_user', parameters: { duration: 3600 } }
        ],
        enabled: true
      },
      {
        id: 'mass_data_access',
        name: 'Mass Data Access',
        description: 'Detects attempts to access large amounts of data',
        conditions: [
          {
            type: 'event_frequency',
            field: 'document_downloaded',
            operator: 'gt',
            value: 10,
            timeWindow: 10
          }
        ],
        severity: 'high',
        actions: [
          { type: 'create_incident', parameters: { type: 'data_exfiltration' } },
          { type: 'send_alert', parameters: { priority: 'high' } }
        ],
        enabled: true
      }
    ];

    for (const pattern of defaultPatterns) {
      await this.registerPattern(pattern);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to audit trail events
    auditTrailService.on('auditLog', async (data) => {
      const securityEvent: SecurityEvent = {
        id: data.auditLog.id,
        type: data.auditLog.action,
        severity: this.calculateSeverityFromRisk(data.auditLog.riskScore || 0),
        userId: data.auditLog.userId || undefined,
        details: data.auditLog.actionDetails,
        timestamp: data.auditLog.createdAt
      };

      await this.addSecurityEvent(securityEvent);
    });

    // Listen to risk detection events
    auditTrailService.on('riskDetected', async (data) => {
      const securityEvent: SecurityEvent = {
        id: `risk_${Date.now()}_${data.userId}`,
        type: 'risk_detected',
        severity: data.riskScore > 70 ? 'high' : 'medium',
        userId: data.userId,
        details: {
          riskScore: data.riskScore,
          riskFactors: data.riskFactors,
          action: data.action
        },
        timestamp: new Date()
      };

      await this.addSecurityEvent(securityEvent);
    });
  }

  /**
   * Start correlation processing
   */
  private startCorrelationProcessing(): void {
    this.processingInterval = setInterval(async () => {
      await this.performCorrelationAnalysis();
    }, 60000); // Process every minute
  }

  /**
   * Perform immediate correlation for critical events
   */
  private async performImmediateCorrelation(event: SecurityEvent): Promise<void> {
    try {
      for (const pattern of this.patterns.values()) {
        if (!pattern.enabled) continue;

        const matches = await this.checkPatternMatch(pattern, [event]);
        if (matches) {
          await this.executePatternActions(pattern, [event]);
        }
      }
    } catch (error) {
      console.error('Immediate correlation error:', error);
    }
  }

  /**
   * Perform correlation analysis on buffered events
   */
  private async performCorrelationAnalysis(): Promise<void> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.correlationWindow);
      
      // Filter events within correlation window
      const recentEvents = this.eventBuffer.filter(event => 
        event.timestamp >= windowStart
      );

      if (recentEvents.length === 0) return;

      // Group events by user and type for pattern matching
      const eventGroups = this.groupEvents(recentEvents);

      // Check each pattern against event groups
      for (const pattern of this.patterns.values()) {
        if (!pattern.enabled) continue;

        for (const [groupKey, events] of eventGroups) {
          const matches = await this.checkPatternMatch(pattern, events);
          if (matches) {
            await this.executePatternActions(pattern, events);
            
            // Update pattern statistics
            await this.updatePatternStats(pattern.id);
          }
        }
      }

      // Clean old events from buffer
      this.eventBuffer = this.eventBuffer.filter(event => 
        event.timestamp >= windowStart
      );

    } catch (error) {
      console.error('Correlation analysis error:', error);
    }
  }

  /**
   * Group events for pattern matching
   */
  private groupEvents(events: SecurityEvent[]): Map<string, SecurityEvent[]> {
    const groups = new Map<string, SecurityEvent[]>();

    for (const event of events) {
      // Group by user
      if (event.userId) {
        const userKey = `user_${event.userId}`;
        if (!groups.has(userKey)) groups.set(userKey, []);
        groups.get(userKey)!.push(event);
      }

      // Group by type
      const typeKey = `type_${event.type}`;
      if (!groups.has(typeKey)) groups.set(typeKey, []);
      groups.get(typeKey)!.push(event);

      // Group by IP (if available)
      const ip = event.details?.ipAddress;
      if (ip) {
        const ipKey = `ip_${ip}`;
        if (!groups.has(ipKey)) groups.set(ipKey, []);
        groups.get(ipKey)!.push(event);
      }
    }

    return groups;
  }

  /**
   * Check if events match a security pattern
   */
  private async checkPatternMatch(pattern: SecurityPattern, events: SecurityEvent[]): Promise<boolean> {
    for (const condition of pattern.conditions) {
      if (!(await this.checkCondition(condition, events))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check individual pattern condition
   */
  private async checkCondition(condition: PatternCondition, events: SecurityEvent[]): Promise<boolean> {
    switch (condition.type) {
      case 'event_frequency':
        return this.checkEventFrequency(condition, events);
      
      case 'user_behavior':
        return await this.checkUserBehavior(condition, events);
      
      case 'time_pattern':
        return this.checkTimePattern(condition, events);
      
      case 'location_anomaly':
        return this.checkLocationAnomaly(condition, events);
      
      case 'correlation':
        return await this.checkCorrelation(condition, events);
      
      default:
        return false;
    }
  }

  /**
   * Check event frequency condition
   */
  private checkEventFrequency(condition: PatternCondition, events: SecurityEvent[]): boolean {
    const relevantEvents = events.filter(event => 
      event.type.includes(condition.field) || 
      event.details?.[condition.field]
    );

    const timeWindow = condition.timeWindow || 60; // minutes
    const cutoffTime = new Date(Date.now() - timeWindow * 60 * 1000);
    const recentEvents = relevantEvents.filter(event => event.timestamp >= cutoffTime);

    switch (condition.operator) {
      case 'gt':
        return recentEvents.length > condition.value;
      case 'lt':
        return recentEvents.length < condition.value;
      case 'eq':
        return recentEvents.length === condition.value;
      default:
        return false;
    }
  }

  /**
   * Check user behavior condition
   */
  private async checkUserBehavior(condition: PatternCondition, events: SecurityEvent[]): Promise<boolean> {
    const userIds = [...new Set(events.map(e => e.userId).filter(Boolean))];
    
    for (const userId of userIds) {
      if (!userId) continue;
      
      const analysis = await storage.analyzeUserBehavior(userId);
      
      switch (condition.operator) {
        case 'gt':
          if (analysis.riskScore > condition.value) return true;
          break;
        case 'contains':
          if (analysis.anomalies.some(a => a.includes(condition.value))) return true;
          break;
      }
    }

    return false;
  }

  /**
   * Check time pattern condition
   */
  private checkTimePattern(condition: PatternCondition, events: SecurityEvent[]): boolean {
    if (condition.value === 'outside_business_hours') {
      return events.some(event => {
        const hour = event.timestamp.getHours();
        return hour < 8 || hour > 18; // Outside 8 AM - 6 PM
      });
    }
    
    return false;
  }

  /**
   * Check location anomaly condition
   */
  private checkLocationAnomaly(condition: PatternCondition, events: SecurityEvent[]): boolean {
    // Simplified location anomaly detection
    const locations = events
      .map(e => e.details?.location)
      .filter(Boolean);

    if (locations.length === 0) return false;

    // Check for multiple distinct locations in short timeframe
    const uniqueLocations = [...new Set(locations)];
    return uniqueLocations.length > 2;
  }

  /**
   * Check correlation condition
   */
  private async checkCorrelation(condition: PatternCondition, events: SecurityEvent[]): Promise<boolean> {
    if (condition.value === 'unauthorized_admin_access') {
      return events.some(event => 
        event.type.includes('admin') && event.severity === 'high'
      );
    }

    return false;
  }

  /**
   * Execute pattern actions
   */
  private async executePatternActions(pattern: SecurityPattern, events: SecurityEvent[]): Promise<void> {
    for (const action of pattern.actions) {
      try {
        await this.executeAction(action, pattern, events);
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(action: PatternAction, pattern: SecurityPattern, events: SecurityEvent[]): Promise<void> {
    switch (action.type) {
      case 'create_incident':
        await this.createSecurityIncident(pattern, events, action.parameters);
        break;
      
      case 'send_alert':
        await this.sendSecurityAlert(pattern, events, action.parameters);
        break;
      
      case 'block_user':
        await this.blockUser(events, action.parameters);
        break;
      
      case 'require_mfa':
        await this.requireMFA(events, action.parameters);
        break;
      
      case 'log_event':
        await this.logSecurityEvent(pattern, events, action.parameters);
        break;
    }
  }

  /**
   * Create security incident
   */
  private async createSecurityIncident(pattern: SecurityPattern, events: SecurityEvent[], parameters: any): Promise<void> {
    const affectedUsers = [...new Set(events.map(e => e.userId).filter(Boolean))];
    const correlatedEventIds = events.map(e => e.id);

    const incident: InsertSecurityIncident = {
      incidentType: parameters.type || pattern.name.toLowerCase().replace(/\s+/g, '_'),
      severity: pattern.severity,
      title: `${pattern.name} Detected`,
      description: `Security pattern "${pattern.name}" was triggered. ${pattern.description}`,
      triggeredBy: 'automated_rule',
      affectedUsers,
      correlatedEvents: correlatedEventIds,
      riskAssessment: {
        riskLevel: pattern.severity,
        eventCount: events.length,
        timespan: this.calculateTimespan(events),
        patterns: [pattern.name]
      }
    };

    const createdIncident = await storage.createSecurityIncident(incident);
    
    this.emit('incidentCreated', {
      incident: createdIncident,
      pattern,
      events
    });

    console.log(`Security incident created: ${createdIncident.id} - ${pattern.name}`);
  }

  /**
   * Send security alert
   */
  private async sendSecurityAlert(pattern: SecurityPattern, events: SecurityEvent[], parameters: any): Promise<void> {
    this.emit('securityAlert', {
      priority: parameters.priority || pattern.severity,
      title: `Security Alert: ${pattern.name}`,
      message: `${pattern.description} - ${events.length} events detected`,
      pattern,
      events,
      timestamp: new Date()
    });
  }

  /**
   * Block user (placeholder - would integrate with authentication system)
   */
  private async blockUser(events: SecurityEvent[], parameters: any): Promise<void> {
    const userIds = [...new Set(events.map(e => e.userId).filter(Boolean))];
    
    for (const userId of userIds) {
      if (!userId) continue;
      
      // In a real implementation, this would integrate with the authentication system
      console.log(`User ${userId} would be blocked for ${parameters.duration || 3600} seconds`);
      
      this.emit('userBlocked', {
        userId,
        duration: parameters.duration || 3600,
        reason: 'Security pattern triggered',
        events
      });
    }
  }

  /**
   * Require MFA (placeholder)
   */
  private async requireMFA(events: SecurityEvent[], parameters: any): Promise<void> {
    const userIds = [...new Set(events.map(e => e.userId).filter(Boolean))];
    
    for (const userId of userIds) {
      if (!userId) continue;
      
      console.log(`MFA required for user ${userId} for ${parameters.duration || 3600} seconds`);
      
      this.emit('mfaRequired', {
        userId,
        duration: parameters.duration || 3600,
        events
      });
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(pattern: SecurityPattern, events: SecurityEvent[], parameters: any): Promise<void> {
    await auditTrailService.logUserAction(
      'security_pattern_triggered',
      'success',
      {
        actionDetails: {
          patternName: pattern.name,
          patternId: pattern.id,
          eventCount: events.length,
          category: parameters.category || 'security_correlation'
        }
      }
    );
  }

  /**
   * Update pattern statistics
   */
  private async updatePatternStats(patternId: string): Promise<void> {
    const rules = await storage.getSecurityRules({ category: 'correlation' });
    const rule = rules.find(r => r.name === this.patterns.get(patternId)?.name);
    
    if (rule) {
      await storage.incrementRuleTriggeredCount(rule.id);
    }
  }

  /**
   * Calculate severity from risk score
   */
  private calculateSeverityFromRisk(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  /**
   * Calculate timespan of events
   */
  private calculateTimespan(events: SecurityEvent[]): number {
    if (events.length < 2) return 0;
    
    const timestamps = events.map(e => e.timestamp.getTime()).sort();
    return timestamps[timestamps.length - 1] - timestamps[0];
  }

  /**
   * Cleanup and stop processing
   */
  public shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

export const securityCorrelationEngine = SecurityCorrelationEngine.getInstance();