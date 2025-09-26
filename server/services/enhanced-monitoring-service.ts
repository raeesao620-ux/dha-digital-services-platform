import { storage } from "../storage";
import { auditTrailService } from "./audit-trail-service";
import { securityCorrelationEngine } from "./security-correlation-engine";
import { fraudDetectionService } from "./fraud-detection";
import { type InsertSecurityMetric } from "@shared/schema";
import { EventEmitter } from "events";

export interface SecurityMetrics {
  // Real-time metrics
  activeUsers: number;
  activeSessions: number;
  alertsLast24h: number;
  criticalIncidents: number;
  
  // Fraud detection metrics
  fraudScore: {
    average: number;
    high: number;
    critical: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  
  // Authentication metrics
  loginAttempts: {
    total: number;
    successful: number;
    failed: number;
    failureRate: number;
  };
  
  // Document security metrics
  documentAccess: {
    totalAccess: number;
    downloads: number;
    modifications: number;
    verifications: number;
    suspiciousActivity: number;
  };
  
  // Compliance metrics
  compliance: {
    popiaCompliance: number;
    dataAccessRequests: number;
    privacyViolations: number;
    retentionCompliance: number;
  };
  
  // System health metrics
  system: {
    apiResponseTime: number;
    errorRate: number;
    integrationStatus: Record<string, 'healthy' | 'warning' | 'critical'>;
    performanceScore: number;
  };
}

export interface SecurityAlert {
  id: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  context: any;
  recommendations: string[];
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  assignedTo?: string;
  tags: string[];
}

export interface SecurityTrend {
  metric: string;
  timeframe: '1h' | '24h' | '7d' | '30d';
  dataPoints: { timestamp: Date; value: number }[];
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export class EnhancedMonitoringService extends EventEmitter {
  private static instance: EnhancedMonitoringService;
  private metricsCache = new Map<string, { data: any; timestamp: Date }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = new Map<string, number>();

  private constructor() {
    super();
    this.initializeDefaultThresholds();
    this.setupEventListeners();
    this.startPeriodicMonitoring();
  }

  static getInstance(): EnhancedMonitoringService {
    if (!EnhancedMonitoringService.instance) {
      EnhancedMonitoringService.instance = new EnhancedMonitoringService();
    }
    return EnhancedMonitoringService.instance;
  }

  /**
   * Get comprehensive security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    try {
      const cacheKey = 'security_metrics';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

      // Parallel data fetching for better performance
      const [
        fraudStats,
        auditLogs,
        securityIncidents,
        complianceEvents,
        fraudAlerts,
        securityEvents
      ] = await Promise.all([
        fraudDetectionService.getFraudStatistics({ start: last24h, end: now }),
        storage.getAuditLogs({ startDate: last24h, limit: 1000 }),
        storage.getSecurityIncidents({ limit: 100 }),
        storage.getComplianceEvents({ startDate: last24h, limit: 500 }),
        storage.getFraudAlerts(),
        storage.getSecurityEvents(undefined, 500)
      ]);

      // Calculate real-time metrics
      const activeUsers = this.countActiveUsers(auditLogs, lastHour);
      const activeSessions = this.countActiveSessions(auditLogs, lastHour);
      const alertsLast24h = fraudAlerts.filter(alert => alert.createdAt >= last24h).length;
      const criticalIncidents = securityIncidents.filter(incident => 
        incident.severity === 'critical' && incident.status === 'open'
      ).length;

      // Calculate fraud metrics
      const fraudMetrics = this.calculateFraudMetrics(fraudStats, fraudAlerts);
      
      // Calculate authentication metrics
      const authMetrics = this.calculateAuthMetrics(auditLogs);
      
      // Calculate document security metrics
      const documentMetrics = this.calculateDocumentMetrics(auditLogs);
      
      // Calculate compliance metrics
      const complianceMetrics = this.calculateComplianceMetrics(complianceEvents, auditLogs);
      
      // Calculate system health metrics
      const systemMetrics = await this.calculateSystemMetrics(auditLogs, securityEvents);

      const metrics: SecurityMetrics = {
        activeUsers,
        activeSessions,
        alertsLast24h,
        criticalIncidents,
        fraudScore: fraudMetrics,
        loginAttempts: authMetrics,
        documentAccess: documentMetrics,
        compliance: complianceMetrics,
        system: systemMetrics
      };

      this.setCachedData(cacheKey, metrics);
      
      // Store metrics for historical analysis
      await this.storeMetricsSnapshot(metrics);

      return metrics;

    } catch (error) {
      console.error('Error calculating security metrics:', error);
      throw error;
    }
  }

  /**
   * Get security trends for dashboard
   */
  async getSecurityTrends(timeframe: '1h' | '24h' | '7d' | '30d'): Promise<SecurityTrend[]> {
    try {
      const trends: SecurityTrend[] = [];
      const metricNames = [
        'fraud_alerts', 'failed_logins', 'document_access', 
        'compliance_events', 'security_incidents'
      ];

      for (const metricName of metricNames) {
        const trend = await this.calculateTrend(metricName, timeframe);
        if (trend) trends.push(trend);
      }

      return trends;

    } catch (error) {
      console.error('Error calculating security trends:', error);
      throw error;
    }
  }

  /**
   * Generate security alerts based on current metrics
   */
  async generateSecurityAlerts(): Promise<SecurityAlert[]> {
    try {
      const alerts: SecurityAlert[] = [];
      const metrics = await this.getSecurityMetrics();

      // Critical incident alert
      if (metrics.criticalIncidents > 0) {
        alerts.push({
          id: `critical_incidents_${Date.now()}`,
          level: 'critical',
          title: `${metrics.criticalIncidents} Critical Security Incidents`,
          description: `There are ${metrics.criticalIncidents} unresolved critical security incidents requiring immediate attention.`,
          context: { count: metrics.criticalIncidents },
          recommendations: [
            'Review and investigate critical incidents immediately',
            'Escalate to security team lead',
            'Consider system lockdown if warranted'
          ],
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          tags: ['critical', 'incidents', 'security']
        });
      }

      // High fraud score alert
      if (metrics.fraudScore.average > 70) {
        alerts.push({
          id: `high_fraud_score_${Date.now()}`,
          level: 'high',
          title: 'Elevated Fraud Risk Detected',
          description: `Average fraud score is ${metrics.fraudScore.average.toFixed(1)}, indicating heightened security risks.`,
          context: { 
            averageScore: metrics.fraudScore.average,
            trend: metrics.fraudScore.trend,
            highRiskUsers: metrics.fraudScore.high
          },
          recommendations: [
            'Review high-risk user activities',
            'Enable additional authentication measures',
            'Monitor fraud patterns closely'
          ],
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          tags: ['fraud', 'high-risk', 'monitoring']
        });
      }

      // High login failure rate alert
      if (metrics.loginAttempts.failureRate > 0.3) {
        alerts.push({
          id: `high_login_failure_${Date.now()}`,
          level: 'medium',
          title: 'High Login Failure Rate',
          description: `Login failure rate is ${(metrics.loginAttempts.failureRate * 100).toFixed(1)}%, indicating potential brute force attacks.`,
          context: {
            failureRate: metrics.loginAttempts.failureRate,
            totalAttempts: metrics.loginAttempts.total,
            failedAttempts: metrics.loginAttempts.failed
          },
          recommendations: [
            'Review failed login attempts',
            'Check for suspicious IP addresses',
            'Consider implementing rate limiting'
          ],
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          tags: ['authentication', 'brute-force', 'login']
        });
      }

      // Compliance violations alert
      if (metrics.compliance.privacyViolations > 0) {
        alerts.push({
          id: `compliance_violations_${Date.now()}`,
          level: 'high',
          title: 'Privacy Compliance Violations Detected',
          description: `${metrics.compliance.privacyViolations} potential POPIA compliance violations detected.`,
          context: { violations: metrics.compliance.privacyViolations },
          recommendations: [
            'Review compliance events immediately',
            'Document violation details',
            'Implement corrective measures',
            'Report to compliance officer'
          ],
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          tags: ['compliance', 'popia', 'privacy']
        });
      }

      // System performance alert
      if (metrics.system.performanceScore < 70) {
        alerts.push({
          id: `system_performance_${Date.now()}`,
          level: 'medium',
          title: 'System Performance Degradation',
          description: `System performance score is ${metrics.system.performanceScore}, below acceptable threshold.`,
          context: {
            performanceScore: metrics.system.performanceScore,
            responseTime: metrics.system.apiResponseTime,
            errorRate: metrics.system.errorRate
          },
          recommendations: [
            'Review system logs for errors',
            'Check resource utilization',
            'Monitor database performance',
            'Consider scaling resources'
          ],
          timestamp: new Date(),
          acknowledged: false,
          resolved: false,
          tags: ['performance', 'system', 'monitoring']
        });
      }

      // Emit alerts for real-time notifications
      alerts.forEach(alert => {
        this.emit('securityAlert', alert);
      });

      return alerts;

    } catch (error) {
      console.error('Error generating security alerts:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive security dashboard data
   */
  async getSecurityDashboard() {
    try {
      const [metrics, trends, alerts] = await Promise.all([
        this.getSecurityMetrics(),
        this.getSecurityTrends('24h'),
        this.generateSecurityAlerts()
      ]);

      // Get recent security events for timeline
      const recentEvents = await this.getRecentSecurityEvents(50);
      
      // Get top risk users
      const topRiskUsers = await this.getTopRiskUsers(10);

      // Get system status
      const systemStatus = await this.getSystemStatus();

      return {
        metrics,
        trends,
        alerts: alerts.slice(0, 10), // Top 10 alerts
        recentEvents: recentEvents.slice(0, 20), // Last 20 events
        topRiskUsers: topRiskUsers.slice(0, 5), // Top 5 risk users
        systemStatus,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error getting security dashboard data:', error);
      throw error;
    }
  }

  /**
   * Initialize default alert thresholds
   */
  private initializeDefaultThresholds() {
    this.alertThresholds.set('fraud_score_avg', 70);
    this.alertThresholds.set('login_failure_rate', 0.3);
    this.alertThresholds.set('document_access_rate', 100);
    this.alertThresholds.set('compliance_violations', 1);
    this.alertThresholds.set('performance_score', 70);
    this.alertThresholds.set('error_rate', 0.05);
  }

  /**
   * Setup event listeners for real-time monitoring
   */
  private setupEventListeners() {
    // Listen to correlation engine events
    securityCorrelationEngine.on('securityAlert', (alert) => {
      this.handleCorrelationAlert(alert);
    });

    securityCorrelationEngine.on('incidentCreated', (data) => {
      this.handleIncidentCreated(data);
    });

    // Listen to fraud detection events
    fraudDetectionService.on('activityAlert', (alert) => {
      this.handleFraudAlert(alert);
    });

    // Listen to audit trail events for real-time analysis
    auditTrailService.on('riskDetected', (data) => {
      this.handleRiskDetection(data);
    });
  }

  /**
   * Start periodic monitoring and metrics calculation
   */
  private startPeriodicMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performPeriodicAnalysis();
      } catch (error) {
        console.error('Periodic monitoring error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Perform periodic security analysis
   */
  private async performPeriodicAnalysis() {
    // Calculate and cache fresh metrics
    await this.getSecurityMetrics();
    
    // Generate and emit alerts if any
    const alerts = await this.generateSecurityAlerts();
    if (alerts.length > 0) {
      this.emit('periodicAlerts', alerts);
    }

    // Update security metrics in storage
    await this.updateStoredMetrics();
  }

  /**
   * Handle correlation engine alerts
   */
  private async handleCorrelationAlert(alert: any) {
    this.emit('realTimeAlert', {
      source: 'correlation_engine',
      alert,
      timestamp: new Date()
    });
  }

  /**
   * Handle incident creation
   */
  private async handleIncidentCreated(data: any) {
    this.emit('incidentAlert', {
      incident: data.incident,
      pattern: data.pattern,
      events: data.events,
      timestamp: new Date()
    });
  }

  /**
   * Handle fraud detection alerts
   */
  private async handleFraudAlert(alert: any) {
    this.emit('fraudAlert', {
      userId: alert.userId,
      riskScore: alert.riskScore,
      anomalies: alert.anomalies,
      timestamp: alert.timestamp
    });
  }

  /**
   * Handle risk detection events
   */
  private async handleRiskDetection(data: any) {
    if (data.riskScore > 80) {
      this.emit('highRiskAlert', {
        userId: data.userId,
        riskScore: data.riskScore,
        riskFactors: data.riskFactors,
        action: data.action,
        timestamp: new Date()
      });
    }
  }

  /**
   * Calculate fraud metrics from statistics and alerts
   */
  private calculateFraudMetrics(stats: any, alerts: any[]): SecurityMetrics['fraudScore'] {
    const highRiskAlerts = alerts.filter(a => a.riskScore >= 60).length;
    const criticalRiskAlerts = alerts.filter(a => a.riskScore >= 80).length;
    
    return {
      average: stats.averageRiskScore || 0,
      high: highRiskAlerts,
      critical: criticalRiskAlerts,
      trend: stats.trends?.direction || 'stable'
    };
  }

  /**
   * Calculate authentication metrics from audit logs
   */
  private calculateAuthMetrics(auditLogs: any[]): SecurityMetrics['loginAttempts'] {
    const loginLogs = auditLogs.filter(log => 
      log.action.includes('login') || log.action.includes('authentication')
    );

    const successful = loginLogs.filter(log => log.outcome === 'success').length;
    const failed = loginLogs.filter(log => log.outcome === 'failure').length;
    const total = successful + failed;
    const failureRate = total > 0 ? failed / total : 0;

    return { total, successful, failed, failureRate };
  }

  /**
   * Calculate document security metrics
   */
  private calculateDocumentMetrics(auditLogs: any[]): SecurityMetrics['documentAccess'] {
    const documentLogs = auditLogs.filter(log => 
      log.action.includes('document') || log.entityType === 'document'
    );

    const totalAccess = documentLogs.length;
    const downloads = documentLogs.filter(log => log.action.includes('downloaded')).length;
    const modifications = documentLogs.filter(log => log.action.includes('modified')).length;
    const verifications = documentLogs.filter(log => log.action.includes('verified')).length;
    
    // Suspicious activity: high frequency, unusual times, failed attempts
    const suspiciousActivity = documentLogs.filter(log => 
      log.riskScore && log.riskScore > 50
    ).length;

    return {
      totalAccess,
      downloads,
      modifications,
      verifications,
      suspiciousActivity
    };
  }

  /**
   * Calculate compliance metrics
   */
  private calculateComplianceMetrics(complianceEvents: any[], auditLogs: any[]): SecurityMetrics['compliance'] {
    const popiaEvents = complianceEvents.filter(e => e.regulation === 'POPIA');
    const compliantEvents = popiaEvents.filter(e => e.complianceStatus === 'compliant').length;
    const totalPopiaEvents = popiaEvents.length;
    const popiaCompliance = totalPopiaEvents > 0 ? (compliantEvents / totalPopiaEvents) * 100 : 100;

    const dataAccessRequests = complianceEvents.filter(e => 
      e.eventType.includes('DATA_ACCESSED')
    ).length;

    const privacyViolations = complianceEvents.filter(e => 
      e.complianceStatus === 'non_compliant'
    ).length;

    // Simplified retention compliance calculation
    const retentionCompliance = 95; // Placeholder

    return {
      popiaCompliance,
      dataAccessRequests,
      privacyViolations,
      retentionCompliance
    };
  }

  /**
   * Calculate system health metrics
   */
  private async calculateSystemMetrics(auditLogs: any[], securityEvents: any[]): Promise<SecurityMetrics['system']> {
    // Calculate average API response time from recent logs
    const apiLogs = auditLogs.filter(log => log.actionDetails?.duration);
    const avgResponseTime = apiLogs.length > 0 
      ? apiLogs.reduce((sum, log) => sum + (log.actionDetails.duration || 0), 0) / apiLogs.length 
      : 0;

    // Calculate error rate
    const errorLogs = auditLogs.filter(log => log.outcome === 'failure');
    const errorRate = auditLogs.length > 0 ? errorLogs.length / auditLogs.length : 0;

    // Integration status (simplified)
    const integrationStatus = {
      dha: 'healthy' as const,
      saps: 'healthy' as const,
      icao: 'healthy' as const,
      database: 'healthy' as const
    };

    // Performance score calculation
    let performanceScore = 100;
    if (avgResponseTime > 2000) performanceScore -= 20; // Slow response times
    if (errorRate > 0.05) performanceScore -= 30; // High error rate
    if (securityEvents.filter(e => e.severity === 'high').length > 10) performanceScore -= 15;

    return {
      apiResponseTime: avgResponseTime,
      errorRate,
      integrationStatus,
      performanceScore: Math.max(performanceScore, 0)
    };
  }

  /**
   * Store metrics snapshot for historical analysis
   */
  private async storeMetricsSnapshot(metrics: SecurityMetrics) {
    try {
      const metricsToStore = [
        {
          metricName: 'active_users',
          metricValue: metrics.activeUsers,
          metricUnit: 'count',
          timeWindow: '5m',
          aggregationType: 'gauge'
        },
        {
          metricName: 'fraud_score_avg',
          metricValue: metrics.fraudScore.average,
          metricUnit: 'score',
          timeWindow: '5m',
          aggregationType: 'average'
        },
        {
          metricName: 'login_failure_rate',
          metricValue: metrics.loginAttempts.failureRate * 100,
          metricUnit: 'percentage',
          timeWindow: '5m',
          aggregationType: 'rate'
        },
        {
          metricName: 'compliance_score',
          metricValue: metrics.compliance.popiaCompliance,
          metricUnit: 'percentage',
          timeWindow: '5m',
          aggregationType: 'gauge'
        },
        {
          metricName: 'system_performance',
          metricValue: metrics.system.performanceScore,
          metricUnit: 'score',
          timeWindow: '5m',
          aggregationType: 'gauge'
        }
      ];

      for (const metric of metricsToStore) {
        await storage.createSecurityMetric(metric);
      }

    } catch (error) {
      console.error('Error storing metrics snapshot:', error);
    }
  }

  /**
   * Helper methods for metric calculations
   */
  private countActiveUsers(auditLogs: any[], since: Date): number {
    const activeUserIds = new Set(
      auditLogs
        .filter(log => log.createdAt >= since && log.userId)
        .map(log => log.userId)
    );
    return activeUserIds.size;
  }

  private countActiveSessions(auditLogs: any[], since: Date): number {
    const activeSessionIds = new Set(
      auditLogs
        .filter(log => log.createdAt >= since && log.sessionId)
        .map(log => log.sessionId)
    );
    return activeSessionIds.size;
  }

  private async calculateTrend(metricName: string, timeframe: string): Promise<SecurityTrend | null> {
    try {
      const metrics = await storage.getSecurityMetrics({ 
        metricName, 
        timeWindow: timeframe === '1h' ? '5m' : '1h',
        limit: timeframe === '1h' ? 12 : timeframe === '24h' ? 24 : 168
      });

      if (metrics.length < 2) return null;

      const dataPoints = metrics.map(m => ({
        timestamp: m.calculatedAt,
        value: m.metricValue
      }));

      // Calculate trend direction and change
      const latest = dataPoints[dataPoints.length - 1];
      const previous = dataPoints[dataPoints.length - 2];
      const change = latest.value - previous.value;
      const changePercent = previous.value !== 0 ? (change / previous.value) * 100 : 0;
      
      const trend = Math.abs(changePercent) < 5 ? 'stable' : change > 0 ? 'up' : 'down';

      return {
        metric: metricName,
        timeframe: timeframe as any,
        dataPoints,
        trend,
        changePercent
      };

    } catch (error) {
      console.error(`Error calculating trend for ${metricName}:`, error);
      return null;
    }
  }

  private async getRecentSecurityEvents(limit: number) {
    try {
      const events = await storage.getSecurityEvents(undefined, limit);
      return events.map(event => ({
        id: event.id,
        type: event.eventType,
        severity: event.severity,
        userId: event.userId,
        timestamp: event.createdAt,
        description: this.formatEventDescription(event)
      }));
    } catch (error) {
      console.error('Error getting recent security events:', error);
      return [];
    }
  }

  private async getTopRiskUsers(limit: number) {
    try {
      const alerts = await storage.getFraudAlerts();
      const userRisks = new Map<string, { totalRisk: number; alertCount: number }>();

      alerts.forEach(alert => {
        if (alert.userId) {
          const existing = userRisks.get(alert.userId) || { totalRisk: 0, alertCount: 0 };
          userRisks.set(alert.userId, {
            totalRisk: existing.totalRisk + alert.riskScore,
            alertCount: existing.alertCount + 1
          });
        }
      });

      return Array.from(userRisks.entries())
        .map(([userId, data]) => ({
          userId,
          averageRisk: data.totalRisk / data.alertCount,
          alertCount: data.alertCount,
          totalRisk: data.totalRisk
        }))
        .sort((a, b) => b.averageRisk - a.averageRisk)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting top risk users:', error);
      return [];
    }
  }

  private async getSystemStatus() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  private formatEventDescription(event: any): string {
    const descriptions: Record<string, string> = {
      'fraud_analysis_completed': `Fraud analysis completed for user ${event.userId}`,
      'login_failed': `Failed login attempt for user ${event.userId}`,
      'document_accessed': `Document accessed by user ${event.userId}`,
      'security_rule_triggered': `Security rule triggered: ${event.details?.ruleName || 'Unknown'}`
    };

    return descriptions[event.eventType] || `Security event: ${event.eventType}`;
  }

  /**
   * Cache helper methods
   */
  private getCachedData(key: string): any {
    const cached = this.metricsCache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp.getTime() > this.cacheTimeout;
    if (isExpired) {
      this.metricsCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(key: string, data: any) {
    this.metricsCache.set(key, {
      data,
      timestamp: new Date()
    });
  }

  private async updateStoredMetrics() {
    // Update stored security metrics for long-term analysis
    const metrics = await this.getSecurityMetrics();
    await this.storeMetricsSnapshot(metrics);
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.metricsCache.clear();
    this.removeAllListeners();
  }
}

export const enhancedMonitoringService = EnhancedMonitoringService.getInstance();