import { storage } from "../storage";
import { enhancedMonitoringService } from "./enhanced-monitoring-service";
import { auditTrailService } from "./audit-trail-service";
import { securityCorrelationEngine } from "./security-correlation-engine";
import { fraudDetectionService } from "./fraud-detection";
import { EventEmitter } from "events";

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: AlertChannel[];
  enabled: boolean;
  cooldown: number; // minutes
  tags: string[];
  escalationRules?: EscalationRule[];
}

export interface AlertCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'pattern';
  value: any;
  timeWindow?: number; // minutes
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'webhook' | 'dashboard' | 'websocket';
  target: string;
  enabled: boolean;
}

export interface EscalationRule {
  afterMinutes: number;
  toSeverity: 'medium' | 'high' | 'critical';
  channels: AlertChannel[];
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  context: any;
  recommendations: string[];
  tags: string[];
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  escalatedAt?: Date;
  escalatedBy?: string;
  channel: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  metadata: {
    userId?: string;
    entityType?: string;
    entityId?: string;
    correlatedEvents?: string[];
    riskScore?: number;
    complianceImpact?: boolean;
  };
}

export interface NotificationTemplate {
  type: 'fraud_detected' | 'security_incident' | 'compliance_violation' | 'system_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendations: string[];
}

export class IntelligentAlertingService extends EventEmitter {
  private static instance: IntelligentAlertingService;
  private alertRules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, Alert>();
  private alertCooldowns = new Map<string, Date>();
  private notificationTemplates = new Map<string, NotificationTemplate>();
  private escalationTimers = new Map<string, NodeJS.Timeout>();

  private constructor() {
    super();
    this.initializeDefaultAlertRules();
    this.initializeNotificationTemplates();
    this.setupEventListeners();
  }

  static getInstance(): IntelligentAlertingService {
    if (!IntelligentAlertingService.instance) {
      IntelligentAlertingService.instance = new IntelligentAlertingService();
    }
    return IntelligentAlertingService.instance;
  }

  /**
   * Process a security event and generate appropriate alerts
   */
  async processSecurityEvent(eventType: string, eventData: any): Promise<void> {
    try {
      for (const rule of Array.from(this.alertRules.values())) {
        if (!rule.enabled) continue;

        if (await this.evaluateAlertRule(rule, eventType, eventData)) {
          await this.triggerAlert(rule, eventType, eventData);
        }
      }
    } catch (error) {
      console.error('Error processing security event:', error);
    }
  }

  /**
   * Create and send an alert
   */
  async triggerAlert(rule: AlertRule, eventType: string, eventData: any): Promise<Alert> {
    try {
      // Check cooldown
      const cooldownKey = `${rule.id}_${eventData.userId || 'system'}`;
      if (this.isInCooldown(cooldownKey, rule.cooldown)) {
        console.log(`Alert ${rule.name} is in cooldown period`);
        throw new Error('Alert is in cooldown period');
      }

      // Generate alert
      const alert = await this.generateAlert(rule, eventType, eventData);
      this.activeAlerts.set(alert.id, alert);

      // Set cooldown
      this.alertCooldowns.set(cooldownKey, new Date(Date.now() + rule.cooldown * 60 * 1000));

      // Send notifications through configured channels
      await this.sendNotifications(alert, rule.channels);

      // Setup escalation if configured
      if (rule.escalationRules && rule.escalationRules.length > 0) {
        this.setupEscalation(alert, rule.escalationRules[0]);
      }

      // Log alert creation
      await auditTrailService.logUserAction(
        'security_alert_triggered',
        'success',
        {
          userId: eventData.userId,
          actionDetails: {
            alertId: alert.id,
            ruleName: rule.name,
            severity: alert.severity,
            eventType
          }
        }
      );

      // Emit real-time alert
      this.emit('alertTriggered', alert);

      console.log(`Alert triggered: ${alert.title} (${alert.severity})`);
      return alert;

    } catch (error) {
      console.error('Error triggering alert:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string, notes?: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      if (alert.status !== 'active' && alert.status !== 'escalated') {
        throw new Error(`Alert ${alertId} cannot be acknowledged (status: ${alert.status})`);
      }

      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;

      this.activeAlerts.set(alertId, alert);

      // Cancel escalation timer if exists
      const escalationTimer = this.escalationTimers.get(alertId);
      if (escalationTimer) {
        clearTimeout(escalationTimer);
        this.escalationTimers.delete(alertId);
      }

      // Log acknowledgment
      await auditTrailService.logAdminAction(
        'security_alert_acknowledged',
        acknowledgedBy,
        'alert',
        alertId,
        {
          actionDetails: {
            alertId,
            notes,
            acknowledgedAt: alert.acknowledgedAt.toISOString()
          }
        }
      );

      this.emit('alertAcknowledged', { alert, acknowledgedBy, notes });
      
      console.log(`Alert acknowledged: ${alertId} by ${acknowledgedBy}`);

    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, resolution: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolvedBy = resolvedBy;

      this.activeAlerts.set(alertId, alert);

      // Cancel escalation timer if exists
      const escalationTimer = this.escalationTimers.get(alertId);
      if (escalationTimer) {
        clearTimeout(escalationTimer);
        this.escalationTimers.delete(alertId);
      }

      // Log resolution
      await auditTrailService.logAdminAction(
        'security_alert_resolved',
        resolvedBy,
        'alert',
        alertId,
        {
          actionDetails: {
            alertId,
            resolution,
            resolvedAt: alert.resolvedAt.toISOString()
          }
        }
      );

      this.emit('alertResolved', { alert, resolvedBy, resolution });

      console.log(`Alert resolved: ${alertId} by ${resolvedBy}`);

    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  /**
   * Escalate an alert
   */
  async escalateAlert(alertId: string, escalatedBy: string, reason: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      alert.status = 'escalated';
      alert.escalatedAt = new Date();
      alert.escalatedBy = escalatedBy;

      // Increase severity if possible
      const severityOrder = ['low', 'medium', 'high', 'critical'];
      const currentIndex = severityOrder.indexOf(alert.severity);
      if (currentIndex < severityOrder.length - 1) {
        alert.severity = severityOrder[currentIndex + 1] as any;
      }

      this.activeAlerts.set(alertId, alert);

      // Send escalation notifications
      const escalationChannels: AlertChannel[] = [
        { type: 'email', target: 'security-lead@dha.gov.za', enabled: true },
        { type: 'dashboard', target: 'admin', enabled: true }
      ];

      await this.sendEscalationNotifications(alert, escalationChannels, reason);

      // Log escalation
      await auditTrailService.logAdminAction(
        'security_alert_escalated',
        escalatedBy,
        'alert',
        alertId,
        {
          actionDetails: {
            alertId,
            reason,
            newSeverity: alert.severity,
            escalatedAt: alert.escalatedAt.toISOString()
          }
        }
      );

      this.emit('alertEscalated', { alert, escalatedBy, reason });

      console.log(`Alert escalated: ${alertId} by ${escalatedBy} (${reason})`);

    } catch (error) {
      console.error('Error escalating alert:', error);
      throw error;
    }
  }

  /**
   * Get active alerts with filtering
   */
  async getAlerts(filters?: {
    severity?: string;
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: Alert[]; total: number }> {
    try {
      let alerts = Array.from(this.activeAlerts.values());

      // Apply filters
      if (filters?.severity) {
        alerts = alerts.filter(alert => alert.severity === filters.severity);
      }

      if (filters?.status) {
        alerts = alerts.filter(alert => alert.status === filters.status);
      }

      if (filters?.userId) {
        alerts = alerts.filter(alert => alert.metadata.userId === filters.userId);
      }

      // Sort by triggered date (newest first)
      alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());

      const total = alerts.length;
      const offset = filters?.offset || 0;
      const limit = filters?.limit || 50;

      alerts = alerts.slice(offset, offset + limit);

      return { alerts, total };

    } catch (error) {
      console.error('Error getting alerts:', error);
      throw error;
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(timeRange?: { start: Date; end: Date }): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    trends: any;
  }> {
    try {
      let alerts = Array.from(this.activeAlerts.values());

      if (timeRange) {
        alerts = alerts.filter(alert => 
          alert.triggeredAt >= timeRange.start && alert.triggeredAt <= timeRange.end
        );
      }

      const stats = {
        total: alerts.length,
        bySeverity: {} as Record<string, number>,
        byStatus: {} as Record<string, number>,
        byType: {} as Record<string, number>,
        trends: await this.calculateAlertTrends(alerts)
      };

      // Count by severity
      alerts.forEach(alert => {
        stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
      });

      // Count by status
      alerts.forEach(alert => {
        stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;
      });

      // Count by rule name (type)
      alerts.forEach(alert => {
        stats.byType[alert.ruleName] = (stats.byType[alert.ruleName] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error('Error calculating alert statistics:', error);
      throw error;
    }
  }

  // ===================== ALERT RULE CRUD METHODS =====================

  /**
   * Add a new alert rule
   */
  async addAlertRule(rule: AlertRule): Promise<void> {
    try {
      // Validate rule doesn't already exist
      if (this.alertRules.has(rule.id)) {
        throw new Error(`Alert rule with ID ${rule.id} already exists`);
      }

      // Add rule to memory
      this.alertRules.set(rule.id, rule);

      console.log(`Alert rule added: ${rule.name} (${rule.id})`);
    } catch (error) {
      console.error('Error adding alert rule:', error);
      throw error;
    }
  }

  /**
   * Get alert rules with filtering
   */
  async getAlertRules(filters?: {
    category?: string;
    isActive?: boolean;
    ruleType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rules: AlertRule[]; total: number }> {
    try {
      let rules = Array.from(this.alertRules.values());

      // Apply filters
      if (filters?.isActive !== undefined) {
        rules = rules.filter(rule => rule.enabled === filters.isActive);
      }

      if (filters?.category) {
        rules = rules.filter(rule => rule.tags.includes(filters.category!));
      }

      // Sort by name
      rules.sort((a, b) => a.name.localeCompare(b.name));

      const total = rules.length;
      const offset = filters?.offset || 0;
      const limit = filters?.limit || 50;

      rules = rules.slice(offset, offset + limit);

      return { rules, total };
    } catch (error) {
      console.error('Error getting alert rules:', error);
      throw error;
    }
  }

  /**
   * Update an alert rule
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      const existingRule = this.alertRules.get(ruleId);
      if (!existingRule) {
        throw new Error(`Alert rule ${ruleId} not found`);
      }

      // Merge updates with existing rule
      const updatedRule = { ...existingRule, ...updates };
      this.alertRules.set(ruleId, updatedRule);

      console.log(`Alert rule updated: ${ruleId}`);
    } catch (error) {
      console.error('Error updating alert rule:', error);
      throw error;
    }
  }

  /**
   * Delete an alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    try {
      const rule = this.alertRules.get(ruleId);
      if (!rule) {
        throw new Error(`Alert rule ${ruleId} not found`);
      }

      // Remove rule from memory
      this.alertRules.delete(ruleId);

      console.log(`Alert rule deleted: ${ruleId}`);
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      throw error;
    }
  }

  /**
   * Toggle alert rule enabled status
   */
  async toggleAlertRule(ruleId: string, enabled: boolean): Promise<void> {
    try {
      const rule = this.alertRules.get(ruleId);
      if (!rule) {
        throw new Error(`Alert rule ${ruleId} not found`);
      }

      rule.enabled = enabled;
      this.alertRules.set(ruleId, rule);

      console.log(`Alert rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling alert rule:', error);
      throw error;
    }
  }

  /**
   * Initialize default alert rules
   */
  private async initializeDefaultAlertRules(): Promise<void> {
    const defaultRules: AlertRule[] = [
      {
        id: 'fraud_high_risk',
        name: 'High Risk Fraud Detection',
        description: 'Triggered when fraud risk score exceeds threshold',
        conditions: [
          { field: 'riskScore', operator: 'gte', value: 70 }
        ],
        severity: 'high',
        channels: [
          { type: 'email', target: 'fraud-team@dha.gov.za', enabled: true },
          { type: 'dashboard', target: 'admin', enabled: true }
        ],
        enabled: true,
        cooldown: 30,
        tags: ['fraud', 'risk'],
        escalationRules: [
          {
            afterMinutes: 60,
            toSeverity: 'critical',
            channels: [
              { type: 'email', target: 'security-lead@dha.gov.za', enabled: true }
            ]
          }
        ]
      },
      {
        id: 'multiple_failed_logins',
        name: 'Multiple Failed Login Attempts',
        description: 'Triggered by repeated login failures',
        conditions: [
          { field: 'failedAttempts', operator: 'gte', value: 5, timeWindow: 15 }
        ],
        severity: 'medium',
        channels: [
          { type: 'dashboard', target: 'admin', enabled: true }
        ],
        enabled: true,
        cooldown: 15,
        tags: ['authentication', 'brute-force']
      },
      {
        id: 'compliance_violation',
        name: 'POPIA Compliance Violation',
        description: 'Triggered by potential privacy compliance violations',
        conditions: [
          { field: 'complianceStatus', operator: 'eq', value: 'non_compliant' }
        ],
        severity: 'critical',
        channels: [
          { type: 'email', target: 'compliance@dha.gov.za', enabled: true },
          { type: 'dashboard', target: 'admin', enabled: true }
        ],
        enabled: true,
        cooldown: 5,
        tags: ['compliance', 'popia', 'privacy']
      },
      {
        id: 'unusual_document_access',
        name: 'Unusual Document Access Pattern',
        description: 'Triggered by abnormal document access patterns',
        conditions: [
          { field: 'documentAccessCount', operator: 'gt', value: 20, timeWindow: 60 }
        ],
        severity: 'medium',
        channels: [
          { type: 'dashboard', target: 'admin', enabled: true }
        ],
        enabled: true,
        cooldown: 60,
        tags: ['document', 'access', 'anomaly']
      },
      {
        id: 'system_performance_degradation',
        name: 'System Performance Degradation',
        description: 'Triggered when system performance drops significantly',
        conditions: [
          { field: 'performanceScore', operator: 'lt', value: 70 }
        ],
        severity: 'high',
        channels: [
          { type: 'email', target: 'tech-support@dha.gov.za', enabled: true },
          { type: 'dashboard', target: 'admin', enabled: true }
        ],
        enabled: true,
        cooldown: 30,
        tags: ['system', 'performance', 'health']
      }
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }

    console.log(`Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * Initialize notification templates
   */
  private initializeNotificationTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        type: 'fraud_detected',
        severity: 'high',
        title: 'High Risk Fraud Activity Detected',
        description: 'Suspicious activity has been detected that may indicate fraudulent behavior',
        recommendations: [
          'Review user activity immediately',
          'Verify user identity through additional authentication',
          'Consider temporary account restrictions',
          'Monitor for related suspicious patterns'
        ]
      },
      {
        type: 'security_incident',
        severity: 'critical',
        title: 'Critical Security Incident',
        description: 'A critical security incident has been detected requiring immediate attention',
        recommendations: [
          'Investigate incident immediately',
          'Secure affected systems',
          'Document incident details',
          'Escalate to security team lead'
        ]
      },
      {
        type: 'compliance_violation',
        severity: 'critical',
        title: 'Privacy Compliance Violation',
        description: 'A potential POPIA compliance violation has been detected',
        recommendations: [
          'Review compliance event details',
          'Document violation circumstances',
          'Implement corrective measures',
          'Report to compliance officer'
        ]
      },
      {
        type: 'system_alert',
        severity: 'medium',
        title: 'System Performance Alert',
        description: 'System performance has degraded below acceptable levels',
        recommendations: [
          'Check system resource utilization',
          'Review recent system changes',
          'Monitor application performance',
          'Consider resource scaling'
        ]
      }
    ];

    templates.forEach(template => {
      const key = `${template.type}_${template.severity}`;
      this.notificationTemplates.set(key, template);
    });

    console.log(`Initialized ${templates.length} notification templates`);
  }

  /**
   * Setup event listeners for real-time alerting
   */
  private setupEventListeners(): void {
    // Listen to monitoring service events
    enhancedMonitoringService.on('securityAlert', (alert) => {
      this.processSecurityEvent('monitoring_alert', alert);
    });

    enhancedMonitoringService.on('fraudAlert', (alert) => {
      this.processSecurityEvent('fraud_detected', alert);
    });

    enhancedMonitoringService.on('highRiskAlert', (alert) => {
      this.processSecurityEvent('high_risk_activity', alert);
    });

    // Listen to correlation engine events
    securityCorrelationEngine.on('securityAlert', (alert) => {
      this.processSecurityEvent('correlation_alert', alert);
    });

    securityCorrelationEngine.on('incidentCreated', (data) => {
      this.processSecurityEvent('security_incident', data);
    });

    // Listen to fraud detection events
    fraudDetectionService.on('activityAlert', (alert) => {
      this.processSecurityEvent('suspicious_activity', alert);
    });

    // Listen to audit trail risk events
    auditTrailService.on('riskDetected', (data) => {
      this.processSecurityEvent('audit_risk', data);
    });

    console.log('Intelligent alerting event listeners initialized');
  }

  /**
   * Evaluate if an alert rule should trigger
   */
  private async evaluateAlertRule(rule: AlertRule, eventType: string, eventData: any): Promise<boolean> {
    try {
      for (const condition of rule.conditions) {
        if (!(await this.evaluateCondition(condition, eventType, eventData))) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error(`Error evaluating alert rule ${rule.id}:`, error);
      return false;
    }
  }

  /**
   * Evaluate individual alert condition
   */
  private async evaluateCondition(condition: AlertCondition, eventType: string, eventData: any): Promise<boolean> {
    const value = this.extractFieldValue(condition.field, eventType, eventData);
    if (value === undefined || value === null) return false;

    switch (condition.operator) {
      case 'gt':
        return value > condition.value;
      case 'gte':
        return value >= condition.value;
      case 'lt':
        return value < condition.value;
      case 'lte':
        return value <= condition.value;
      case 'eq':
        return value === condition.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'pattern':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }

  /**
   * Extract field value from event data
   */
  private extractFieldValue(field: string, eventType: string, eventData: any): any {
    const fieldMap: Record<string, any> = {
      'riskScore': eventData.riskScore || eventData.analysis?.riskScore || 0,
      'failedAttempts': eventData.failedAttempts || 0,
      'complianceStatus': eventData.complianceStatus || 'compliant',
      'documentAccessCount': eventData.documentAccessCount || 0,
      'performanceScore': eventData.performanceScore || eventData.system?.performanceScore || 100
    };

    return fieldMap[field] !== undefined ? fieldMap[field] : eventData[field];
  }

  /**
   * Generate alert from rule and event data
   */
  private async generateAlert(rule: AlertRule, eventType: string, eventData: any): Promise<Alert> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const template = this.getNotificationTemplate(eventType, rule.severity);
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      title: template?.title || `${rule.name} Alert`,
      description: template?.description || rule.description,
      context: eventData,
      recommendations: template?.recommendations || ['Investigate this alert', 'Take appropriate action'],
      tags: [...rule.tags, eventType],
      triggeredAt: new Date(),
      channel: 'intelligent_alerting',
      status: 'active',
      metadata: {
        userId: eventData.userId,
        entityType: eventData.entityType,
        entityId: eventData.entityId,
        correlatedEvents: eventData.correlatedEvents || [],
        riskScore: eventData.riskScore || eventData.analysis?.riskScore,
        complianceImpact: eventData.complianceImpact || eventType.includes('compliance')
      }
    };

    return alert;
  }

  /**
   * Get appropriate notification template
   */
  private getNotificationTemplate(eventType: string, severity: string): NotificationTemplate | undefined {
    const typeMapping: Record<string, string> = {
      'fraud_detected': 'fraud_detected',
      'suspicious_activity': 'fraud_detected',
      'high_risk_activity': 'fraud_detected',
      'security_incident': 'security_incident',
      'correlation_alert': 'security_incident',
      'compliance_violation': 'compliance_violation',
      'audit_risk': 'compliance_violation',
      'monitoring_alert': 'system_alert'
    };

    const templateType = typeMapping[eventType] || 'system_alert';
    const templateKey = `${templateType}_${severity}`;
    
    return this.notificationTemplates.get(templateKey) || 
           this.notificationTemplates.get(`${templateType}_medium`);
  }

  /**
   * Check if alert is in cooldown period
   */
  private isInCooldown(cooldownKey: string, cooldownMinutes: number): boolean {
    const lastAlert = this.alertCooldowns.get(cooldownKey);
    if (!lastAlert) return false;
    
    const cooldownEnd = new Date(lastAlert.getTime() + cooldownMinutes * 60 * 1000);
    return new Date() < cooldownEnd;
  }

  /**
   * Send notifications through configured channels
   */
  private async sendNotifications(alert: Alert, channels: AlertChannel[]): Promise<void> {
    for (const channel of channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        console.error(`Error sending notification via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send individual notification
   */
  private async sendNotification(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel.target);
        break;
      case 'dashboard':
        await this.sendDashboardNotification(alert);
        break;
      case 'websocket':
        await this.sendWebSocketNotification(alert);
        break;
      default:
        console.log(`Notification sent via ${channel.type} to ${channel.target}: ${alert.title}`);
    }
  }

  /**
   * Setup alert escalation
   */
  private setupEscalation(alert: Alert, escalationRule: EscalationRule): void {
    const timer = setTimeout(async () => {
      try {
        if (this.activeAlerts.get(alert.id)?.status === 'active') {
          await this.escalateAlert(alert.id, 'system', 'Automatic escalation after timeout');
        }
      } catch (error) {
        console.error(`Error in automatic escalation for alert ${alert.id}:`, error);
      }
    }, escalationRule.afterMinutes * 60 * 1000);

    this.escalationTimers.set(alert.id, timer);
  }

  /**
   * Send escalation notifications
   */
  private async sendEscalationNotifications(alert: Alert, channels: AlertChannel[], reason: string): Promise<void> {
    const escalationAlert = {
      ...alert,
      title: `ESCALATED: ${alert.title}`,
      description: `${alert.description}\n\nEscalation Reason: ${reason}`
    };

    await this.sendNotifications(escalationAlert, channels);
  }

  /**
   * Calculate alert trends
   */
  private async calculateAlertTrends(alerts: Alert[]): Promise<any> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const previous24h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const recent = alerts.filter(alert => alert.triggeredAt >= last24h).length;
    const previous = alerts.filter(alert => 
      alert.triggeredAt >= previous24h && alert.triggeredAt < last24h
    ).length;

    const change = recent - previous;
    const trend = change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable';
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    return {
      recent,
      previous,
      change,
      changePercent,
      trend
    };
  }

  /**
   * Notification implementation methods (simplified)
   */
  private async sendEmailNotification(alert: Alert, target: string): Promise<void> {
    console.log(`Email notification sent to ${target}: ${alert.title}`);
    // In production, integrate with email service
  }

  private async sendDashboardNotification(alert: Alert): Promise<void> {
    this.emit('dashboardAlert', alert);
    console.log(`Dashboard notification: ${alert.title}`);
  }

  private async sendWebSocketNotification(alert: Alert): Promise<void> {
    this.emit('websocketAlert', alert);
    console.log(`WebSocket notification: ${alert.title}`);
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    // Clear all escalation timers
    for (const timer of Array.from(this.escalationTimers.values())) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();
    
    // Clear data
    this.activeAlerts.clear();
    this.alertCooldowns.clear();
    
    // Remove all listeners
    this.removeAllListeners();

    console.log('Intelligent alerting service shutdown complete');
  }
}

export const intelligentAlertingService = IntelligentAlertingService.getInstance();