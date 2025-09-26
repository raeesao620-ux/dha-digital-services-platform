import { storage } from "../storage";
import { InsertFraudAlert, InsertSecurityEvent } from "@shared/schema";
import { auditTrailService } from "./audit-trail-service";
import { securityCorrelationEngine } from "./security-correlation-engine";
import { EventEmitter } from "events";

export interface FraudAnalysisResult {
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  indicators: string[];
  recommendedAction: string;
  shouldBlock: boolean;
}

export interface UserBehaviorData {
  userId: string;
  ipAddress: string;
  userAgent: string;
  location?: string;
  deviceFingerprint?: string;
  sessionData?: any;
}

export class FraudDetectionService extends EventEmitter {
  private realTimeMonitoring = true;
  private behaviorProfiles = new Map<string, any>();
  
  constructor() {
    super();
    this.initializeRealtimeMonitoring();
  }
  
  async analyzeUserBehavior(data: UserBehaviorData): Promise<FraudAnalysisResult> {
    const indicators: string[] = [];
    let riskScore = 0;
    
    // Analyze various risk factors
    riskScore += await this.checkLocationAnomaly(data.userId, indicators, data.location);
    riskScore += await this.checkDeviceFingerprint(data.userId, indicators, data.deviceFingerprint);
    riskScore += await this.checkIPReputation(data.ipAddress, indicators);
    riskScore += await this.checkLoginFrequency(data.userId, indicators);
    riskScore += await this.checkUserAgentAnomaly(data.userId, data.userAgent, indicators);
    riskScore += await this.checkTimePatterns(data.userId, indicators);
    
    const riskLevel = this.calculateRiskLevel(riskScore);
    const shouldBlock = riskScore >= 90;
    
    const result: FraudAnalysisResult = {
      riskScore: Math.min(riskScore, 100),
      riskLevel,
      indicators,
      recommendedAction: this.getRecommendedAction(riskLevel, indicators),
      shouldBlock
    };
    
    // Create fraud alert if risk is medium or higher
    if (riskScore >= 40) {
      await this.createFraudAlert(data.userId, result);
    }
    
    // Log security event and audit trail
    await Promise.all([
      storage.createSecurityEvent({
        userId: data.userId,
        eventType: "fraud_analysis_completed",
        severity: riskLevel === "critical" ? "high" : riskLevel === "high" ? "medium" : "low",
        details: {
          riskScore,
          riskLevel,
          indicators,
          location: data.location,
          ipAddress: data.ipAddress
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        location: data.location
      }),
      auditTrailService.logUserAction(
        'fraud_analysis_performed',
        'success',
        {
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          location: data.location,
          riskScore: result.riskScore,
          actionDetails: {
            riskLevel: result.riskLevel,
            indicators: result.indicators,
            shouldBlock: result.shouldBlock,
            recommendation: result.recommendedAction
          }
        }
      )
    ]);
    
    // Add security event to correlation engine
    await securityCorrelationEngine.addSecurityEvent({
      id: `fraud_${Date.now()}_${data.userId}`,
      type: 'fraud_analysis',
      severity: riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : riskLevel === 'medium' ? 'medium' : 'low',
      userId: data.userId,
      details: {
        riskScore,
        riskLevel,
        indicators,
        location: data.location,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent
      },
      timestamp: new Date()
    });
    
    // Emit real-time fraud event
    this.emit('fraudAnalysis', {
      userId: data.userId,
      analysis: result,
      timestamp: new Date()
    });
    
    return result;
  }
  
  private async checkLocationAnomaly(userId: string, indicators: string[], currentLocation?: string): Promise<number> {
    if (!currentLocation) return 0;
    
    try {
      // Get recent security events to analyze location patterns
      const recentEvents = await storage.getSecurityEvents(userId, 50);
      const locationEvents = recentEvents
        .filter(event => event.location && event.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .map(event => event.location);
      
      if (locationEvents.length === 0) return 0;
      
      // Check if current location is significantly different from recent locations
      const isNewLocation = !locationEvents.includes(currentLocation);
      
      if (isNewLocation) {
        indicators.push("unusual_location");
        
        // Calculate distance-based risk (simplified)
        // In production, use geolocation APIs for accurate distance calculation
        const isVeryDistant = this.isLocationDistant(currentLocation, locationEvents[0] as string);
        
        if (isVeryDistant) {
          indicators.push("distant_location");
          return 35; // High risk for very distant locations
        }
        
        return 20; // Medium risk for new locations
      }
      
      return 0;
    } catch (error) {
      console.error("Location anomaly check error:", error);
      return 0;
    }
  }
  
  private async checkDeviceFingerprint(userId: string, indicators: string[], deviceFingerprint?: string): Promise<number> {
    if (!deviceFingerprint) return 10; // Slight risk for missing fingerprint
    
    try {
      // Check if this device has been used before
      const recentEvents = await storage.getSecurityEvents(userId, 100);
      const deviceEvents = recentEvents.filter(event => 
        event.details && 
        typeof event.details === 'object' && 
        'deviceFingerprint' in event.details
      );
      
      const knownDevices = deviceEvents.map(event => 
        (event.details as any).deviceFingerprint
      ).filter(Boolean);
      
      if (knownDevices.length === 0) return 0;
      
      if (!knownDevices.includes(deviceFingerprint)) {
        indicators.push("new_device");
        return 25;
      }
      
      return 0;
    } catch (error) {
      console.error("Device fingerprint check error:", error);
      return 0;
    }
  }
  
  private async checkIPReputation(ipAddress: string, indicators: string[]): Promise<number> {
    try {
      // Check if IP is in blacklist
      // In production, integrate with IP reputation services
      const blacklistedIPs = (process.env.BLACKLISTED_IPS || "").split(",");
      
      if (blacklistedIPs.includes(ipAddress)) {
        indicators.push("blacklisted_ip");
        return 50;
      }
      
      // Check for known proxy/VPN patterns
      if (this.isProxyIP(ipAddress)) {
        indicators.push("proxy_vpn_detected");
        return 30;
      }
      
      // Check recent security events for this IP
      const recentEvents = await storage.getSecurityEvents(undefined, 100);
      const ipEvents = recentEvents.filter(event => 
        event.ipAddress === ipAddress && 
        event.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      
      // High activity from single IP
      if (ipEvents.length > 20) {
        indicators.push("high_ip_activity");
        return 25;
      }
      
      // Multiple failed attempts from this IP
      const failedAttempts = ipEvents.filter(event => 
        event.eventType.includes("failed") || event.eventType.includes("blocked")
      );
      
      if (failedAttempts.length > 5) {
        indicators.push("multiple_failed_attempts");
        return 35;
      }
      
      return 0;
    } catch (error) {
      console.error("IP reputation check error:", error);
      return 0;
    }
  }
  
  private async checkLoginFrequency(userId: string, indicators: string[]): Promise<number> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const recentEvents = await storage.getSecurityEvents(userId, 50);
      const loginEvents = recentEvents.filter(event => 
        event.eventType.includes("login") || event.eventType.includes("authentication")
      );
      
      const loginsLastHour = loginEvents.filter(event => event.createdAt > oneHourAgo).length;
      const loginsLastDay = loginEvents.filter(event => event.createdAt > oneDayAgo).length;
      
      if (loginsLastHour > 10) {
        indicators.push("excessive_login_frequency");
        return 40;
      }
      
      if (loginsLastDay > 50) {
        indicators.push("unusual_daily_activity");
        return 30;
      }
      
      return 0;
    } catch (error) {
      console.error("Login frequency check error:", error);
      return 0;
    }
  }
  
  private async checkUserAgentAnomaly(userId: string, userAgent: string, indicators: string[]): Promise<number> {
    try {
      if (!userAgent || userAgent.length < 10) {
        indicators.push("suspicious_user_agent");
        return 25;
      }
      
      // Check for bot patterns
      if (/bot|crawler|spider|scraper/i.test(userAgent)) {
        indicators.push("bot_user_agent");
        return 35;
      }
      
      // Check if user agent differs significantly from recent sessions
      const recentEvents = await storage.getSecurityEvents(userId, 20);
      const userAgents = recentEvents
        .map(event => event.userAgent)
        .filter(Boolean);
      
      if (userAgents.length > 0 && !userAgents.includes(userAgent)) {
        // Different user agent - might indicate session hijacking
        indicators.push("changed_user_agent");
        return 20;
      }
      
      return 0;
    } catch (error) {
      console.error("User agent anomaly check error:", error);
      return 0;
    }
  }
  
  private async checkTimePatterns(userId: string, indicators: string[]): Promise<number> {
    try {
      const now = new Date();
      const hour = now.getHours();
      
      // Check if login is at unusual time (very early morning)
      if (hour >= 2 && hour <= 5) {
        indicators.push("unusual_time");
        return 15;
      }
      
      // Analyze user's typical login patterns
      const recentEvents = await storage.getSecurityEvents(userId, 100);
      const loginEvents = recentEvents
        .filter(event => event.eventType.includes("login"))
        .map(event => event.createdAt.getHours());
      
      if (loginEvents.length >= 10) {
        // Calculate if current hour is unusual for this user
        const hourCounts = loginEvents.reduce((acc, h) => {
          acc[h] = (acc[h] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        const currentHourCount = hourCounts[hour] || 0;
        const totalLogins = loginEvents.length;
        
        // If less than 5% of logins happened at this hour, it's unusual
        if (currentHourCount / totalLogins < 0.05) {
          indicators.push("atypical_login_time");
          return 10;
        }
      }
      
      return 0;
    } catch (error) {
      console.error("Time pattern check error:", error);
      return 0;
    }
  }
  
  private calculateRiskLevel(riskScore: number): "low" | "medium" | "high" | "critical" {
    if (riskScore >= 80) return "critical";
    if (riskScore >= 60) return "high";
    if (riskScore >= 30) return "medium";
    return "low";
  }
  
  private getRecommendedAction(riskLevel: string, indicators: string[]): string {
    switch (riskLevel) {
      case "critical":
        return "Block access immediately and require manual verification";
      case "high":
        return "Require additional authentication factors";
      case "medium":
        return "Monitor closely and request email verification";
      case "low":
      default:
        return "Allow access with standard monitoring";
    }
  }
  
  private async createFraudAlert(userId: string, analysis: FraudAnalysisResult): Promise<void> {
    const alert: InsertFraudAlert = {
      userId,
      alertType: `${analysis.riskLevel}_risk_detected`,
      riskScore: analysis.riskScore,
      details: {
        indicators: analysis.indicators,
        recommendedAction: analysis.recommendedAction,
        analysis: analysis
      }
    };
    
    await storage.createFraudAlert(alert);
  }
  
  private isLocationDistant(location1: string, location2: string): boolean {
    // Simplified distance check
    // In production, use proper geolocation services
    const countries1 = this.extractCountry(location1);
    const countries2 = this.extractCountry(location2);
    
    return countries1 !== countries2;
  }
  
  private extractCountry(location: string): string {
    // Simplified country extraction
    // In production, use proper geolocation parsing
    return location.split(",").pop()?.trim() || "";
  }
  
  private isProxyIP(ipAddress: string): boolean {
    // Simplified proxy detection
    // In production, integrate with services like MaxMind or similar
    const proxyPatterns = [
      /^10\./, // Private network
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private network
      /^192\.168\./, // Private network
      /^127\./ // Localhost
    ];
    
    return proxyPatterns.some(pattern => pattern.test(ipAddress));
  }
  
  async getFraudAlerts(userId?: string, resolved?: boolean) {
    return await storage.getFraudAlerts(userId, resolved);
  }
  
  async resolveFraudAlert(alertId: string, resolvedBy: string) {
    await storage.resolveFraudAlert(alertId, resolvedBy);
    
    await storage.createSecurityEvent({
      userId: resolvedBy,
      eventType: "fraud_alert_resolved",
      severity: "low",
      details: { alertId }
    });

    // Log audit trail for alert resolution
    await auditTrailService.logAdminAction(
      'fraud_alert_resolved',
      resolvedBy,
      'fraud_alert',
      alertId,
      {
        actionDetails: {
          alertId,
          resolvedAt: new Date().toISOString()
        }
      }
    );
  }

  /**
   * Initialize real-time monitoring
   */
  private initializeRealtimeMonitoring() {
    if (!this.realTimeMonitoring) return;

    // Monitor audit trail events for fraud patterns
    auditTrailService.on('auditLog', async (data) => {
      if (data.auditLog.userId) {
        await this.analyzeLiveUserActivity(data.auditLog.userId, data.auditLog);
      }
    });

    console.log('Real-time fraud monitoring initialized');
  }

  /**
   * Analyze live user activity for fraud indicators
   */
  private async analyzeLiveUserActivity(userId: string, auditLog: any) {
    try {
      // Get user's behavior profile
      let profile = await storage.getUserBehaviorProfile(userId);
      
      if (!profile) {
        // Create initial behavior profile
        profile = await this.createInitialBehaviorProfile(userId);
      }

      // Analyze current activity against profile
      const anomalies = await this.detectBehaviorAnomalies(userId, auditLog, profile);

      if (anomalies.length > 0) {
        // Update profile with new patterns
        await this.updateBehaviorProfile(userId, auditLog, anomalies);

        // Calculate updated risk score
        const riskScore = this.calculateActivityRiskScore(anomalies, auditLog);

        if (riskScore > 50) {
          // Create fraud alert for suspicious activity
          await this.createActivityFraudAlert(userId, riskScore, anomalies, auditLog);
        }
      }

    } catch (error) {
      console.error('Live activity analysis error:', error);
    }
  }

  /**
   * Create initial behavior profile for new user
   */
  private async createInitialBehaviorProfile(userId: string) {
    const profile = {
      userId,
      typicalLocations: [],
      typicalDevices: [],
      typicalTimes: {},
      loginPatterns: {},
      documentPatterns: {},
      riskFactors: [],
      baselineScore: 0
    };

    return await storage.createUserBehaviorProfile(profile);
  }

  /**
   * Detect behavior anomalies
   */
  private async detectBehaviorAnomalies(userId: string, auditLog: any, profile: any): Promise<string[]> {
    const anomalies: string[] = [];

    // Time-based anomalies
    const hour = new Date(auditLog.createdAt).getHours();
    const typicalHours = profile.typicalTimes?.hours || [];
    if (typicalHours.length > 0 && !typicalHours.includes(hour)) {
      anomalies.push('unusual_time_activity');
    }

    // Location-based anomalies
    if (auditLog.location && profile.typicalLocations?.length > 0) {
      if (!profile.typicalLocations.includes(auditLog.location)) {
        anomalies.push('new_location_activity');
      }
    }

    // Action frequency anomalies
    const recentActions = await storage.getAuditLogs({
      userId,
      action: auditLog.action,
      startDate: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      limit: 50
    });

    if (recentActions.length > 20) {
      anomalies.push('high_frequency_activity');
    }

    // Document access patterns
    if (auditLog.action.includes('document')) {
      const documentActions = await storage.getAuditLogs({
        userId,
        entityType: 'document',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        limit: 100
      });

      if (documentActions.length > 15) {
        anomalies.push('excessive_document_access');
      }

      // Check for rapid document downloads
      const downloads = documentActions.filter(log => log.action.includes('downloaded'));
      if (downloads.length > 5) {
        anomalies.push('mass_document_download');
      }
    }

    // Failed action patterns
    if (auditLog.outcome === 'failure') {
      const recentFailures = await storage.getAuditLogs({
        userId,
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        limit: 50
      });

      const failureCount = recentFailures.filter(log => log.outcome === 'failure').length;
      if (failureCount > 5) {
        anomalies.push('repeated_failures');
      }
    }

    return anomalies;
  }

  /**
   * Update user behavior profile
   */
  private async updateBehaviorProfile(userId: string, auditLog: any, anomalies: string[]) {
    const profile = await storage.getUserBehaviorProfile(userId);
    if (!profile) return;

    const updates: any = {
      lastAnalyzed: new Date()
    };

    // Update typical locations
    if (auditLog.location) {
      const locations = (profile as any).typicalLocations || [];
      if (!locations.includes(auditLog.location)) {
        updates.typicalLocations = [...locations, auditLog.location].slice(-10); // Keep last 10
      }
    }

    // Update typical times
    const hour = new Date(auditLog.createdAt).getHours();
    const times = (profile as any).typicalTimes || {};
    const hours = (times as any).hours || [];
    if (!hours.includes(hour)) {
      updates.typicalTimes = {
        ...times,
        hours: [...hours, hour].slice(-24) // Keep distinct hours
      };
    }

    // Update risk factors
    if (anomalies.length > 0) {
      const existingFactors = (profile as any).riskFactors || [];
      updates.riskFactors = Array.from(new Set([...existingFactors, ...anomalies])).slice(-20);
    }

    await storage.updateUserBehaviorProfile(userId, updates);
  }

  /**
   * Calculate activity risk score
   */
  private calculateActivityRiskScore(anomalies: string[], auditLog: any): number {
    let score = 0;

    const riskWeights = {
      'unusual_time_activity': 15,
      'new_location_activity': 20,
      'high_frequency_activity': 30,
      'excessive_document_access': 35,
      'mass_document_download': 50,
      'repeated_failures': 25
    };

    for (const anomaly of anomalies) {
      score += riskWeights[anomaly as keyof typeof riskWeights] || 10;
    }

    // Additional risk for failed outcomes
    if (auditLog.outcome === 'failure') {
      score += 15;
    }

    // Additional risk for admin actions
    if (auditLog.action.includes('admin')) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Create fraud alert for suspicious activity
   */
  private async createActivityFraudAlert(userId: string, riskScore: number, anomalies: string[], auditLog: any) {
    const alert: InsertFraudAlert = {
      userId,
      alertType: 'suspicious_activity_pattern',
      riskScore,
      details: {
        anomalies,
        auditLogId: auditLog.id,
        detectedAt: new Date().toISOString(),
        activity: {
          action: auditLog.action,
          outcome: auditLog.outcome,
          location: auditLog.location,
          ipAddress: auditLog.ipAddress
        },
        recommendation: riskScore > 80 
          ? 'Immediate investigation required'
          : riskScore > 65
          ? 'Enhanced monitoring recommended'
          : 'Continue monitoring'
      }
    };

    await storage.createFraudAlert(alert);

    // Emit real-time alert
    this.emit('activityAlert', {
      userId,
      riskScore,
      anomalies,
      auditLog,
      timestamp: new Date()
    });

    // Log security event for correlation
    await securityCorrelationEngine.addSecurityEvent({
      id: `activity_${Date.now()}_${userId}`,
      type: 'suspicious_activity',
      severity: riskScore > 80 ? 'critical' : riskScore > 65 ? 'high' : 'medium',
      userId,
      details: {
        riskScore,
        anomalies,
        auditLogId: auditLog.id
      },
      timestamp: new Date()
    });
  }

  /**
   * Get fraud statistics and trends
   */
  async getFraudStatistics(timeRange: { start: Date; end: Date }) {
    try {
      const alerts = await storage.getFraudAlerts();
      const filteredAlerts = alerts.filter(alert => 
        alert.createdAt >= timeRange.start && alert.createdAt <= timeRange.end
      );

      const stats = {
        totalAlerts: filteredAlerts.length,
        resolvedAlerts: filteredAlerts.filter(a => a.isResolved).length,
        averageRiskScore: filteredAlerts.reduce((sum, a) => sum + a.riskScore, 0) / filteredAlerts.length || 0,
        alertsByType: {} as Record<string, number>,
        riskDistribution: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0
        },
        trends: await this.calculateFraudTrends(filteredAlerts)
      };

      // Count alerts by type
      filteredAlerts.forEach(alert => {
        stats.alertsByType[alert.alertType] = (stats.alertsByType[alert.alertType] || 0) + 1;
      });

      // Calculate risk distribution
      filteredAlerts.forEach(alert => {
        if (alert.riskScore >= 80) stats.riskDistribution.critical++;
        else if (alert.riskScore >= 60) stats.riskDistribution.high++;
        else if (alert.riskScore >= 30) stats.riskDistribution.medium++;
        else stats.riskDistribution.low++;
      });

      return stats;
    } catch (error) {
      console.error('Error calculating fraud statistics:', error);
      throw error;
    }
  }

  /**
   * Calculate fraud trends
   */
  private async calculateFraudTrends(alerts: any[]) {
    // Group alerts by day
    const dailyAlerts = alerts.reduce((acc, alert) => {
      const date = alert.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate trend direction
    const dates = Object.keys(dailyAlerts).sort();
    if (dates.length < 2) return { direction: 'stable', change: 0 };

    const recent = dailyAlerts[dates[dates.length - 1]] || 0;
    const previous = dailyAlerts[dates[dates.length - 2]] || 0;
    const change = recent - previous;
    const percentChange = previous > 0 ? (change / previous) * 100 : 0;

    return {
      direction: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable',
      change: percentChange,
      dailyCounts: dailyAlerts
    };
  }

  /**
   * Analyze device fingerprinting patterns
   */
  async analyzeDevicePatterns(userId: string) {
    try {
      const recentLogs = await storage.getAuditLogs({
        userId,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        limit: 200
      });

      const devices = recentLogs
        .map(log => (log.actionDetails as any)?.deviceFingerprint)
        .filter(Boolean);

      const uniqueDevices = Array.from(new Set(devices));
      const suspiciousPatterns: string[] = [];

      // Too many devices for one user
      if (uniqueDevices.length > 5) {
        suspiciousPatterns.push('multiple_devices');
      }

      // Rapid device switching
      const deviceSwitches = this.countDeviceSwitches(recentLogs);
      if (deviceSwitches > 10) {
        suspiciousPatterns.push('frequent_device_changes');
      }

      return {
        uniqueDeviceCount: uniqueDevices.length,
        totalSessions: devices.length,
        deviceSwitches,
        suspiciousPatterns,
        riskScore: this.calculateDeviceRiskScore(uniqueDevices.length, deviceSwitches)
      };
    } catch (error) {
      console.error('Device pattern analysis error:', error);
      throw error;
    }
  }

  /**
   * Count device switches in audit logs
   */
  private countDeviceSwitches(logs: any[]): number {
    let switches = 0;
    let lastDevice = null;

    for (const log of logs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      const device = log.actionDetails?.deviceFingerprint;
      if (device && device !== lastDevice) {
        if (lastDevice !== null) switches++;
        lastDevice = device;
      }
    }

    return switches;
  }

  /**
   * Calculate device-based risk score
   */
  private calculateDeviceRiskScore(deviceCount: number, switches: number): number {
    let score = 0;

    // Risk from multiple devices
    if (deviceCount > 5) score += 30;
    else if (deviceCount > 3) score += 15;

    // Risk from frequent switching
    if (switches > 15) score += 40;
    else if (switches > 10) score += 25;
    else if (switches > 5) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Set real-time monitoring status
   */
  setRealTimeMonitoring(enabled: boolean) {
    this.realTimeMonitoring = enabled;
    console.log(`Real-time fraud monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export const fraudDetectionService = new FraudDetectionService();
