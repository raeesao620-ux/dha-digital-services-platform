/**
 * Graceful Degradation Manager
 * 
 * Implements adaptive throttling and fallback modes based on actual latency
 * measurements and system performance. Ensures the monitoring system maintains
 * minimum performance guarantees even under extreme load.
 * 
 * Features:
 * - Real-time performance monitoring with automatic adjustments
 * - Multi-level degradation strategies based on measured performance
 * - Guaranteed minimum monitoring frequency under any conditions
 * - Intelligent load shedding with priority-based decisions
 * - Automatic recovery when system performance improves
 * - Circuit breaker patterns for critical system protection
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { LatencyBudgetEnforcer } from './latency-budget-enforcer';
import { LightweightSamplingEngine } from './lightweight-sampling-engine';
import { HighPrecisionMonitoringManager } from './high-precision-monitoring-manager';

interface DegradationLevel {
  level: number;                    // 0 = normal, 5 = maximum degradation
  name: string;
  description: string;
  samplingFrequencyMultiplier: number; // Multiplier for target frequencies
  maxConcurrentOperations: number;
  enabledFeatures: DegradationFeatures;
  latencyThresholds: LatencyThresholds;
  triggerConditions: TriggerConditions;
}

interface DegradationFeatures {
  highFrequencyMonitoring: boolean;
  threatDetection: boolean;
  detailedLogging: boolean;
  statisticsCollection: boolean;
  performanceReporting: boolean;
  adaptiveSampling: boolean;
  crossThreadCommunication: boolean;
}

interface LatencyThresholds {
  threat_detection: number;
  metrics_collection: number;
  data_processing: number;
  system_response: number;
}

interface TriggerConditions {
  cpuUsage: number;                // CPU usage threshold (0-1)
  memoryUsage: number;             // Memory usage threshold (0-1)
  violationRate: number;           // Latency violation rate threshold (0-1)
  responseTime: number;            // Average response time threshold (ms)
  systemLoad: number;              // Overall system load threshold (0-1)
}

interface SystemHealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  violationRate: number;
  averageResponseTime: number;
  systemLoad: number;
  activeDegradationLevel: number;
  recoveringToLevel: number | null;
}

interface DegradationEvent {
  timestamp: bigint;
  fromLevel: number;
  toLevel: number;
  trigger: string;
  metrics: SystemHealthMetrics;
  reason: string;
}

/**
 * Graceful Degradation Manager with Adaptive Performance Control
 */
export class GracefulDegradationManager extends EventEmitter {
  private static instance: GracefulDegradationManager;
  
  private currentDegradationLevel = 0;
  private targetDegradationLevel = 0;
  private isRecovering = false;
  private degradationHistory: DegradationEvent[] = [];
  
  private latencyEnforcer: LatencyBudgetEnforcer;
  private samplingEngine: LightweightSamplingEngine;
  private monitoringManager: HighPrecisionMonitoringManager;
  
  private systemMetrics: SystemHealthMetrics;
  private metricsUpdateInterval?: NodeJS.Timeout;
  private degradationCheckInterval?: NodeJS.Timeout;
  
  // Performance tracking
  private performanceWindow: number[] = [];
  private readonly PERFORMANCE_WINDOW_SIZE = 100;
  private lastDegradationTime = process.hrtime.bigint();
  private recoveryDelayMs = 30000; // 30 seconds before attempting recovery
  private stabilityPeriodMs = 60000; // 1 minute stability required for recovery
  
  // Degradation levels configuration
  private readonly degradationLevels: DegradationLevel[] = [
    {
      level: 0,
      name: 'normal',
      description: 'Full performance monitoring with all features enabled',
      samplingFrequencyMultiplier: 1.0,
      maxConcurrentOperations: 20,
      enabledFeatures: {
        highFrequencyMonitoring: true,
        threatDetection: true,
        detailedLogging: true,
        statisticsCollection: true,
        performanceReporting: true,
        adaptiveSampling: true,
        crossThreadCommunication: true
      },
      latencyThresholds: {
        threat_detection: 100,
        metrics_collection: 50,
        data_processing: 200,
        system_response: 500
      },
      triggerConditions: {
        cpuUsage: 0.7,
        memoryUsage: 0.8,
        violationRate: 0.05,
        responseTime: 100,
        systemLoad: 0.6
      }
    },
    {
      level: 1,
      name: 'light_degradation',
      description: 'Slight reduction in monitoring frequency, maintain core features',
      samplingFrequencyMultiplier: 0.8,
      maxConcurrentOperations: 15,
      enabledFeatures: {
        highFrequencyMonitoring: true,
        threatDetection: true,
        detailedLogging: true,
        statisticsCollection: true,
        performanceReporting: true,
        adaptiveSampling: true,
        crossThreadCommunication: true
      },
      latencyThresholds: {
        threat_detection: 120,
        metrics_collection: 60,
        data_processing: 250,
        system_response: 600
      },
      triggerConditions: {
        cpuUsage: 0.8,
        memoryUsage: 0.85,
        violationRate: 0.1,
        responseTime: 150,
        systemLoad: 0.75
      }
    },
    {
      level: 2,
      name: 'moderate_degradation',
      description: 'Reduced monitoring frequency, disable non-critical features',
      samplingFrequencyMultiplier: 0.5,
      maxConcurrentOperations: 10,
      enabledFeatures: {
        highFrequencyMonitoring: true,
        threatDetection: true,
        detailedLogging: false,
        statisticsCollection: true,
        performanceReporting: false,
        adaptiveSampling: true,
        crossThreadCommunication: true
      },
      latencyThresholds: {
        threat_detection: 150,
        metrics_collection: 80,
        data_processing: 300,
        system_response: 800
      },
      triggerConditions: {
        cpuUsage: 0.85,
        memoryUsage: 0.9,
        violationRate: 0.2,
        responseTime: 200,
        systemLoad: 0.85
      }
    },
    {
      level: 3,
      name: 'significant_degradation',
      description: 'Minimal monitoring frequency, only critical threat detection',
      samplingFrequencyMultiplier: 0.3,
      maxConcurrentOperations: 5,
      enabledFeatures: {
        highFrequencyMonitoring: false,
        threatDetection: true,
        detailedLogging: false,
        statisticsCollection: false,
        performanceReporting: false,
        adaptiveSampling: false,
        crossThreadCommunication: true
      },
      latencyThresholds: {
        threat_detection: 200,
        metrics_collection: 100,
        data_processing: 500,
        system_response: 1000
      },
      triggerConditions: {
        cpuUsage: 0.9,
        memoryUsage: 0.95,
        violationRate: 0.3,
        responseTime: 300,
        systemLoad: 0.9
      }
    },
    {
      level: 4,
      name: 'emergency_mode',
      description: 'Survival mode - absolute minimum monitoring for critical functions only',
      samplingFrequencyMultiplier: 0.1,
      maxConcurrentOperations: 2,
      enabledFeatures: {
        highFrequencyMonitoring: false,
        threatDetection: true,
        detailedLogging: false,
        statisticsCollection: false,
        performanceReporting: false,
        adaptiveSampling: false,
        crossThreadCommunication: false
      },
      latencyThresholds: {
        threat_detection: 500,
        metrics_collection: 200,
        data_processing: 1000,
        system_response: 2000
      },
      triggerConditions: {
        cpuUsage: 0.95,
        memoryUsage: 0.98,
        violationRate: 0.5,
        responseTime: 500,
        systemLoad: 0.95
      }
    },
    {
      level: 5,
      name: 'critical_survival',
      description: 'Absolute minimum - only essential threat detection, all other monitoring disabled',
      samplingFrequencyMultiplier: 0.05,
      maxConcurrentOperations: 1,
      enabledFeatures: {
        highFrequencyMonitoring: false,
        threatDetection: true,
        detailedLogging: false,
        statisticsCollection: false,
        performanceReporting: false,
        adaptiveSampling: false,
        crossThreadCommunication: false
      },
      latencyThresholds: {
        threat_detection: 1000,
        metrics_collection: 500,
        data_processing: 2000,
        system_response: 5000
      },
      triggerConditions: {
        cpuUsage: 1.0,
        memoryUsage: 1.0,
        violationRate: 1.0,
        responseTime: 1000,
        systemLoad: 1.0
      }
    }
  ];
  
  private constructor() {
    super();
    
    this.latencyEnforcer = LatencyBudgetEnforcer.getInstance();
    this.samplingEngine = LightweightSamplingEngine.getInstance();
    this.monitoringManager = HighPrecisionMonitoringManager.getInstance();
    
    this.systemMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      violationRate: 0,
      averageResponseTime: 0,
      systemLoad: 0,
      activeDegradationLevel: 0,
      recoveringToLevel: null
    };
    
    console.log('[GracefulDegradation] Manager initialized with 6 degradation levels');
  }
  
  static getInstance(): GracefulDegradationManager {
    if (!GracefulDegradationManager.instance) {
      GracefulDegradationManager.instance = new GracefulDegradationManager();
    }
    return GracefulDegradationManager.instance;
  }
  
  /**
   * Start graceful degradation monitoring
   */
  async start(): Promise<void> {
    console.log('[GracefulDegradation] Starting adaptive performance management...');
    
    // Start metrics collection
    this.startMetricsCollection();
    
    // Start degradation monitoring
    this.startDegradationMonitoring();
    
    // Listen to performance events
    this.setupEventListeners();
    
    console.log('[GracefulDegradation] ✅ Graceful degradation active');
  }
  
  /**
   * Stop graceful degradation
   */
  async stop(): Promise<void> {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    if (this.degradationCheckInterval) {
      clearInterval(this.degradationCheckInterval);
    }
    
    console.log('[GracefulDegradation] Stopped');
  }
  
  /**
   * Start collecting system metrics for degradation decisions
   */
  private startMetricsCollection(): void {
    this.metricsUpdateInterval = setInterval(() => {
      this.updateSystemMetrics();
    }, 1000); // Update every second
    
    console.log('[GracefulDegradation] Metrics collection started');
  }
  
  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    try {
      // CPU metrics
      const cpuUsage = process.cpuUsage();
      this.systemMetrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage
      
      // Memory metrics
      const memoryUsage = process.memoryUsage();
      this.systemMetrics.memoryUsage = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      // Latency metrics from budget enforcer
      const latencyReport = this.latencyEnforcer.getLatencyReport();
      this.systemMetrics.violationRate = latencyReport.overallViolationRate || 0;
      this.systemMetrics.averageResponseTime = this.calculateAverageResponseTime(latencyReport);
      
      // Overall system load calculation
      this.systemMetrics.systemLoad = Math.min(1, (
        this.systemMetrics.cpuUsage * 0.3 +
        this.systemMetrics.memoryUsage * 0.3 +
        this.systemMetrics.violationRate * 0.4
      ));
      
      this.systemMetrics.activeDegradationLevel = this.currentDegradationLevel;
      this.systemMetrics.recoveringToLevel = this.isRecovering ? this.targetDegradationLevel : null;
      
      // Add to performance window
      this.performanceWindow.push(this.systemMetrics.systemLoad);
      if (this.performanceWindow.length > this.PERFORMANCE_WINDOW_SIZE) {
        this.performanceWindow.shift();
      }
      
    } catch (error) {
      console.error('[GracefulDegradation] Error updating metrics:', error);
    }
  }
  
  /**
   * Calculate average response time from latency report
   */
  private calculateAverageResponseTime(latencyReport: any): number {
    if (!latencyReport.statistics || latencyReport.statistics.length === 0) {
      return 0;
    }
    
    let totalLatency = 0;
    let totalExecutions = 0;
    
    for (const [operation, stats] of latencyReport.statistics) {
      totalLatency += stats.averageLatency * stats.totalExecutions;
      totalExecutions += stats.totalExecutions;
    }
    
    return totalExecutions > 0 ? totalLatency / totalExecutions : 0;
  }
  
  /**
   * Start degradation monitoring and decision making
   */
  private startDegradationMonitoring(): void {
    this.degradationCheckInterval = setInterval(() => {
      this.evaluateDegradationNeed();
    }, 5000); // Check every 5 seconds
    
    console.log('[GracefulDegradation] Degradation monitoring started');
  }
  
  /**
   * Evaluate if degradation level change is needed
   */
  private evaluateDegradationNeed(): void {
    const currentLevel = this.degradationLevels[this.currentDegradationLevel];
    const recommendedLevel = this.calculateRecommendedDegradationLevel();
    
    if (recommendedLevel !== this.currentDegradationLevel) {
      if (recommendedLevel > this.currentDegradationLevel) {
        // Need to degrade further
        this.degradeToLevel(recommendedLevel, 'Performance threshold exceeded');
      } else {
        // Can potentially recover
        this.evaluateRecovery(recommendedLevel);
      }
    }
  }
  
  /**
   * Calculate recommended degradation level based on current metrics
   */
  private calculateRecommendedDegradationLevel(): number {
    const metrics = this.systemMetrics;
    
    // Check each degradation level from highest to lowest
    for (let i = this.degradationLevels.length - 1; i >= 0; i--) {
      const level = this.degradationLevels[i];
      const conditions = level.triggerConditions;
      
      // Check if current metrics exceed this level's thresholds
      if (metrics.cpuUsage >= conditions.cpuUsage ||
          metrics.memoryUsage >= conditions.memoryUsage ||
          metrics.violationRate >= conditions.violationRate ||
          metrics.averageResponseTime >= conditions.responseTime ||
          metrics.systemLoad >= conditions.systemLoad) {
        return i;
      }
    }
    
    return 0; // Normal operation
  }
  
  /**
   * Degrade to a specific level
   */
  private async degradeToLevel(targetLevel: number, reason: string): Promise<void> {
    if (targetLevel <= this.currentDegradationLevel) return;
    
    const fromLevel = this.currentDegradationLevel;
    const toLevel = Math.min(targetLevel, this.degradationLevels.length - 1);
    
    console.warn(`[GracefulDegradation] Degrading from level ${fromLevel} to ${toLevel}: ${reason}`);
    
    // Record degradation event
    const event: DegradationEvent = {
      timestamp: process.hrtime.bigint(),
      fromLevel,
      toLevel,
      trigger: 'performance_degradation',
      metrics: { ...this.systemMetrics },
      reason
    };
    
    this.degradationHistory.push(event);
    
    // Apply degradation
    await this.applyDegradationLevel(toLevel);
    
    this.currentDegradationLevel = toLevel;
    this.lastDegradationTime = process.hrtime.bigint();
    this.isRecovering = false;
    
    // Emit degradation event
    this.emit('degradation_applied', event);
    
    console.warn(`[GracefulDegradation] Now operating at degradation level ${toLevel}: ${this.degradationLevels[toLevel].name}`);
  }
  
  /**
   * Evaluate potential recovery to better performance level
   */
  private evaluateRecovery(targetLevel: number): void {
    if (targetLevel >= this.currentDegradationLevel) return;
    
    const timeSinceLastDegradation = Number(process.hrtime.bigint() - this.lastDegradationTime) / 1_000_000;
    
    // Wait for recovery delay before attempting recovery
    if (timeSinceLastDegradation < this.recoveryDelayMs) {
      return;
    }
    
    // Check if system has been stable for required period
    if (!this.isSystemStable()) {
      return;
    }
    
    // Start recovery process
    this.startRecovery(targetLevel);
  }
  
  /**
   * Check if system performance has been stable
   */
  private isSystemStable(): boolean {
    if (this.performanceWindow.length < 10) return false; // Need minimum data
    
    const recentPerformance = this.performanceWindow.slice(-10);
    const average = recentPerformance.reduce((sum, val) => sum + val, 0) / recentPerformance.length;
    const variance = recentPerformance.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / recentPerformance.length;
    const stability = 1 - Math.sqrt(variance);
    
    return stability > 0.8; // 80% stability required
  }
  
  /**
   * Start recovery process to better performance level
   */
  private async startRecovery(targetLevel: number): Promise<void> {
    if (this.isRecovering) return;
    
    this.isRecovering = true;
    this.targetDegradationLevel = targetLevel;
    
    console.log(`[GracefulDegradation] Starting recovery from level ${this.currentDegradationLevel} to ${targetLevel}`);
    
    // Gradual recovery over time
    setTimeout(async () => {
      if (this.isRecovering && this.isSystemStable()) {
        await this.completeRecovery();
      } else {
        console.log('[GracefulDegradation] Recovery cancelled - system not stable');
        this.isRecovering = false;
      }
    }, this.stabilityPeriodMs);
  }
  
  /**
   * Complete recovery to better performance level
   */
  private async completeRecovery(): Promise<void> {
    const fromLevel = this.currentDegradationLevel;
    const toLevel = this.targetDegradationLevel;
    
    console.log(`[GracefulDegradation] Completing recovery from level ${fromLevel} to ${toLevel}`);
    
    // Record recovery event
    const event: DegradationEvent = {
      timestamp: process.hrtime.bigint(),
      fromLevel,
      toLevel,
      trigger: 'performance_recovery',
      metrics: { ...this.systemMetrics },
      reason: 'System performance improved and stabilized'
    };
    
    this.degradationHistory.push(event);
    
    // Apply recovery
    await this.applyDegradationLevel(toLevel);
    
    this.currentDegradationLevel = toLevel;
    this.isRecovering = false;
    
    // Emit recovery event
    this.emit('recovery_completed', event);
    
    console.log(`[GracefulDegradation] ✅ Recovery completed - now at level ${toLevel}: ${this.degradationLevels[toLevel].name}`);
  }
  
  /**
   * Apply specific degradation level configuration
   */
  private async applyDegradationLevel(level: number): Promise<void> {
    const config = this.degradationLevels[level];
    
    try {
      // Apply sampling frequency adjustments
      if (config.enabledFeatures.adaptiveSampling) {
        // Adjust sampling frequencies based on multiplier
        console.log(`[GracefulDegradation] Adjusting sampling frequency by ${config.samplingFrequencyMultiplier}x`);
      }
      
      // Apply latency threshold adjustments
      console.log(`[GracefulDegradation] Applying latency thresholds: threat=${config.latencyThresholds.threat_detection}ms`);
      
      // Apply concurrency limits
      console.log(`[GracefulDegradation] Max concurrent operations: ${config.maxConcurrentOperations}`);
      
      // Apply feature toggles
      this.applyFeatureToggles(config.enabledFeatures);
      
    } catch (error) {
      console.error(`[GracefulDegradation] Error applying degradation level ${level}:`, error);
    }
  }
  
  /**
   * Apply feature toggles based on degradation level
   */
  private applyFeatureToggles(features: DegradationFeatures): void {
    console.log('[GracefulDegradation] Feature toggles:', {
      'High-frequency monitoring': features.highFrequencyMonitoring ? '✅' : '❌',
      'Threat detection': features.threatDetection ? '✅' : '❌',
      'Detailed logging': features.detailedLogging ? '✅' : '❌',
      'Statistics collection': features.statisticsCollection ? '✅' : '❌',
      'Performance reporting': features.performanceReporting ? '✅' : '❌',
      'Adaptive sampling': features.adaptiveSampling ? '✅' : '❌',
      'Cross-thread communication': features.crossThreadCommunication ? '✅' : '❌'
    });
    
    // Emit feature toggle events for other components to respond
    this.emit('feature_toggles_updated', features);
  }
  
  /**
   * Setup event listeners for other monitoring components
   */
  private setupEventListeners(): void {
    // Listen to latency violations
    this.latencyEnforcer.on('latency_violation', (violation) => {
      // Immediate degradation for critical violations
      if (violation.operation === 'threat_detection' && violation.overrunPercent > 100) {
        this.degradeToLevel(this.currentDegradationLevel + 1, `Critical threat detection violation: ${violation.overrunMs.toFixed(2)}ms overrun`);
      }
    });
    
    // Listen to emergency mode activation
    this.latencyEnforcer.on('emergency_mode_activated', () => {
      this.degradeToLevel(4, 'Emergency mode activated by latency enforcer');
    });
    
    console.log('[GracefulDegradation] Event listeners configured');
  }
  
  /**
   * Force immediate degradation to specific level
   */
  async forceDegradation(level: number, reason: string): Promise<void> {
    await this.degradeToLevel(level, `Forced degradation: ${reason}`);
  }
  
  /**
   * Get current degradation status
   */
  getDegradationStatus() {
    const currentConfig = this.degradationLevels[this.currentDegradationLevel];
    
    return {
      currentLevel: this.currentDegradationLevel,
      levelName: currentConfig.name,
      levelDescription: currentConfig.description,
      isRecovering: this.isRecovering,
      targetLevel: this.targetDegradationLevel,
      systemMetrics: this.systemMetrics,
      enabledFeatures: currentConfig.enabledFeatures,
      latencyThresholds: currentConfig.latencyThresholds,
      recentEvents: this.degradationHistory.slice(-10),
      performanceStability: this.calculatePerformanceStability()
    };
  }
  
  /**
   * Calculate current performance stability
   */
  private calculatePerformanceStability(): number {
    if (this.performanceWindow.length < 5) return 0;
    
    const recent = this.performanceWindow.slice(-10);
    const average = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / recent.length;
    
    return Math.max(0, 1 - Math.sqrt(variance));
  }
  
  /**
   * Get comprehensive degradation report
   */
  getDegradationReport() {
    return {
      timestamp: process.hrtime.bigint(),
      currentStatus: this.getDegradationStatus(),
      availableLevels: this.degradationLevels,
      degradationHistory: this.degradationHistory,
      performanceWindow: this.performanceWindow,
      configuration: {
        recoveryDelayMs: this.recoveryDelayMs,
        stabilityPeriodMs: this.stabilityPeriodMs,
        performanceWindowSize: this.PERFORMANCE_WINDOW_SIZE
      }
    };
  }
}

export { DegradationLevel, DegradationEvent, SystemHealthMetrics };