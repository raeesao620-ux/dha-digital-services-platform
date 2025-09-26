/**
 * High-Precision Monitoring Integration Service
 * 
 * Orchestrates all monitoring components into a unified, high-performance
 * monitoring system. Provides a single interface for managing worker threads,
 * latency budgets, sampling strategies, and performance validation.
 * 
 * Features:
 * - Unified control of all monitoring subsystems
 * - Coordinated startup and shutdown procedures
 * - Cross-component event coordination
 * - Centralized configuration management
 * - Health monitoring and auto-recovery
 * - Performance optimization coordination
 * - Real-time status reporting
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { HighPrecisionMonitoringManager } from './high-precision-monitoring-manager';
import { LightweightSamplingEngine } from './lightweight-sampling-engine';
import { WallClockValidator } from './wall-clock-validator';
import { LatencyBudgetEnforcer } from './latency-budget-enforcer';
import { GracefulDegradationManager } from './graceful-degradation-manager';
import { MicroBenchmarkingEngine } from './micro-benchmarking-engine';
import { PerformanceDocumentationService } from './performance-documentation';

interface MonitoringConfiguration {
  // Performance targets
  targetFrequency: number;          // Target monitoring frequency (Hz)
  threatDetectionBudget: number;    // Maximum threat detection latency (ms)
  maxCpuUsage: number;             // Maximum CPU usage threshold (0-1)
  
  // Feature toggles
  enableHighFrequencyMonitoring: boolean;
  enableThreatDetection: boolean;
  enablePerformanceValidation: boolean;
  enableAdaptiveDegradation: boolean;
  enableMicroBenchmarking: boolean;
  
  // Worker configuration
  metricsWorkers: number;          // Number of metrics collection workers
  threatWorkers: number;           // Number of threat detection workers
  
  // Validation settings
  wallClockValidationInterval: number; // Validation interval (ms)
  benchmarkSchedule: 'startup' | 'periodic' | 'on-demand';
  
  // Emergency settings
  emergencyMode: boolean;
  fallbackToMainThread: boolean;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical' | 'failed';
  components: ComponentHealth[];
  performance: PerformanceMetrics;
  alerts: SystemAlert[];
  lastUpdate: bigint;
}

interface ComponentHealth {
  component: string;
  status: 'running' | 'starting' | 'stopping' | 'failed' | 'degraded';
  uptime: number;               // Milliseconds
  errorCount: number;
  lastError?: string;
  performance?: any;
}

interface PerformanceMetrics {
  aggregatedFrequency: number;   // Total sampling frequency across all workers
  threatDetectionLatency: number;
  systemCpuUsage: number;
  memoryUsage: number;
  degradationLevel: number;
  validationPassRate: number;
}

interface SystemAlert {
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: bigint;
  resolved: boolean;
}

/**
 * High-Precision Monitoring Integration Service
 */
export class HighPrecisionMonitoringIntegration extends EventEmitter {
  private static instance: HighPrecisionMonitoringIntegration;
  
  // Component instances
  private monitoringManager: HighPrecisionMonitoringManager;
  private samplingEngine: LightweightSamplingEngine;
  private wallClockValidator: WallClockValidator;
  private latencyEnforcer: LatencyBudgetEnforcer;
  private degradationManager: GracefulDegradationManager;
  private benchmarkingEngine: MicroBenchmarkingEngine;
  private documentationService: PerformanceDocumentationService;
  
  // System state
  private isInitialized = false;
  private isRunning = false;
  private startupTime: bigint = 0n;
  private systemHealth: SystemHealth;
  private alerts: SystemAlert[] = [];
  
  // Configuration
  private config: MonitoringConfiguration = {
    targetFrequency: 1000,
    threatDetectionBudget: 100,
    maxCpuUsage: 0.8,
    enableHighFrequencyMonitoring: true,
    enableThreatDetection: true,
    enablePerformanceValidation: true,
    enableAdaptiveDegradation: true,
    enableMicroBenchmarking: true,
    metricsWorkers: 2,
    threatWorkers: 1,
    wallClockValidationInterval: 10000,
    benchmarkSchedule: 'startup',
    emergencyMode: false,
    fallbackToMainThread: false
  };
  
  // Health monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  private validationScheduler?: NodeJS.Timeout;
  
  private constructor() {
    super();
    
    // Initialize component instances
    this.monitoringManager = HighPrecisionMonitoringManager.getInstance();
    this.samplingEngine = LightweightSamplingEngine.getInstance();
    this.wallClockValidator = WallClockValidator.getInstance();
    this.latencyEnforcer = LatencyBudgetEnforcer.getInstance();
    this.degradationManager = GracefulDegradationManager.getInstance();
    this.benchmarkingEngine = MicroBenchmarkingEngine.getInstance();
    this.documentationService = PerformanceDocumentationService.getInstance();
    
    // Initialize system health
    this.systemHealth = {
      overall: 'failed',
      components: [],
      performance: {
        aggregatedFrequency: 0,
        threatDetectionLatency: 0,
        systemCpuUsage: 0,
        memoryUsage: 0,
        degradationLevel: 0,
        validationPassRate: 0
      },
      alerts: [],
      lastUpdate: 0n
    };
    
    console.log('[MonitoringIntegration] Integration service initialized');
  }
  
  static getInstance(): HighPrecisionMonitoringIntegration {
    if (!HighPrecisionMonitoringIntegration.instance) {
      HighPrecisionMonitoringIntegration.instance = new HighPrecisionMonitoringIntegration();
    }
    return HighPrecisionMonitoringIntegration.instance;
  }
  
  /**
   * Initialize the complete monitoring system
   */
  async initialize(customConfig?: Partial<MonitoringConfiguration>): Promise<void> {
    if (this.isInitialized) {
      console.log('[MonitoringIntegration] Already initialized');
      return;
    }
    
    console.log('[MonitoringIntegration] Initializing high-precision monitoring system...');
    
    // Apply custom configuration
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    
    try {
      // Setup cross-component event listeners
      this.setupEventListeners();
      
      // Initialize component health tracking
      this.initializeComponentHealth();
      
      this.isInitialized = true;
      console.log('[MonitoringIntegration] ✅ System initialized');
      
    } catch (error) {
      console.error('[MonitoringIntegration] Initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Start the complete monitoring system
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('System must be initialized before starting');
    }
    
    if (this.isRunning) {
      console.log('[MonitoringIntegration] Already running');
      return;
    }
    
    console.log('[MonitoringIntegration] Starting high-precision monitoring system...');
    this.startupTime = process.hrtime.bigint();
    
    try {
      // Start components in dependency order
      await this.startComponentsSequentially();
      
      // Run initial validation if enabled
      if (this.config.enablePerformanceValidation) {
        await this.runInitialValidation();
      }
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Schedule periodic validation
      this.schedulePeriodicValidation();
      
      this.isRunning = true;
      this.updateSystemHealth();
      
      console.log('[MonitoringIntegration] ✅ High-precision monitoring system is fully operational');
      
      // Emit system ready event
      this.emit('system_ready', {
        startupTime: Number(process.hrtime.bigint() - this.startupTime) / 1_000_000,
        configuration: this.config,
        health: this.systemHealth
      });
      
    } catch (error) {
      console.error('[MonitoringIntegration] Startup failed:', error);
      await this.handleStartupFailure(error);
      throw error;
    }
  }
  
  /**
   * Stop the complete monitoring system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log('[MonitoringIntegration] Stopping monitoring system...');
    
    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      
      if (this.validationScheduler) {
        clearInterval(this.validationScheduler);
      }
      
      // Stop components in reverse order
      await this.stopComponentsSequentially();
      
      this.isRunning = false;
      
      console.log('[MonitoringIntegration] ✅ Monitoring system stopped');
      
    } catch (error) {
      console.error('[MonitoringIntegration] Shutdown error:', error);
      throw error;
    }
  }
  
  /**
   * Start components in proper dependency order
   */
  private async startComponentsSequentially(): Promise<void> {
    const startupSequence = [
      { name: 'latency-enforcer', component: this.latencyEnforcer },
      { name: 'degradation-manager', component: this.degradationManager },
      { name: 'sampling-engine', component: this.samplingEngine },
      { name: 'monitoring-manager', component: this.monitoringManager }
    ];
    
    for (const { name, component } of startupSequence) {
      try {
        console.log(`[MonitoringIntegration] Starting ${name}...`);
        await component.start();
        this.updateComponentHealth(name, 'running');
        console.log(`[MonitoringIntegration] ✅ ${name} started`);
      } catch (error) {
        console.error(`[MonitoringIntegration] Failed to start ${name}:`, error);
        this.updateComponentHealth(name, 'failed', error.message);
        throw error;
      }
    }
  }
  
  /**
   * Stop components in reverse order
   */
  private async stopComponentsSequentially(): Promise<void> {
    const shutdownSequence = [
      { name: 'monitoring-manager', component: this.monitoringManager },
      { name: 'sampling-engine', component: this.samplingEngine },
      { name: 'degradation-manager', component: this.degradationManager },
      { name: 'latency-enforcer', component: this.latencyEnforcer }
    ];
    
    for (const { name, component } of shutdownSequence) {
      try {
        console.log(`[MonitoringIntegration] Stopping ${name}...`);
        await component.stop();
        this.updateComponentHealth(name, 'stopping');
      } catch (error) {
        console.error(`[MonitoringIntegration] Error stopping ${name}:`, error);
      }
    }
  }
  
  /**
   * Run initial validation on system startup
   */
  private async runInitialValidation(): Promise<void> {
    console.log('[MonitoringIntegration] Running initial system validation...');
    
    try {
      if (this.config.benchmarkSchedule === 'startup') {
        // Run micro-benchmarks
        console.log('[MonitoringIntegration] Running startup benchmarks...');
        await this.benchmarkingEngine.runAllBenchmarks();
        
        // Generate performance documentation
        console.log('[MonitoringIntegration] Generating performance documentation...');
        await this.documentationService.generatePerformanceReport();
      }
      
      // Run wall-clock validation
      console.log('[MonitoringIntegration] Running wall-clock validation...');
      await this.wallClockValidator.runFullValidation();
      
      console.log('[MonitoringIntegration] ✅ Initial validation completed');
      
    } catch (error) {
      console.error('[MonitoringIntegration] Initial validation failed:', error);
      this.addAlert('warning', 'validation', 'Initial validation failed - system may not meet performance targets');
    }
  }
  
  /**
   * Setup cross-component event listeners
   */
  private setupEventListeners(): void {
    // Listen to latency violations for automatic degradation
    this.latencyEnforcer.on('latency_violation', (violation) => {
      this.addAlert('warning', 'latency-enforcer', `Latency violation in ${violation.operation}: ${violation.overrunMs.toFixed(2)}ms overrun`);
      
      // Trigger degradation if critical
      if (violation.operation === 'threat_detection' && violation.overrunMs > 50) {
        this.degradationManager.forceDegradation(this.degradationManager.getDegradationStatus().currentLevel + 1, 'Critical latency violation');
      }
    });
    
    // Listen to emergency mode activation
    this.latencyEnforcer.on('emergency_mode_activated', () => {
      this.addAlert('critical', 'latency-enforcer', 'Emergency mode activated due to repeated latency violations');
    });
    
    // Listen to degradation events
    this.degradationManager.on('degradation_applied', (event) => {
      this.addAlert('warning', 'degradation-manager', `System degraded to level ${event.toLevel}: ${event.reason}`);
    });
    
    this.degradationManager.on('recovery_completed', (event) => {
      this.addAlert('info', 'degradation-manager', `System recovered to level ${event.toLevel}`);
    });
    
    // Listen to validation failures
    this.wallClockValidator.on('validation_failed', (data) => {
      this.addAlert('error', 'wall-clock-validator', `Validation failed for ${data.testName}: ${data.actualFrequency.toFixed(2)} Hz (target: ${data.targetFrequency} Hz)`);
    });
    
    // Listen to performance updates
    this.samplingEngine.on('performance_report', (report) => {
      this.updatePerformanceMetrics(report);
    });
    
    console.log('[MonitoringIntegration] Event listeners configured');
  }
  
  /**
   * Initialize component health tracking
   */
  private initializeComponentHealth(): void {
    const components = [
      'monitoring-manager',
      'sampling-engine', 
      'wall-clock-validator',
      'latency-enforcer',
      'degradation-manager',
      'benchmarking-engine',
      'documentation-service'
    ];
    
    this.systemHealth.components = components.map(component => ({
      component,
      status: 'starting',
      uptime: 0,
      errorCount: 0
    }));
  }
  
  /**
   * Update component health status
   */
  private updateComponentHealth(componentName: string, status: ComponentHealth['status'], errorMessage?: string): void {
    const component = this.systemHealth.components.find(c => c.component === componentName);
    if (component) {
      component.status = status;
      component.uptime = this.startupTime ? Number(process.hrtime.bigint() - this.startupTime) / 1_000_000 : 0;
      
      if (errorMessage) {
        component.errorCount++;
        component.lastError = errorMessage;
      }
    }
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.updateSystemHealth();
    }, 5000); // Check health every 5 seconds
    
    console.log('[MonitoringIntegration] Health monitoring started');
  }
  
  /**
   * Update overall system health
   */
  private updateSystemHealth(): void {
    const runningComponents = this.systemHealth.components.filter(c => c.status === 'running').length;
    const failedComponents = this.systemHealth.components.filter(c => c.status === 'failed').length;
    const totalComponents = this.systemHealth.components.length;
    
    // Determine overall health
    if (failedComponents === 0 && runningComponents === totalComponents) {
      this.systemHealth.overall = 'healthy';
    } else if (failedComponents === 0) {
      this.systemHealth.overall = 'degraded';
    } else if (runningComponents > failedComponents) {
      this.systemHealth.overall = 'critical';
    } else {
      this.systemHealth.overall = 'failed';
    }
    
    // Update performance metrics
    this.updateCurrentPerformanceMetrics();
    
    this.systemHealth.lastUpdate = process.hrtime.bigint();
    
    // Emit health update
    this.emit('health_update', this.systemHealth);
  }
  
  /**
   * Update current performance metrics
   */
  private updateCurrentPerformanceMetrics(): void {
    try {
      // Get aggregated stats from monitoring manager
      const monitoringStats = this.monitoringManager.getAggregatedStats();
      this.systemHealth.performance.aggregatedFrequency = monitoringStats.aggregatedFrequency || 0;
      
      // Get threat detection metrics
      const threatMetrics = this.latencyEnforcer.getThreatDetectionMetrics();
      this.systemHealth.performance.threatDetectionLatency = threatMetrics.statistics?.averageLatency || 0;
      
      // Get degradation level
      const degradationStatus = this.degradationManager.getDegradationStatus();
      this.systemHealth.performance.degradationLevel = degradationStatus.currentLevel;
      
      // Get system metrics
      const memoryUsage = process.memoryUsage();
      this.systemHealth.performance.memoryUsage = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      // Calculate validation pass rate
      const validationSummary = this.wallClockValidator.getValidationSummary();
      this.systemHealth.performance.validationPassRate = validationSummary.successRate || 0;
      
    } catch (error) {
      console.error('[MonitoringIntegration] Error updating performance metrics:', error);
    }
  }
  
  /**
   * Update performance metrics from reports
   */
  private updatePerformanceMetrics(report: any): void {
    if (report.samplingRate) {
      this.systemHealth.performance.aggregatedFrequency = report.samplingRate;
    }
    if (report.cpuLoad) {
      this.systemHealth.performance.systemCpuUsage = report.cpuLoad;
    }
  }
  
  /**
   * Schedule periodic validation
   */
  private schedulePeriodicValidation(): void {
    if (this.config.benchmarkSchedule === 'periodic') {
      this.validationScheduler = setInterval(async () => {
        try {
          console.log('[MonitoringIntegration] Running periodic validation...');
          await this.wallClockValidator.runFullValidation();
        } catch (error) {
          console.error('[MonitoringIntegration] Periodic validation failed:', error);
        }
      }, this.config.wallClockValidationInterval);
      
      console.log(`[MonitoringIntegration] Periodic validation scheduled every ${this.config.wallClockValidationInterval}ms`);
    }
  }
  
  /**
   * Add system alert
   */
  private addAlert(severity: SystemAlert['severity'], component: string, message: string): void {
    const alert: SystemAlert = {
      severity,
      component,
      message,
      timestamp: process.hrtime.bigint(),
      resolved: false
    };
    
    this.alerts.push(alert);
    this.systemHealth.alerts = this.alerts.slice(-20); // Keep last 20 alerts
    
    console.log(`[MonitoringIntegration] ${severity.toUpperCase()} Alert from ${component}: ${message}`);
    
    // Emit alert event
    this.emit('alert', alert);
  }
  
  /**
   * Handle startup failure
   */
  private async handleStartupFailure(error: Error): Promise<void> {
    this.addAlert('critical', 'integration', `System startup failed: ${error.message}`);
    
    if (this.config.fallbackToMainThread) {
      console.log('[MonitoringIntegration] Attempting fallback to main thread monitoring...');
      // Implement fallback logic here
    }
  }
  
  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      timestamp: process.hrtime.bigint(),
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      uptime: this.startupTime ? Number(process.hrtime.bigint() - this.startupTime) / 1_000_000_000 : 0,
      configuration: this.config,
      health: this.systemHealth,
      recentAlerts: this.alerts.slice(-10),
      performanceReport: this.documentationService.getCurrentReport()
    };
  }
  
  /**
   * Run on-demand validation
   */
  async runValidation(): Promise<any> {
    console.log('[MonitoringIntegration] Running on-demand validation...');
    
    const results = {
      wallClock: await this.wallClockValidator.runFullValidation(),
      benchmarks: this.config.enableMicroBenchmarking ? await this.benchmarkingEngine.runAllBenchmarks() : null,
      documentation: await this.documentationService.generatePerformanceReport()
    };
    
    this.addAlert('info', 'integration', 'On-demand validation completed');
    return results;
  }
  
  /**
   * Update system configuration
   */
  async updateConfiguration(newConfig: Partial<MonitoringConfiguration>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    console.log('[MonitoringIntegration] Configuration updated');
    
    // Apply configuration changes that require restarts
    if (newConfig.metricsWorkers !== oldConfig.metricsWorkers || 
        newConfig.threatWorkers !== oldConfig.threatWorkers) {
      
      if (this.isRunning) {
        console.log('[MonitoringIntegration] Restarting system for configuration changes...');
        await this.stop();
        await this.start();
      }
    }
    
    this.emit('configuration_updated', { oldConfig, newConfig: this.config });
  }
}

export { HighPrecisionMonitoringIntegration, MonitoringConfiguration, SystemHealth, SystemAlert };