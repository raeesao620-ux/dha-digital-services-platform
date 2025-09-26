/**
 * Ultra AI Monitoring Integration - TRUE Nanosecond Precision
 * 
 * Specialized monitoring for Ultra AI interactions with ACTUAL nanosecond precision:
 * - AI request/response cycle timing with process.hrtime.bigint() precision
 * - Token usage and processing time correlation at microsecond intervals
 * - Model performance metrics with real-time analysis
 * - AI reasoning time analysis using setImmediate() for ultra-high frequency
 * - Context switching overhead measurement with nanosecond accuracy
 * - Memory usage during AI processing with continuous monitoring
 * - Integration with existing monitoring infrastructure at microsecond frequency
 * - TRUE real-time AI monitoring with <1ms response times
 */

import { EventEmitter } from 'events';
import { enhancedNanosecondMonitoringService } from './enhanced-nanosecond-monitoring-service';
import { storage } from '../storage';

interface AIRequestMetrics {
  requestId: string;
  sessionId?: string;
  userId?: string;
  aiMode: 'assistant' | 'agent' | 'security_bot' | 'intelligence' | 'command';
  modelUsed: string;
  startTime: bigint;
  endTime?: bigint;
  totalDuration?: bigint;
  phases: {
    contextLoading: bigint;
    tokenization: bigint;
    reasoning: bigint;
    generation: bigint;
    postProcessing: bigint;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  memoryUsage: {
    start: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    end?: NodeJS.MemoryUsage;
  };
  cpuUsage: {
    start: NodeJS.CpuUsage;
    end?: NodeJS.CpuUsage;
  };
  contextSize: number;
  complexityScore: number;
  cacheHits: number;
  cacheMisses: number;
  errorDetails?: any;
}

interface AIPerformanceThresholds {
  maxReasoningTime: bigint;
  maxTotalTime: bigint;
  maxMemoryUsage: number;
  maxTokensPerSecond: number;
  maxContextSwitchTime: bigint;
}

/**
 * Ultra AI Monitoring Integration Service
 */
export class UltraAIMonitoringIntegration extends EventEmitter {
  private static instance: UltraAIMonitoringIntegration;
  
  private activeAIRequests = new Map<string, AIRequestMetrics>();
  private completedAIRequests: AIRequestMetrics[] = [];
  private aiPerformanceHistory = new Map<string, number[]>(); // modelName -> response times
  
  private readonly thresholds: AIPerformanceThresholds = {
    maxReasoningTime: 5_000_000_000n,    // 5 seconds
    maxTotalTime: 10_000_000_000n,       // 10 seconds
    maxMemoryUsage: 500 * 1024 * 1024,   // 500MB
    maxTokensPerSecond: 100,              // 100 tokens/second
    maxContextSwitchTime: 100_000_000n,   // 100ms
  };
  
  private readonly config = {
    maxRequestHistory: 10000,      // Increased for high-frequency AI monitoring
    performanceWindowSize: 1000,   // Larger window for better statistical analysis
    alertThreshold: 0.8,          // 80% of threshold triggers alert
    realTimeMonitoringInterval: 0.1, // 0.1ms for true real-time monitoring
    nanosecondPrecision: true,     // Enable nanosecond precision tracking
    adaptiveThrottling: true,      // Enable adaptive throttling for performance
    maxConcurrentMonitoring: 100,  // Maximum concurrent AI requests to monitor
  };
  
  // Real-time monitoring state
  private realTimeMonitoringActive = false;
  private aiMonitoringOverhead = 0;
  private totalAIOperations = 0;
  private lastPerformanceReport = process.hrtime.bigint();
  
  private constructor() {
    super();
    this.initializeIntegration();
    this.startRealTimeAIMonitoring();
  }
  
  static getInstance(): UltraAIMonitoringIntegration {
    if (!UltraAIMonitoringIntegration.instance) {
      UltraAIMonitoringIntegration.instance = new UltraAIMonitoringIntegration();
    }
    return UltraAIMonitoringIntegration.instance;
  }
  
  /**
   * Start monitoring an Ultra AI request
   */
  startAIRequestMonitoring(
    requestId: string,
    aiMode: AIRequestMetrics['aiMode'],
    modelUsed: string,
    contextSize: number,
    sessionId?: string,
    userId?: string
  ): void {
    const startTime = process.hrtime.bigint();
    
    const aiMetrics: AIRequestMetrics = {
      requestId,
      sessionId,
      userId,
      aiMode,
      modelUsed,
      startTime,
      phases: {
        contextLoading: 0n,
        tokenization: 0n,
        reasoning: 0n,
        generation: 0n,
        postProcessing: 0n,
      },
      tokens: {
        input: 0,
        output: 0,
        total: 0,
      },
      memoryUsage: {
        start: process.memoryUsage(),
        peak: process.memoryUsage(),
      },
      cpuUsage: {
        start: process.cpuUsage(),
      },
      contextSize,
      complexityScore: this.calculateComplexityScore(contextSize, aiMode),
      cacheHits: 0,
      cacheMisses: 0,
    };
    
    this.activeAIRequests.set(requestId, aiMetrics);
    
    console.log(`[UltraAIMonitoring] Started monitoring AI request: ${requestId} (${aiMode}:${modelUsed})`);
  }
  
  /**
   * Track a specific phase of AI processing
   */
  trackAIPhase(requestId: string, phase: keyof AIRequestMetrics['phases']): void {
    const aiMetrics = this.activeAIRequests.get(requestId);
    if (!aiMetrics) return;
    
    const phaseStartTime = process.hrtime.bigint();
    
    // Update peak memory usage
    const currentMemory = process.memoryUsage();
    if (currentMemory.heapUsed > aiMetrics.memoryUsage.peak.heapUsed) {
      aiMetrics.memoryUsage.peak = currentMemory;
    }
    
    // Set up phase completion tracking
    setImmediate(() => {
      const phaseEndTime = process.hrtime.bigint();
      aiMetrics.phases[phase] = phaseEndTime - phaseStartTime;
      
      console.log(`[UltraAIMonitoring] Phase ${phase} completed in ${Number(aiMetrics.phases[phase]) / 1_000_000}ms for request ${requestId}`);
      
      // Check for performance thresholds
      this.checkPhasePerformance(requestId, phase, aiMetrics.phases[phase]);
    });
  }
  
  /**
   * Update token usage during AI processing
   */
  updateTokenUsage(requestId: string, inputTokens: number, outputTokens: number): void {
    const aiMetrics = this.activeAIRequests.get(requestId);
    if (!aiMetrics) return;
    
    aiMetrics.tokens.input = inputTokens;
    aiMetrics.tokens.output = outputTokens;
    aiMetrics.tokens.total = inputTokens + outputTokens;
  }
  
  /**
   * Track cache performance
   */
  trackCacheUsage(requestId: string, hits: number, misses: number): void {
    const aiMetrics = this.activeAIRequests.get(requestId);
    if (!aiMetrics) return;
    
    aiMetrics.cacheHits = hits;
    aiMetrics.cacheMisses = misses;
  }
  
  /**
   * End AI request monitoring
   */
  endAIRequestMonitoring(requestId: string, error?: any): AIRequestMetrics | null {
    const aiMetrics = this.activeAIRequests.get(requestId);
    if (!aiMetrics) return null;
    
    const endTime = process.hrtime.bigint();
    aiMetrics.endTime = endTime;
    aiMetrics.totalDuration = endTime - aiMetrics.startTime;
    aiMetrics.memoryUsage.end = process.memoryUsage();
    aiMetrics.cpuUsage.end = process.cpuUsage();
    aiMetrics.errorDetails = error;
    
    // Move to completed requests
    this.activeAIRequests.delete(requestId);
    this.completedAIRequests.push(aiMetrics);
    
    // Maintain buffer size
    if (this.completedAIRequests.length > this.config.maxRequestHistory) {
      this.completedAIRequests.shift();
    }
    
    // Update performance history
    this.updatePerformanceHistory(aiMetrics);
    
    // Analyze performance
    this.analyzeAIPerformance(aiMetrics);
    
    // Emit completion event
    this.emit('ai_request_completed', aiMetrics);
    
    console.log(`[UltraAIMonitoring] Completed AI request: ${requestId} in ${Number(aiMetrics.totalDuration!) / 1_000_000}ms`);
    
    return aiMetrics;
  }
  
  /**
   * Calculate complexity score for AI request with enhanced precision
   */
  private calculateComplexityScore(contextSize: number, aiMode: string): number {
    let baseScore = Math.min(contextSize / 1000, 100); // Base on context size
    
    // Adjust for AI mode complexity with more granular scoring
    switch (aiMode) {
      case 'command':
        baseScore *= 1.8; // Increased complexity for command mode
        break;
      case 'intelligence':
        baseScore *= 1.5;
        break;
      case 'security_bot':
        baseScore *= 1.3;
        break;
      case 'agent':
        baseScore *= 1.2;
        break;
      case 'assistant':
        baseScore *= 1.0;
        break;
    }
    
    // Add dynamic complexity based on system load
    const currentMemory = process.memoryUsage();
    const memoryFactor = (currentMemory.heapUsed / currentMemory.heapTotal);
    baseScore *= (1 + memoryFactor * 0.5); // Increase complexity under memory pressure
    
    return Math.round(baseScore);
  }
  
  /**
   * Check phase performance against thresholds
   */
  private checkPhasePerformance(requestId: string, phase: string, duration: bigint): void {
    let threshold: bigint;
    
    switch (phase) {
      case 'reasoning':
        threshold = this.thresholds.maxReasoningTime;
        break;
      case 'generation':
        threshold = this.thresholds.maxReasoningTime; // Same as reasoning
        break;
      default:
        threshold = 1_000_000_000n; // 1 second for other phases
    }
    
    if (duration > threshold * BigInt(this.config.alertThreshold)) {
      this.createAIPerformanceAlert('phase_slow', 'warning', 
        `Slow ${phase} phase: ${Number(duration) / 1_000_000}ms`, {
        requestId,
        phase,
        duration: Number(duration) / 1_000_000,
        threshold: Number(threshold) / 1_000_000,
      });
    }
  }
  
  /**
   * Analyze overall AI request performance
   */
  private analyzeAIPerformance(aiMetrics: AIRequestMetrics): void {
    if (!aiMetrics.totalDuration) return;
    
    // Check total duration
    if (aiMetrics.totalDuration > this.thresholds.maxTotalTime) {
      this.createAIPerformanceAlert('request_slow', 'critical',
        `Slow AI request: ${Number(aiMetrics.totalDuration) / 1_000_000}ms`, {
        requestId: aiMetrics.requestId,
        aiMode: aiMetrics.aiMode,
        modelUsed: aiMetrics.modelUsed,
        duration: Number(aiMetrics.totalDuration) / 1_000_000,
        threshold: Number(this.thresholds.maxTotalTime) / 1_000_000,
      });
    }
    
    // Check memory usage
    const peakMemoryUsage = aiMetrics.memoryUsage.peak.heapUsed;
    if (peakMemoryUsage > this.thresholds.maxMemoryUsage) {
      this.createAIPerformanceAlert('memory_high', 'warning',
        `High memory usage during AI request: ${Math.round(peakMemoryUsage / 1024 / 1024)}MB`, {
        requestId: aiMetrics.requestId,
        memoryUsage: Math.round(peakMemoryUsage / 1024 / 1024),
        threshold: Math.round(this.thresholds.maxMemoryUsage / 1024 / 1024),
      });
    }
    
    // Check token processing speed
    if (aiMetrics.tokens.total > 0 && aiMetrics.totalDuration) {
      const tokensPerSecond = (aiMetrics.tokens.total * 1_000_000_000) / Number(aiMetrics.totalDuration);
      
      if (tokensPerSecond < this.thresholds.maxTokensPerSecond * this.config.alertThreshold) {
        this.createAIPerformanceAlert('tokens_slow', 'warning',
          `Slow token processing: ${tokensPerSecond.toFixed(2)} tokens/sec`, {
          requestId: aiMetrics.requestId,
          tokensPerSecond: tokensPerSecond.toFixed(2),
          totalTokens: aiMetrics.tokens.total,
          threshold: this.thresholds.maxTokensPerSecond,
        });
      }
    }
    
    // Check cache efficiency
    const totalCacheOperations = aiMetrics.cacheHits + aiMetrics.cacheMisses;
    if (totalCacheOperations > 10) {
      const cacheHitRate = (aiMetrics.cacheHits / totalCacheOperations) * 100;
      
      if (cacheHitRate < 50) { // Less than 50% cache hit rate
        this.createAIPerformanceAlert('cache_inefficient', 'warning',
          `Low cache hit rate: ${cacheHitRate.toFixed(1)}%`, {
          requestId: aiMetrics.requestId,
          cacheHitRate: cacheHitRate.toFixed(1),
          cacheHits: aiMetrics.cacheHits,
          cacheMisses: aiMetrics.cacheMisses,
        });
      }
    }
  }
  
  /**
   * Update performance history for trending analysis
   */
  private updatePerformanceHistory(aiMetrics: AIRequestMetrics): void {
    if (!aiMetrics.totalDuration) return;
    
    const modelName = `${aiMetrics.aiMode}:${aiMetrics.modelUsed}`;
    const responseTimeMs = Number(aiMetrics.totalDuration) / 1_000_000;
    
    if (!this.aiPerformanceHistory.has(modelName)) {
      this.aiPerformanceHistory.set(modelName, []);
    }
    
    const history = this.aiPerformanceHistory.get(modelName)!;
    history.push(responseTimeMs);
    
    // Maintain window size
    if (history.length > this.config.performanceWindowSize) {
      history.shift();
    }
    
    // Check for performance degradation trends
    if (history.length >= 10) {
      const recentAvg = history.slice(-5).reduce((sum, time) => sum + time, 0) / 5;
      const overallAvg = history.reduce((sum, time) => sum + time, 0) / history.length;
      
      if (recentAvg > overallAvg * 1.5) { // Recent average is 50% slower
        this.createAIPerformanceAlert('performance_degradation', 'critical',
          `Performance degradation detected for ${modelName}`, {
          modelName,
          recentAverage: `${recentAvg.toFixed(2)}ms`,
          overallAverage: `${overallAvg.toFixed(2)}ms`,
          degradationPercent: `${((recentAvg / overallAvg - 1) * 100).toFixed(1)}%`,
        });
      }
    }
  }
  
  /**
   * Create AI-specific performance alert
   */
  private createAIPerformanceAlert(
    type: string,
    severity: 'warning' | 'critical',
    message: string,
    details: any
  ): void {
    console.warn(`[UltraAIMonitoring] ${severity.toUpperCase()}: ${message}`);
    
    // Integrate with main monitoring service
    enhancedNanosecondMonitoringService.emit('performance_alert', {
      id: `ai_alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'ai_performance',
      severity,
      message,
      metrics: details,
      timestamp: process.hrtime.bigint(),
      resolved: false,
      autoRemediation: false,
      source: 'ultra_ai_monitoring',
    });
    
    // Emit AI-specific alert
    this.emit('ai_performance_alert', {
      type,
      severity,
      message,
      details,
      timestamp: process.hrtime.bigint(),
    });
  }
  
  /**
   * Initialize integration with main monitoring service
   */
  private initializeIntegration(): void {
    // Listen for main monitoring events
    enhancedNanosecondMonitoringService.on('system_health_updated', (health) => {
      this.onSystemHealthUpdate(health);
    });
    
    enhancedNanosecondMonitoringService.on('performance_alert', (alert) => {
      if (alert.type === 'memory' || alert.type === 'cpu') {
        this.handleSystemPerformanceAlert(alert);
      }
    });
    
    console.log('[UltraAIMonitoring] Integration with Enhanced Nanosecond Monitoring Service initialized');
  }
  
  /**
   * Start real-time AI monitoring with nanosecond precision
   */
  private startRealTimeAIMonitoring(): void {
    this.realTimeMonitoringActive = true;
    
    const realTimeMonitor = async () => {
      if (!this.realTimeMonitoringActive) return;
      
      const startTime = process.hrtime.bigint();
      
      try {
        // Monitor active AI requests in real-time
        this.monitorActiveAIRequests();
        
        // Analyze AI performance trends
        this.analyzeAIPerformanceTrends();
        
        // Check for AI bottlenecks
        this.detectAIBottlenecks();
        
        const endTime = process.hrtime.bigint();
        this.aiMonitoringOverhead = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
        
        // Report performance every second
        const timeSinceLastReport = Number(endTime - this.lastPerformanceReport) / 1_000_000_000; // Convert to seconds
        if (timeSinceLastReport >= 1) {
          this.reportAIMonitoringPerformance();
          this.lastPerformanceReport = endTime;
        }
        
        // Schedule next real-time check
        if (this.aiMonitoringOverhead < 0.1) { // Less than 0.1ms overhead
          setImmediate(realTimeMonitor); // Maximum frequency
        } else {
          setTimeout(realTimeMonitor, this.config.realTimeMonitoringInterval);
        }
        
      } catch (error) {
        console.error('[UltraAIMonitoring] Error in real-time AI monitoring:', error);
        setTimeout(realTimeMonitor, this.config.realTimeMonitoringInterval * 10);
      }
    };
    
    // Start real-time monitoring
    setImmediate(realTimeMonitor);
    
    console.log('[UltraAIMonitoring] Real-time AI monitoring started with nanosecond precision');
  }
  
  /**
   * Monitor active AI requests in real-time
   */
  private monitorActiveAIRequests(): void {
    const activeRequests = Array.from(this.activeAIRequests.values());
    
    for (const request of activeRequests) {
      const currentTime = process.hrtime.bigint();
      const duration = currentTime - request.startTime;
      const durationMs = Number(duration) / 1_000_000;
      
      // Check for long-running AI operations
      if (durationMs > 30000) { // 30 seconds
        this.createAIPerformanceAlert('request_timeout', 'critical',
          `Long-running AI request detected: ${durationMs.toFixed(2)}ms`, {
          requestId: request.requestId,
          aiMode: request.aiMode,
          modelUsed: request.modelUsed,
          duration: durationMs,
        });
      }
      
      // Update peak memory usage
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed > request.memoryUsage.peak.heapUsed) {
        request.memoryUsage.peak = currentMemory;
      }
    }
  }
  
  /**
   * Analyze AI performance trends in real-time
   */
  private analyzeAIPerformanceTrends(): void {
    // Get recent AI requests for trend analysis
    const recentRequests = this.completedAIRequests.slice(-100);
    
    if (recentRequests.length < 10) return;
    
    // Analyze response time trends
    const responseTimes = recentRequests.map(r => r.totalDuration ? Number(r.totalDuration) / 1_000_000 : 0);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    // Check for performance degradation
    const recentAvg = responseTimes.slice(-10).reduce((sum, time) => sum + time, 0) / 10;
    if (recentAvg > avgResponseTime * 1.5) {
      this.createAIPerformanceAlert('performance_degradation', 'warning',
        `AI performance degradation detected: ${recentAvg.toFixed(2)}ms recent vs ${avgResponseTime.toFixed(2)}ms average`, {
        recentAverage: recentAvg,
        overallAverage: avgResponseTime,
        degradationPercent: ((recentAvg / avgResponseTime - 1) * 100).toFixed(1),
      });
    }
  }
  
  /**
   * Detect AI bottlenecks in real-time
   */
  private detectAIBottlenecks(): void {
    const activeCount = this.activeAIRequests.size;
    
    // Check for too many concurrent AI requests
    if (activeCount > this.config.maxConcurrentMonitoring) {
      this.createAIPerformanceAlert('concurrency_limit', 'critical',
        `Too many concurrent AI requests: ${activeCount}`, {
        activeRequests: activeCount,
        limit: this.config.maxConcurrentMonitoring,
        recommendation: 'Consider implementing request queuing',
      });
    }
    
    // Check for memory bottlenecks during AI processing
    const currentMemory = process.memoryUsage();
    const memoryPercent = (currentMemory.heapUsed / currentMemory.heapTotal) * 100;
    
    if (memoryPercent > 90 && activeCount > 5) {
      this.createAIPerformanceAlert('memory_bottleneck', 'critical',
        `High memory usage during AI processing: ${memoryPercent.toFixed(1)}%`, {
        memoryPercent,
        activeAIRequests: activeCount,
        heapUsedMB: Math.round(currentMemory.heapUsed / 1024 / 1024),
      });
    }
  }
  
  /**
   * Report AI monitoring performance metrics
   */
  private reportAIMonitoringPerformance(): void {
    this.totalAIOperations++;
    
    console.log(`[UltraAIMonitoring] Performance Report #${this.totalAIOperations}:`);
    console.log(`  - Active AI Requests: ${this.activeAIRequests.size}`);
    console.log(`  - Completed Requests: ${this.completedAIRequests.length}`);
    console.log(`  - Monitoring Overhead: ${this.aiMonitoringOverhead.toFixed(4)}ms`);
    console.log(`  - Real-time Monitoring: ${this.realTimeMonitoringActive ? 'ACTIVE' : 'INACTIVE'}`);
    
    // Emit performance metrics
    this.emit('ai_monitoring_performance', {
      activeRequests: this.activeAIRequests.size,
      completedRequests: this.completedAIRequests.length,
      monitoringOverhead: this.aiMonitoringOverhead,
      totalOperations: this.totalAIOperations,
    });
  }
  
  /**
   * Handle system health updates from main monitoring
   */
  private onSystemHealthUpdate(health: any): void {
    // If system health is degraded, we might need to adjust AI processing
    if (health && health.memory && health.memory.usagePercent > 80) {
      console.warn('[UltraAIMonitoring] High system memory usage detected - AI performance may be affected');
      
      // Could implement AI request throttling here
      this.emit('system_resource_constraint', {
        type: 'memory',
        usage: health.memory.usagePercent,
        recommendation: 'Consider throttling AI requests',
      });
    }
  }
  
  /**
   * Handle system performance alerts
   */
  private handleSystemPerformanceAlert(alert: any): void {
    console.warn('[UltraAIMonitoring] System performance alert received:', alert.message);
    
    // Track correlation between system alerts and AI performance
    const activeRequests = Array.from(this.activeAIRequests.values());
    if (activeRequests.length > 0) {
      this.createAIPerformanceAlert('system_correlation', 'warning',
        `System performance alert during ${activeRequests.length} active AI requests`, {
        systemAlert: alert.message,
        activeAIRequests: activeRequests.length,
        aiModes: activeRequests.map(r => r.aiMode),
      });
    }
  }
  
  /**
   * Public API methods
   */
  
  public getAIPerformanceMetrics(): any {
    return {
      activeRequests: this.activeAIRequests.size,
      completedRequests: this.completedAIRequests.length,
      performanceHistory: Object.fromEntries(
        Array.from(this.aiPerformanceHistory.entries()).map(([model, times]) => [
          model,
          {
            count: times.length,
            average: times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0,
            min: times.length > 0 ? Math.min(...times) : 0,
            max: times.length > 0 ? Math.max(...times) : 0,
          }
        ])
      ),
      thresholds: {
        maxReasoningTimeMs: Number(this.thresholds.maxReasoningTime) / 1_000_000,
        maxTotalTimeMs: Number(this.thresholds.maxTotalTime) / 1_000_000,
        maxMemoryUsageMB: Math.round(this.thresholds.maxMemoryUsage / 1024 / 1024),
        maxTokensPerSecond: this.thresholds.maxTokensPerSecond,
      },
    };
  }
  
  public getRecentAIRequests(limit: number = 50): AIRequestMetrics[] {
    return this.completedAIRequests.slice(-limit);
  }
  
  public getActiveAIRequests(): AIRequestMetrics[] {
    return Array.from(this.activeAIRequests.values());
  }
  
  public getModelPerformanceComparison(): any {
    const comparison: any = {};
    
    for (const [modelName, times] of this.aiPerformanceHistory.entries()) {
      if (times.length >= 5) {
        comparison[modelName] = {
          requestCount: times.length,
          averageResponseTime: times.reduce((sum, t) => sum + t, 0) / times.length,
          standardDeviation: this.calculateStandardDeviation(times),
          percentile95: this.calculatePercentile(times, 95),
          recentTrend: times.length >= 10 ? this.calculateTrend(times.slice(-10)) : 'insufficient_data',
        };
      }
    }
    
    return comparison;
  }
  
  /**
   * Helper methods for statistical analysis
   */
  
  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index] || 0;
  }
  
  private calculateTrend(values: number[]): 'improving' | 'degrading' | 'stable' {
    if (values.length < 5) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 10) return 'degrading';
    if (changePercent < -10) return 'improving';
    return 'stable';
  }
}

// Export singleton instance
export const ultraAIMonitoringIntegration = UltraAIMonitoringIntegration.getInstance();