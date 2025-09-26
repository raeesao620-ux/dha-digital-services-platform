/**
 * Monitoring Hooks Service
 * Creates background jobs and periodic checks that invoke self-healing services
 * This makes the self-healing architecture actually functional at runtime
 */

import { EventEmitter } from 'events';
import { enhancedSecurityResponseService } from './enhanced-security-response';
import { enhancedErrorCorrectionService } from './enhanced-error-correction';
import { databaseFallbackService } from './database-fallback-service';
import { getConnectionStatus } from '../db';
import { storage } from '../storage';

interface MonitoringMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  connections: number;
  errors: number;
  lastCheck: Date;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical' | 'emergency';
  components: {
    memory: 'healthy' | 'warning' | 'critical';
    database: 'healthy' | 'warning' | 'critical';
    cpu: 'healthy' | 'warning' | 'critical';
    disk: 'healthy' | 'warning' | 'critical';
  };
  metrics: MonitoringMetrics;
  issues: string[];
  recommendations: string[];
}

export class MonitoringHooksService extends EventEmitter {
  private static instance: MonitoringHooksService;
  
  // Service instances - use singletons
  private securityResponseService = enhancedSecurityResponseService;
  private errorCorrectionService = enhancedErrorCorrectionService;
  
  // Monitoring state
  private isRunning = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private metrics: MonitoringMetrics;
  private lastHealthCheck = Date.now();
  private errorCounts = new Map<string, number>();
  
  // Configuration
  private readonly config = {
    healthCheckInterval: 30000, // 30 seconds
    systemMetricsInterval: 60000, // 1 minute  
    errorDetectionInterval: 15000, // 15 seconds
    securityScanInterval: 45000, // 45 seconds
    databaseCheckInterval: 20000, // 20 seconds
    memoryLeakCheckInterval: 120000, // 2 minutes
    performanceCheckInterval: 90000, // 90 seconds
    threatAnalysisInterval: 30000, // 30 seconds
    
    // Thresholds
    memoryThreshold: 0.85, // 85% memory usage
    cpuThreshold: 0.90, // 90% CPU usage
    errorRateThreshold: 10, // errors per minute
    responseTimeThreshold: 5000, // 5 seconds
    databaseConnectionTimeout: 5000, // 5 seconds
  };
  
  private constructor() {
    super();
    this.metrics = this.initializeMetrics();
  }
  
  static getInstance(): MonitoringHooksService {
    if (!MonitoringHooksService.instance) {
      MonitoringHooksService.instance = new MonitoringHooksService();
    }
    return MonitoringHooksService.instance;
  }
  
  /**
   * Start all monitoring hooks and background jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[MonitoringHooks] Service already running');
      return;
    }
    
    console.log('[MonitoringHooks] Starting monitoring hooks and background jobs...');
    
    this.isRunning = true;
    
    // Start all monitoring intervals
    this.startHealthCheckMonitoring();
    this.startSystemMetricsMonitoring();
    this.startErrorDetectionMonitoring();
    this.startSecurityScanMonitoring();
    this.startDatabaseMonitoring();
    this.startMemoryLeakDetection();
    this.startPerformanceMonitoring();
    this.startThreatAnalysis();
    
    console.log('[MonitoringHooks] ✅ All monitoring hooks started - Self-healing active');
    this.emit('started');
  }
  
  /**
   * Stop all monitoring hooks
   */
  async stop(): Promise<void> {
    console.log('[MonitoringHooks] Stopping monitoring hooks...');
    
    this.isRunning = false;
    
    // Clear all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`[MonitoringHooks] Stopped ${name} monitoring`);
    }
    this.intervals.clear();
    
    console.log('[MonitoringHooks] ✅ All monitoring hooks stopped');
    this.emit('stopped');
  }
  
  /**
   * Start comprehensive health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        const health = await this.performSystemHealthCheck();
        
        // Trigger healing actions based on health status
        if (health.overall === 'critical' || health.overall === 'emergency') {
          await this.triggerCriticalHealthResponse(health);
        } else if (health.overall === 'degraded') {
          await this.triggerDegradedHealthResponse(health);
        }
        
        this.emit('health_check_completed', health);
        
      } catch (error) {
        console.error('[MonitoringHooks] Health check failed:', error);
        await this.handleMonitoringError('health_check', error);
      }
    }, this.config.healthCheckInterval);
    
    this.intervals.set('health_check', interval);
    console.log('[MonitoringHooks] Health check monitoring started');
  }
  
  /**
   * Start system metrics monitoring
   */
  private startSystemMetricsMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        this.updateSystemMetrics();
        
        // Check for performance issues
        const memoryPercent = this.metrics.memoryUsage.heapUsed / this.metrics.memoryUsage.heapTotal;
        if (memoryPercent > this.config.memoryThreshold) {
          await this.triggerMemoryIssueResponse(memoryPercent);
        }
        
        this.emit('metrics_updated', this.metrics);
        
      } catch (error) {
        console.error('[MonitoringHooks] System metrics monitoring failed:', error);
        await this.handleMonitoringError('system_metrics', error);
      }
    }, this.config.systemMetricsInterval);
    
    this.intervals.set('system_metrics', interval);
    console.log('[MonitoringHooks] System metrics monitoring started');
  }
  
  /**
   * Start error detection monitoring
   */
  private startErrorDetectionMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        const errorRate = await this.calculateErrorRate();
        
        if (errorRate > this.config.errorRateThreshold) {
          await this.triggerHighErrorRateResponse(errorRate);
        }
        
        this.emit('error_rate_checked', { errorRate, threshold: this.config.errorRateThreshold });
        
      } catch (error) {
        console.error('[MonitoringHooks] Error detection monitoring failed:', error);
        await this.handleMonitoringError('error_detection', error);
      }
    }, this.config.errorDetectionInterval);
    
    this.intervals.set('error_detection', interval);
    console.log('[MonitoringHooks] Error detection monitoring started');
  }
  
  /**
   * Start security scan monitoring
   */
  private startSecurityScanMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        const suspiciousActivities = await this.detectSuspiciousActivities();
        
        for (const activity of suspiciousActivities) {
          await this.triggerSecurityResponse(activity);
        }
        
        this.emit('security_scan_completed', { 
          activitiesDetected: suspiciousActivities.length,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('[MonitoringHooks] Security scan monitoring failed:', error);
        await this.handleMonitoringError('security_scan', error);
      }
    }, this.config.securityScanInterval);
    
    this.intervals.set('security_scan', interval);
    console.log('[MonitoringHooks] Security scan monitoring started');
  }
  
  /**
   * Start database monitoring
   */
  private startDatabaseMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        const dbStatus = await this.checkDatabaseHealth();
        
        if (!dbStatus.connected) {
          await this.triggerDatabaseIssueResponse(dbStatus);
        }
        
        this.emit('database_checked', dbStatus);
        
      } catch (error) {
        console.error('[MonitoringHooks] Database monitoring failed:', error);
        await this.handleMonitoringError('database_check', error);
      }
    }, this.config.databaseCheckInterval);
    
    this.intervals.set('database_check', interval);
    console.log('[MonitoringHooks] Database monitoring started');
  }
  
  /**
   * Start memory leak detection
   */
  private startMemoryLeakDetection(): void {
    let previousMemory = process.memoryUsage();
    
    const interval = setInterval(async () => {
      try {
        const currentMemory = process.memoryUsage();
        const memoryGrowth = currentMemory.heapUsed - previousMemory.heapUsed;
        const growthPercent = memoryGrowth / previousMemory.heapUsed;
        
        // Detect potential memory leak (consistent growth > 10%)
        if (growthPercent > 0.1 && currentMemory.heapUsed > 100 * 1024 * 1024) { // > 100MB
          await this.triggerMemoryLeakResponse(currentMemory, memoryGrowth);
        }
        
        previousMemory = currentMemory;
        
        this.emit('memory_leak_check', { 
          currentMemory, 
          memoryGrowth, 
          growthPercent 
        });
        
      } catch (error) {
        console.error('[MonitoringHooks] Memory leak detection failed:', error);
        await this.handleMonitoringError('memory_leak_detection', error);
      }
    }, this.config.memoryLeakCheckInterval);
    
    this.intervals.set('memory_leak_detection', interval);
    console.log('[MonitoringHooks] Memory leak detection started');
  }
  
  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    const interval = setInterval(async () => {
      try {
        const performanceMetrics = await this.checkPerformanceMetrics();
        
        if (performanceMetrics.responseTime > this.config.responseTimeThreshold) {
          await this.triggerPerformanceIssueResponse(performanceMetrics);
        }
        
        this.emit('performance_checked', performanceMetrics);
        
      } catch (error) {
        console.error('[MonitoringHooks] Performance monitoring failed:', error);
        await this.handleMonitoringError('performance_monitoring', error);
      }
    }, this.config.performanceCheckInterval);
    
    this.intervals.set('performance_monitoring', interval);
    console.log('[MonitoringHooks] Performance monitoring started');
  }
  
  /**
   * Start threat analysis
   */
  private startThreatAnalysis(): void {
    const interval = setInterval(async () => {
      try {
        const threats = await this.analyzeThreats();
        
        for (const threat of threats) {
          await this.triggerSecurityResponse(threat);
        }
        
        this.emit('threat_analysis_completed', { 
          threatsAnalyzed: threats.length,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('[MonitoringHooks] Threat analysis failed:', error);
        await this.handleMonitoringError('threat_analysis', error);
      }
    }, this.config.threatAnalysisInterval);
    
    this.intervals.set('threat_analysis', interval);
    console.log('[MonitoringHooks] Threat analysis started');
  }
  
  /**
   * Trigger critical health response
   */
  private async triggerCriticalHealthResponse(health: SystemHealth): Promise<void> {
    console.warn(`🚨 CRITICAL: System health is ${health.overall} - Triggering emergency response`);
    
    // Trigger error correction for critical issues
    for (const issue of health.issues) {
      try {
        await this.errorCorrectionService.correctError({
          type: 'resource_exhaustion',
          message: `Critical health issue: ${issue}`,
          component: 'system_health',
          severity: 'critical',
          details: { health, issue }
        });
      } catch (error) {
        console.error('Failed to trigger error correction for critical health issue:', error);
      }
    }
  }
  
  /**
   * Trigger degraded health response
   */
  private async triggerDegradedHealthResponse(health: SystemHealth): Promise<void> {
    console.warn(`⚠️ WARNING: System health is degraded - Triggering remediation`);
    
    // Trigger lighter error correction for degraded issues
    for (const issue of health.issues) {
      try {
        await this.errorCorrectionService.correctError({
          type: 'performance_degradation',
          message: `Degraded health issue: ${issue}`,
          component: 'system_health',
          severity: 'medium',
          details: { health, issue }
        });
      } catch (error) {
        console.error('Failed to trigger error correction for degraded health issue:', error);
      }
    }
  }
  
  /**
   * Trigger security response for threats
   */
  private async triggerSecurityResponse(threat: any): Promise<void> {
    try {
      await this.securityResponseService.handleSecurityThreat({
        type: threat.type,
        sourceIp: threat.sourceIp,
        severity: threat.severity,
        description: threat.description,
        confidence: threat.confidence,
        indicators: threat.indicators,
        details: threat.details
      });
    } catch (error) {
      console.error('Failed to trigger security response:', error);
    }
  }
  
  /**
   * Trigger memory issue response
   */
  private async triggerMemoryIssueResponse(memoryPercent: number): Promise<void> {
    console.warn(`⚠️ High memory usage detected: ${(memoryPercent * 100).toFixed(1)}%`);
    
    try {
      await this.errorCorrectionService.correctError({
        type: 'memory_leak',
        message: `High memory usage: ${(memoryPercent * 100).toFixed(1)}%`,
        component: 'memory_management',
        severity: memoryPercent > 0.95 ? 'critical' : 'high',
        details: { memoryPercent, threshold: this.config.memoryThreshold }
      });
    } catch (error) {
      console.error('Failed to trigger memory issue response:', error);
    }
  }
  
  /**
   * Trigger high error rate response
   */
  private async triggerHighErrorRateResponse(errorRate: number): Promise<void> {
    console.warn(`⚠️ High error rate detected: ${errorRate} errors/minute`);
    
    try {
      await this.errorCorrectionService.correctError({
        type: 'performance_degradation',
        message: `High error rate: ${errorRate} errors/minute`,
        component: 'error_handling',
        severity: errorRate > 50 ? 'critical' : 'high',
        details: { errorRate, threshold: this.config.errorRateThreshold }
      });
    } catch (error) {
      console.error('Failed to trigger error rate response:', error);
    }
  }
  
  /**
   * Trigger database issue response
   */
  private async triggerDatabaseIssueResponse(dbStatus: any): Promise<void> {
    console.warn('⚠️ Database connection issue detected');
    
    try {
      await this.errorCorrectionService.correctError({
        type: 'database_connection',
        message: `Database connection issue: ${dbStatus.error || 'Connection failed'}`,
        component: 'database',
        severity: 'critical',
        details: dbStatus
      });
    } catch (error) {
      console.error('Failed to trigger database issue response:', error);
    }
  }
  
  /**
   * Trigger memory leak response
   */
  private async triggerMemoryLeakResponse(currentMemory: NodeJS.MemoryUsage, memoryGrowth: number): Promise<void> {
    console.warn(`⚠️ Potential memory leak detected: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB growth`);
    
    try {
      await this.errorCorrectionService.correctError({
        type: 'memory_leak',
        message: `Memory leak detected: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB growth`,
        component: 'memory_management',
        severity: 'high',
        details: { currentMemory, memoryGrowth }
      });
    } catch (error) {
      console.error('Failed to trigger memory leak response:', error);
    }
  }
  
  /**
   * Trigger performance issue response
   */
  private async triggerPerformanceIssueResponse(performanceMetrics: any): Promise<void> {
    console.warn(`⚠️ Performance issue detected: ${performanceMetrics.responseTime}ms response time`);
    
    try {
      await this.errorCorrectionService.correctError({
        type: 'performance_degradation',
        message: `Slow response time: ${performanceMetrics.responseTime}ms`,
        component: 'performance',
        severity: 'medium',
        details: performanceMetrics
      });
    } catch (error) {
      console.error('Failed to trigger performance issue response:', error);
    }
  }
  
  /**
   * Handle monitoring errors
   */
  private async handleMonitoringError(monitoringType: string, error: any): Promise<void> {
    const errorKey = `${monitoringType}_${Date.now()}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    try {
      await this.errorCorrectionService.correctError({
        type: 'service_crash',
        message: `Monitoring error in ${monitoringType}: ${error.message}`,
        component: 'monitoring_hooks',
        severity: 'medium',
        details: { monitoringType, error: error.message, stack: error.stack }
      });
    } catch (correctionError) {
      console.error('Failed to correct monitoring error:', correctionError);
    }
  }
  
  // Helper methods for monitoring checks
  
  private async performSystemHealthCheck(): Promise<SystemHealth> {
    const metrics = this.updateSystemMetrics();
    const memoryPercent = metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal;
    const dbStatus = await this.checkDatabaseHealth();
    
    const health: SystemHealth = {
      overall: 'healthy',
      components: {
        memory: memoryPercent > 0.9 ? 'critical' : memoryPercent > 0.8 ? 'warning' : 'healthy',
        database: dbStatus.connected ? 'healthy' : 'critical',
        cpu: 'healthy', // Simplified CPU check
        disk: 'healthy'  // Simplified disk check
      },
      metrics,
      issues: [],
      recommendations: []
    };
    
    // Determine overall health
    const criticalComponents = Object.values(health.components).filter(status => status === 'critical');
    const warningComponents = Object.values(health.components).filter(status => status === 'warning');
    
    if (criticalComponents.length > 0) {
      health.overall = 'critical';
      health.issues.push(`Critical components: ${criticalComponents.length}`);
    } else if (warningComponents.length > 1) {
      health.overall = 'degraded';
      health.issues.push(`Warning components: ${warningComponents.length}`);
    }
    
    return health;
  }
  
  private updateSystemMetrics(): MonitoringMetrics {
    this.metrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      connections: 0, // Would need to track this
      errors: Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0),
      lastCheck: new Date()
    };
    return this.metrics;
  }
  
  private async calculateErrorRate(): Promise<number> {
    // Simplified error rate calculation
    const recentErrors = Array.from(this.errorCounts.entries())
      .filter(([key, _]) => {
        const timestamp = parseInt(key.split('_').pop() || '0');
        return Date.now() - timestamp < 60000; // Last minute
      })
      .reduce((sum, [_, count]) => sum + count, 0);
    
    return recentErrors;
  }
  
  private async detectSuspiciousActivities(): Promise<any[]> {
    // Simplified suspicious activity detection
    const activities = [];
    
    // Check for rapid error increases
    const recentErrorRate = await this.calculateErrorRate();
    if (recentErrorRate > this.config.errorRateThreshold * 2) {
      activities.push({
        type: 'high_error_rate',
        sourceIp: 'internal',
        severity: 'medium',
        description: `Unusually high error rate: ${recentErrorRate}`,
        confidence: 75,
        indicators: [`Error rate: ${recentErrorRate}`],
        details: { errorRate: recentErrorRate }
      });
    }
    
    return activities;
  }
  
  private async checkDatabaseHealth(): Promise<any> {
    try {
      return await getConnectionStatus();
    } catch (error) {
      return {
        connected: false,
        status: 'error',
        error: error.message
      };
    }
  }
  
  private async analyzeThreats(): Promise<any[]> {
    // Simplified threat analysis
    const threats = [];
    
    // Check fallback service for threat data
    const fallbackMetrics = databaseFallbackService.getMetrics();
    if (fallbackMetrics.blockedIPs > 10) {
      threats.push({
        type: 'multiple_blocked_ips',
        sourceIp: 'multiple',
        severity: 'medium',
        description: `High number of blocked IPs: ${fallbackMetrics.blockedIPs}`,
        confidence: 80,
        indicators: [`Blocked IPs: ${fallbackMetrics.blockedIPs}`],
        details: fallbackMetrics
      });
    }
    
    return threats;
  }
  
  private async checkPerformanceMetrics(): Promise<any> {
    // Simplified performance check
    const startTime = Date.now();
    
    // Simulate a small operation
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const responseTime = Date.now() - startTime;
    
    return {
      responseTime,
      timestamp: new Date()
    };
  }
  
  private initializeMetrics(): MonitoringMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      connections: 0,
      errors: 0,
      lastCheck: new Date()
    };
  }
  
  /**
   * Get current monitoring status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      activeIntervals: Array.from(this.intervals.keys()),
      metrics: this.metrics,
      lastHealthCheck: new Date(this.lastHealthCheck),
      errorCounts: Object.fromEntries(this.errorCounts)
    };
  }
}

// Export singleton instance
export const monitoringHooksService = MonitoringHooksService.getInstance();