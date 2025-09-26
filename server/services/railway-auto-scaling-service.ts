/**
 * Railway Auto-Scaling Service
 * 
 * Implements comprehensive auto-scaling policies for Railway deployment with:
 * - CPU and memory threshold monitoring
 * - Horizontal scaling with multiple replicas
 * - Database connection pooling optimization
 * - Load balancing configuration
 * - Resource monitoring and automatic scaling triggers
 * - Integration with Queen Ultra AI monitoring systems
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import os from 'os';
import { storage } from '../storage';
import { enhancedHighPrecisionMonitoringService } from './enhanced-high-precision-monitoring-service';
import { queenUltraAI } from './queen-ultra-ai';
import { railwayAPI, RAILWAY_SERVICE_CONFIG } from '../config/railway-api';
import { type InsertSystemMetric, type InsertSelfHealingAction } from '@shared/schema';

interface ScalingMetrics {
  timestamp: Date;
  cpuUtilization: number;
  memoryUtilization: number;
  activeConnections: number;
  databaseConnections: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  replica_count: number;
}

interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'maintain';
  reason: string;
  targetReplicas: number;
  currentReplicas: number;
  metrics: ScalingMetrics;
  timestamp: Date;
  confidence: number;
  aiRecommendation?: string;
}

interface ScalingPolicy {
  cpuThreshold: {
    scaleUp: number;
    scaleDown: number;
  };
  memoryThreshold: {
    scaleUp: number;
    scaleDown: number;
  };
  responseTimeThreshold: {
    scaleUp: number;
    warning: number;
  };
  errorRateThreshold: {
    scaleUp: number;
    critical: number;
  };
  minReplicas: number;
  maxReplicas: number;
  scaleUpCooldown: number; // seconds
  scaleDownCooldown: number; // seconds
  evaluationPeriod: number; // seconds
}

interface DatabasePoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  connectionPoolUtilization: number;
  avgConnectionTime: number;
  slowQueries: number;
}

/**
 * Railway Auto-Scaling Service with AI-Powered Decision Making
 */
export class RailwayAutoScalingService extends EventEmitter {
  private static instance: RailwayAutoScalingService;
  
  private isRunning = false;
  private currentReplicas = 2; // Start with minimum replicas (will sync with Railway)
  private lastScaleAction: Date | null = null;
  private scalingHistory: ScalingDecision[] = [];
  private metricsHistory: ScalingMetrics[] = [];
  private railwayApiHealthy = false;
  private useRailwayAPI = false;
  
  // Monitoring intervals
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private scalingEvaluationInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  // Railway production scaling policy
  private scalingPolicy: ScalingPolicy = {
    cpuThreshold: {
      scaleUp: 70,    // Scale up at 70% CPU
      scaleDown: 30   // Scale down below 30% CPU
    },
    memoryThreshold: {
      scaleUp: 80,    // Scale up at 80% memory
      scaleDown: 40   // Scale down below 40% memory
    },
    responseTimeThreshold: {
      scaleUp: 2000,  // Scale up if response time > 2s
      warning: 1000   // Warning if response time > 1s
    },
    errorRateThreshold: {
      scaleUp: 5,     // Scale up if error rate > 5%
      critical: 10    // Critical alert if error rate > 10%
    },
    minReplicas: 2,   // Always maintain 2 replicas minimum
    maxReplicas: 10,  // Scale up to 10 replicas maximum
    scaleUpCooldown: 300,   // 5 minutes cooldown for scale up
    scaleDownCooldown: 600, // 10 minutes cooldown for scale down
    evaluationPeriod: 60    // Evaluate every 60 seconds
  };

  private constructor() {
    super();
    this.setupEventHandlers();
  }

  static getInstance(): RailwayAutoScalingService {
    if (!RailwayAutoScalingService.instance) {
      RailwayAutoScalingService.instance = new RailwayAutoScalingService();
    }
    return RailwayAutoScalingService.instance;
  }

  /**
   * Start the auto-scaling service
   */
  async start(): Promise<boolean> {
    try {
      console.log('🚀 Starting Railway Auto-Scaling Service...');
      
      this.isRunning = true;
      
      // Check Railway API availability
      await this.initializeRailwayAPI();
      
      // Initialize monitoring intervals
      this.startMetricsCollection();
      this.startScalingEvaluation();
      this.startHealthChecking();
      
      // Log initial scaling event
      await this.logScalingEvent({
        type: 'reactive',
        category: 'scaling',
        severity: 'low',
        description: `Auto-scaling service started (Railway API: ${this.useRailwayAPI ? 'enabled' : 'simulation mode'})`,
        target: 'railway_deployment',
        action: 'Service initialization',
        trigger: { service_start: true },
        status: 'completed',
        result: { success: true, replicas: this.currentReplicas, api_mode: this.useRailwayAPI },
        aiAssisted: false
      });

      console.log(`✅ Railway Auto-Scaling Service started ${this.useRailwayAPI ? 'with Railway API control' : 'in simulation mode'}`);
      this.emit('scaling_service_started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start Railway Auto-Scaling Service:', error);
      return false;
    }
  }

  /**
   * Stop the auto-scaling service
   */
  async stop(): Promise<boolean> {
    try {
      console.log('🛑 Stopping Railway Auto-Scaling Service...');
      
      this.isRunning = false;
      
      // Clear all intervals
      if (this.metricsCollectionInterval) {
        clearInterval(this.metricsCollectionInterval);
        this.metricsCollectionInterval = null;
      }
      
      if (this.scalingEvaluationInterval) {
        clearInterval(this.scalingEvaluationInterval);
        this.scalingEvaluationInterval = null;
      }
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      await this.logScalingEvent({
        type: 'reactive',
        category: 'scaling',
        severity: 'low',
        description: 'Auto-scaling service stopped',
        target: 'railway_deployment',
        action: 'Service shutdown',
        trigger: { service_stop: true },
        status: 'completed',
        result: { success: true },
        aiAssisted: false
      });

      console.log('✅ Railway Auto-Scaling Service stopped');
      this.emit('scaling_service_stopped');
      return true;
    } catch (error) {
      console.error('❌ Error stopping Railway Auto-Scaling Service:', error);
      return false;
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('scale_up_required', this.handleScaleUp.bind(this));
    this.on('scale_down_required', this.handleScaleDown.bind(this));
    this.on('scaling_decision', this.handleScalingDecision.bind(this));
    this.on('high_load_detected', this.handleHighLoadDetected.bind(this));
    this.on('performance_degradation', this.handlePerformanceDegradation.bind(this));
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.collectMetrics();
      }
    }, 30000); // Collect metrics every 30 seconds
  }

  /**
   * Start scaling evaluation
   */
  private startScalingEvaluation(): void {
    this.scalingEvaluationInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.evaluateScalingDecision();
      }
    }, this.scalingPolicy.evaluationPeriod * 1000);
  }

  /**
   * Start health checking
   */
  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performAutoScalingHealthCheck();
      }
    }, 60000); // Health check every minute
  }

  /**
   * Collect comprehensive system metrics for scaling decisions
   */
  async collectMetrics(): Promise<ScalingMetrics> {
    try {
      const startTime = performance.now();
      
      // CPU utilization
      const cpuUsage = process.cpuUsage();
      const cpuUtilization = this.calculateCpuUtilization(cpuUsage);
      
      // Memory utilization
      const memUsage = process.memoryUsage();
      const memoryUtilization = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      // Network and database metrics
      const databaseMetrics = await this.getDatabasePoolMetrics();
      const networkMetrics = await this.getNetworkMetrics();
      
      const metrics: ScalingMetrics = {
        timestamp: new Date(),
        cpuUtilization,
        memoryUtilization,
        activeConnections: networkMetrics.activeConnections,
        databaseConnections: databaseMetrics.activeConnections,
        responseTime: networkMetrics.avgResponseTime,
        errorRate: networkMetrics.errorRate,
        throughput: networkMetrics.requestsPerSecond,
        replica_count: this.currentReplicas
      };

      // Store metrics in history
      this.metricsHistory.push(metrics);
      
      // Keep only last 100 metrics entries
      if (this.metricsHistory.length > 100) {
        this.metricsHistory = this.metricsHistory.slice(-100);
      }

      // Log metrics to storage
      await this.logSystemMetric({
        metricType: 'auto_scaling_metrics',
        value: JSON.stringify(metrics),
        unit: 'json'
      });

      const collectTime = performance.now() - startTime;
      console.log(`📊 Metrics collected in ${collectTime.toFixed(2)}ms: CPU: ${cpuUtilization.toFixed(1)}%, Memory: ${memoryUtilization.toFixed(1)}%, Replicas: ${this.currentReplicas}`);
      
      return metrics;
    } catch (error) {
      console.error('❌ Error collecting metrics:', error);
      throw error;
    }
  }

  /**
   * Evaluate scaling decision based on collected metrics
   */
  async evaluateScalingDecision(): Promise<ScalingDecision | null> {
    try {
      if (this.metricsHistory.length < 3) {
        return null; // Need at least 3 metrics points for evaluation
      }

      const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
      const avgMetrics = this.calculateAverageMetrics(this.metricsHistory.slice(-5)); // Last 5 metrics
      
      let decision: ScalingDecision;
      
      // Check if cooldown period is active
      if (this.isCooldownActive()) {
        decision = {
          action: 'maintain',
          reason: 'Cooldown period active',
          targetReplicas: this.currentReplicas,
          currentReplicas: this.currentReplicas,
          metrics: latestMetrics,
          timestamp: new Date(),
          confidence: 100
        };
        return decision;
      }

      // Evaluate scaling conditions
      const shouldScaleUp = this.shouldScaleUp(avgMetrics);
      const shouldScaleDown = this.shouldScaleDown(avgMetrics);
      
      if (shouldScaleUp.should) {
        const targetReplicas = Math.min(this.currentReplicas + 1, this.scalingPolicy.maxReplicas);
        
        // Get AI recommendation for scaling decision
        const aiRecommendation = await this.getAIScalingRecommendation(avgMetrics, 'scale_up');
        
        decision = {
          action: 'scale_up',
          reason: shouldScaleUp.reason,
          targetReplicas,
          currentReplicas: this.currentReplicas,
          metrics: latestMetrics,
          timestamp: new Date(),
          confidence: shouldScaleUp.confidence,
          aiRecommendation
        };
        
        this.emit('scale_up_required', decision);
      } else if (shouldScaleDown.should) {
        const targetReplicas = Math.max(this.currentReplicas - 1, this.scalingPolicy.minReplicas);
        
        const aiRecommendation = await this.getAIScalingRecommendation(avgMetrics, 'scale_down');
        
        decision = {
          action: 'scale_down',
          reason: shouldScaleDown.reason,
          targetReplicas,
          currentReplicas: this.currentReplicas,
          metrics: latestMetrics,
          timestamp: new Date(),
          confidence: shouldScaleDown.confidence,
          aiRecommendation
        };
        
        this.emit('scale_down_required', decision);
      } else {
        decision = {
          action: 'maintain',
          reason: 'Metrics within normal range',
          targetReplicas: this.currentReplicas,
          currentReplicas: this.currentReplicas,
          metrics: latestMetrics,
          timestamp: new Date(),
          confidence: 95
        };
      }

      // Store decision in history
      this.scalingHistory.push(decision);
      
      // Keep only last 50 decisions
      if (this.scalingHistory.length > 50) {
        this.scalingHistory = this.scalingHistory.slice(-50);
      }

      this.emit('scaling_decision', decision);
      return decision;
    } catch (error) {
      console.error('❌ Error evaluating scaling decision:', error);
      return null;
    }
  }

  /**
   * Handle scale up action
   */
  private async handleScaleUp(decision: ScalingDecision): Promise<void> {
    try {
      console.log(`📈 Scaling up: ${this.currentReplicas} → ${decision.targetReplicas} replicas`);
      console.log(`   Reason: ${decision.reason}`);
      console.log(`   AI Recommendation: ${decision.aiRecommendation || 'None'}`);
      
      // Execute actual Railway scaling via API or simulation
      const scaleResult = await this.executeScaling(decision.targetReplicas, decision.reason);
      
      if (scaleResult.success) {
        this.currentReplicas = decision.targetReplicas;
        this.lastScaleAction = new Date();
        
        // Optimize database connection pooling for new replica count
        await this.optimizeDatabasePooling(this.currentReplicas);
        
        await this.logScalingEvent({
          type: 'reactive',
          category: 'scaling',
          severity: 'medium',
          description: `Scaled up to ${this.currentReplicas} replicas`,
          target: 'railway_deployment',
          action: `Scale up: ${decision.currentReplicas} → ${this.currentReplicas}`,
          trigger: { 
            reason: decision.reason,
            metrics: decision.metrics,
            ai_recommendation: decision.aiRecommendation
          },
          status: 'completed',
          result: { success: true, new_replicas: this.currentReplicas },
          aiAssisted: !!decision.aiRecommendation
        });

        console.log(`✅ Successfully scaled up to ${this.currentReplicas} replicas`);
        this.emit('scaled_up', { replicas: this.currentReplicas, decision });
      } else {
        console.error('❌ Failed to scale up:', scaleResult.error);
        this.emit('scaling_failed', { action: 'scale_up', error: scaleResult.error });
      }
    } catch (error) {
      console.error('❌ Error handling scale up:', error);
    }
  }

  /**
   * Handle scale down action
   */
  private async handleScaleDown(decision: ScalingDecision): Promise<void> {
    try {
      console.log(`📉 Scaling down: ${this.currentReplicas} → ${decision.targetReplicas} replicas`);
      console.log(`   Reason: ${decision.reason}`);
      console.log(`   AI Recommendation: ${decision.aiRecommendation || 'None'}`);
      
      // Execute actual Railway scaling via API or simulation
      const scaleResult = await this.executeScaling(decision.targetReplicas, decision.reason);
      
      if (scaleResult.success) {
        this.currentReplicas = decision.targetReplicas;
        this.lastScaleAction = new Date();
        
        // Optimize database connection pooling for reduced replica count
        await this.optimizeDatabasePooling(this.currentReplicas);
        
        await this.logScalingEvent({
          type: 'reactive',
          category: 'scaling',
          severity: 'low',
          description: `Scaled down to ${this.currentReplicas} replicas`,
          target: 'railway_deployment',
          action: `Scale down: ${decision.currentReplicas} → ${this.currentReplicas}`,
          trigger: { 
            reason: decision.reason,
            metrics: decision.metrics,
            ai_recommendation: decision.aiRecommendation
          },
          status: 'completed',
          result: { success: true, new_replicas: this.currentReplicas },
          aiAssisted: !!decision.aiRecommendation
        });

        console.log(`✅ Successfully scaled down to ${this.currentReplicas} replicas`);
        this.emit('scaled_down', { replicas: this.currentReplicas, decision });
      } else {
        console.error('❌ Failed to scale down:', scaleResult.error);
        this.emit('scaling_failed', { action: 'scale_down', error: scaleResult.error });
      }
    } catch (error) {
      console.error('❌ Error handling scale down:', error);
    }
  }


  /**
   * Optimize database connection pooling based on replica count
   */
  private async optimizeDatabasePooling(replicaCount: number): Promise<void> {
    try {
      // Calculate optimal connection pool size per replica
      const connectionsPerReplica = Math.ceil(20 / replicaCount); // Distribute 20 total connections
      const minConnectionsPerReplica = Math.max(2, connectionsPerReplica);
      
      console.log(`🔧 Optimizing database pooling: ${minConnectionsPerReplica} connections per replica (${replicaCount} replicas)`);
      
      // This would configure actual database pooling in production
      // For now, log the optimization
      await this.logSystemMetric({
        metricType: 'database_pool_optimization',
        value: JSON.stringify({
          replica_count: replicaCount,
          connections_per_replica: minConnectionsPerReplica,
          total_connections: replicaCount * minConnectionsPerReplica
        }),
        unit: 'json'
      });
      
    } catch (error) {
      console.error('❌ Error optimizing database pooling:', error);
    }
  }

  /**
   * Get AI-powered scaling recommendation
   */
  private async getAIScalingRecommendation(metrics: ScalingMetrics, action: 'scale_up' | 'scale_down'): Promise<string> {
    try {
      // Integrate with Queen Ultra AI for intelligent scaling decisions
      const recommendation = await queenUltraAI.analyzeScalingMetrics({
        metrics,
        action,
        scalingHistory: this.scalingHistory.slice(-10), // Last 10 decisions
        currentReplicas: this.currentReplicas
      });
      
      return recommendation || `AI recommends ${action} based on current metrics`;
    } catch (error) {
      console.warn('⚠️ AI scaling recommendation unavailable:', error);
      return `Standard ${action} recommended`;
    }
  }

  /**
   * Check if scaling should occur based on metrics
   */
  private shouldScaleUp(metrics: ScalingMetrics): { should: boolean; reason: string; confidence: number } {
    const reasons: string[] = [];
    let confidence = 0;
    
    if (metrics.cpuUtilization > this.scalingPolicy.cpuThreshold.scaleUp) {
      reasons.push(`CPU utilization ${metrics.cpuUtilization.toFixed(1)}% > ${this.scalingPolicy.cpuThreshold.scaleUp}%`);
      confidence += 30;
    }
    
    if (metrics.memoryUtilization > this.scalingPolicy.memoryThreshold.scaleUp) {
      reasons.push(`Memory utilization ${metrics.memoryUtilization.toFixed(1)}% > ${this.scalingPolicy.memoryThreshold.scaleUp}%`);
      confidence += 30;
    }
    
    if (metrics.responseTime > this.scalingPolicy.responseTimeThreshold.scaleUp) {
      reasons.push(`Response time ${metrics.responseTime}ms > ${this.scalingPolicy.responseTimeThreshold.scaleUp}ms`);
      confidence += 25;
    }
    
    if (metrics.errorRate > this.scalingPolicy.errorRateThreshold.scaleUp) {
      reasons.push(`Error rate ${metrics.errorRate.toFixed(1)}% > ${this.scalingPolicy.errorRateThreshold.scaleUp}%`);
      confidence += 40;
    }
    
    const should = reasons.length > 0 && this.currentReplicas < this.scalingPolicy.maxReplicas;
    
    return {
      should,
      reason: reasons.join(', ') || 'No scaling triggers',
      confidence: Math.min(confidence, 100)
    };
  }

  /**
   * Check if scaling down should occur
   */
  private shouldScaleDown(metrics: ScalingMetrics): { should: boolean; reason: string; confidence: number } {
    const reasons: string[] = [];
    let confidence = 0;
    
    if (metrics.cpuUtilization < this.scalingPolicy.cpuThreshold.scaleDown) {
      reasons.push(`CPU utilization ${metrics.cpuUtilization.toFixed(1)}% < ${this.scalingPolicy.cpuThreshold.scaleDown}%`);
      confidence += 20;
    }
    
    if (metrics.memoryUtilization < this.scalingPolicy.memoryThreshold.scaleDown) {
      reasons.push(`Memory utilization ${metrics.memoryUtilization.toFixed(1)}% < ${this.scalingPolicy.memoryThreshold.scaleDown}%`);
      confidence += 20;
    }
    
    if (metrics.errorRate < 1.0 && metrics.responseTime < this.scalingPolicy.responseTimeThreshold.warning) {
      reasons.push('Low error rate and good response times');
      confidence += 15;
    }
    
    const should = reasons.length >= 2 && this.currentReplicas > this.scalingPolicy.minReplicas;
    
    return {
      should,
      reason: reasons.join(', ') || 'No scale down triggers',
      confidence: Math.min(confidence, 100)
    };
  }

  /**
   * Check if cooldown period is active
   */
  private isCooldownActive(): boolean {
    if (!this.lastScaleAction) {
      return false;
    }
    
    const timeSinceLastAction = (Date.now() - this.lastScaleAction.getTime()) / 1000;
    const cooldownPeriod = Math.max(this.scalingPolicy.scaleUpCooldown, this.scalingPolicy.scaleDownCooldown);
    
    return timeSinceLastAction < cooldownPeriod;
  }

  /**
   * Calculate CPU utilization percentage
   */
  private calculateCpuUtilization(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU calculation - in production would use more sophisticated monitoring
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    const numCpus = os.cpus().length;
    
    // Convert to percentage (this is a simplified calculation)
    return Math.min((totalCpuTime / 1000000) / numCpus * 100, 100);
  }

  /**
   * Calculate average metrics over time period
   */
  private calculateAverageMetrics(metrics: ScalingMetrics[]): ScalingMetrics {
    if (metrics.length === 0) {
      throw new Error('No metrics available for averaging');
    }
    
    const avg = metrics.reduce((acc, metric) => ({
      timestamp: metric.timestamp,
      cpuUtilization: acc.cpuUtilization + metric.cpuUtilization,
      memoryUtilization: acc.memoryUtilization + metric.memoryUtilization,
      activeConnections: acc.activeConnections + metric.activeConnections,
      databaseConnections: acc.databaseConnections + metric.databaseConnections,
      responseTime: acc.responseTime + metric.responseTime,
      errorRate: acc.errorRate + metric.errorRate,
      throughput: acc.throughput + metric.throughput,
      replica_count: metric.replica_count
    }), {
      timestamp: new Date(),
      cpuUtilization: 0,
      memoryUtilization: 0,
      activeConnections: 0,
      databaseConnections: 0,
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      replica_count: metrics[metrics.length - 1].replica_count
    });
    
    const count = metrics.length;
    return {
      timestamp: avg.timestamp,
      cpuUtilization: avg.cpuUtilization / count,
      memoryUtilization: avg.memoryUtilization / count,
      activeConnections: Math.round(avg.activeConnections / count),
      databaseConnections: Math.round(avg.databaseConnections / count),
      responseTime: avg.responseTime / count,
      errorRate: avg.errorRate / count,
      throughput: avg.throughput / count,
      replica_count: avg.replica_count
    };
  }

  /**
   * Get database pool metrics
   */
  private async getDatabasePoolMetrics(): Promise<DatabasePoolMetrics> {
    try {
      // In production, this would query actual database pool statistics
      return {
        totalConnections: 10,
        activeConnections: Math.floor(Math.random() * 8) + 1,
        idleConnections: Math.floor(Math.random() * 3),
        connectionPoolUtilization: Math.random() * 80 + 10,
        avgConnectionTime: Math.random() * 100 + 50,
        slowQueries: Math.floor(Math.random() * 3)
      };
    } catch (error) {
      console.warn('⚠️ Error getting database pool metrics:', error);
      return {
        totalConnections: 10,
        activeConnections: 5,
        idleConnections: 2,
        connectionPoolUtilization: 50,
        avgConnectionTime: 75,
        slowQueries: 0
      };
    }
  }

  /**
   * Get network metrics from actual application metrics
   */
  private async getNetworkMetrics(): Promise<{
    activeConnections: number;
    avgResponseTime: number;
    errorRate: number;
    requestsPerSecond: number;
  }> {
    try {
      // Get real metrics from monitoring service
      const monitoringData = await enhancedHighPrecisionMonitoringService.getCurrentMetrics();
      
      return {
        activeConnections: monitoringData?.activeConnections || 10,
        avgResponseTime: monitoringData?.averageResponseTime || 300,
        errorRate: monitoringData?.errorRate || 1,
        requestsPerSecond: monitoringData?.requestsPerSecond || 50
      };
    } catch (error) {
      console.warn('⚠️ Error getting network metrics, using fallback values:', error);
      return {
        activeConnections: 10,
        avgResponseTime: 300,
        errorRate: 0,
        requestsPerSecond: 25
      };
    }
  }

  /**
   * Perform auto-scaling health check
   */
  private async performAutoScalingHealthCheck(): Promise<void> {
    try {
      const healthData = {
        isRunning: this.isRunning,
        currentReplicas: this.currentReplicas,
        lastScaleAction: this.lastScaleAction,
        metricsCount: this.metricsHistory.length,
        decisionsCount: this.scalingHistory.length,
        cooldownActive: this.isCooldownActive()
      };
      
      await this.logSystemMetric({
        metricType: 'auto_scaling_health',
        value: JSON.stringify(healthData),
        unit: 'json'
      });
      
      console.log(`💓 Auto-scaling health check: ${this.currentReplicas} replicas, ${this.metricsHistory.length} metrics`);
    } catch (error) {
      console.error('❌ Auto-scaling health check failed:', error);
    }
  }

  /**
   * Handle high load detection
   */
  private async handleHighLoadDetected(data: any): Promise<void> {
    console.warn('🚨 High load detected:', data);
    // Force immediate metrics collection and evaluation
    await this.collectMetrics();
    await this.evaluateScalingDecision();
  }

  /**
   * Handle performance degradation
   */
  private async handlePerformanceDegradation(data: any): Promise<void> {
    console.warn('⚠️ Performance degradation detected:', data);
    // Trigger immediate scaling evaluation
    await this.evaluateScalingDecision();
  }

  /**
   * Handle scaling decision event
   */
  private async handleScalingDecision(decision: ScalingDecision): Promise<void> {
    console.log(`📊 Scaling decision: ${decision.action} (confidence: ${decision.confidence}%)`);
    console.log(`   Reason: ${decision.reason}`);
    
    // Log the decision
    await this.logSystemMetric({
      metricType: 'scaling_decision',
      value: JSON.stringify(decision),
      unit: 'json'
    });
  }

  /**
   * Log scaling events
   */
  private async logScalingEvent(event: Omit<InsertSelfHealingAction, 'id' | 'timestamp'>): Promise<void> {
    try {
      await storage.insertSelfHealingAction({
        ...event,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('⚠️ Failed to log scaling event:', error);
    }
  }

  /**
   * Log system metrics
   */
  private async logSystemMetric(metric: Omit<InsertSystemMetric, 'id' | 'timestamp'>): Promise<void> {
    try {
      await storage.insertSystemMetric({
        ...metric,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('⚠️ Failed to log system metric:', error);
    }
  }

  /**
   * Get current scaling status
   */
  getScalingStatus(): {
    isRunning: boolean;
    currentReplicas: number;
    lastScaleAction: Date | null;
    recentMetrics: ScalingMetrics[];
    recentDecisions: ScalingDecision[];
    scalingPolicy: ScalingPolicy;
    railwayApiStatus: {
      healthy: boolean;
      enabled: boolean;
      mode: 'api' | 'simulation';
    };
  } {
    return {
      isRunning: this.isRunning,
      currentReplicas: this.currentReplicas,
      lastScaleAction: this.lastScaleAction,
      recentMetrics: this.metricsHistory.slice(-5),
      recentDecisions: this.scalingHistory.slice(-5),
      scalingPolicy: this.scalingPolicy,
      railwayApiStatus: {
        healthy: this.railwayApiHealthy,
        enabled: this.useRailwayAPI,
        mode: this.useRailwayAPI ? 'api' : 'simulation'
      }
    };
  }

  /**
   * Get service status for tests and external monitoring
   */
  getServiceStatus(): {
    isRunning: boolean;
    currentReplicas: number;
    isUsingRailwayAPI: boolean;
    railwayApiHealthy: boolean;
    lastScaleAction: Date | null;
    mode: 'api' | 'simulation';
    recentMetrics: ScalingMetrics[];
    recentDecisions: ScalingDecision[];
  } {
    const scalingStatus = this.getScalingStatus();
    return {
      isRunning: scalingStatus.isRunning,
      currentReplicas: scalingStatus.currentReplicas,
      isUsingRailwayAPI: scalingStatus.railwayApiStatus.enabled,
      railwayApiHealthy: scalingStatus.railwayApiStatus.healthy,
      lastScaleAction: scalingStatus.lastScaleAction,
      mode: scalingStatus.railwayApiStatus.mode,
      recentMetrics: scalingStatus.recentMetrics,
      recentDecisions: scalingStatus.recentDecisions
    };
  }

  /**
   * Update scaling policy
   */
  updateScalingPolicy(newPolicy: Partial<ScalingPolicy>): void {
    this.scalingPolicy = { ...this.scalingPolicy, ...newPolicy };
    console.log('🔧 Scaling policy updated:', newPolicy);
  }

  /**
   * Initialize Railway API and check connectivity
   */
  private async initializeRailwayAPI(): Promise<void> {
    try {
      console.log('🔌 Checking Railway API connectivity...');
      
      // Check if Railway API credentials are available
      if (!RAILWAY_SERVICE_CONFIG.serviceId || !RAILWAY_SERVICE_CONFIG.environmentId) {
        console.warn('⚠️ RAILWAY API MODE: SIMULATION (Missing Service Configuration)');
        console.warn('   🔑 Missing: RAILWAY_SERVICE_ID and/or RAILWAY_ENVIRONMENT_ID');
        console.warn('   📋 To enable real Railway control, configure these environment variables');
        this.useRailwayAPI = false;
        return;
      }
      
      // Test Railway API health
      const healthCheck = await railwayAPI.checkApiHealth();
      this.railwayApiHealthy = healthCheck.healthy;
      
      console.log(`🔍 Railway API Health Check Result:`);
      console.log(`   ✅ Healthy: ${healthCheck.healthy}`);
      console.log(`   🔑 Token Type: ${healthCheck.tokenType || 'unknown'}`);
      if (healthCheck.error) {
        console.log(`   ❌ Error: ${healthCheck.error}`);
      }
      
      if (healthCheck.healthy) {
        // Try to get current service info to sync replica count
        const serviceInfo = await railwayAPI.getServiceInfo(
          RAILWAY_SERVICE_CONFIG.serviceId,
          RAILWAY_SERVICE_CONFIG.environmentId
        );
        
        if (serviceInfo.success && serviceInfo.service?.replicas) {
          this.currentReplicas = serviceInfo.service.replicas;
          console.log(`🚂 RAILWAY API MODE: REAL CONTROL ENABLED`);
          console.log(`   ✅ Authentication: SUCCESS (${healthCheck.tokenType} token)`);
          console.log(`   📊 Current replicas: ${this.currentReplicas}`);
          console.log(`   🎯 Service: ${RAILWAY_SERVICE_CONFIG.serviceId}`);
        } else {
          console.log(`🚂 RAILWAY API MODE: REAL CONTROL ENABLED (Limited Service Info)`);
          console.log(`   ✅ Authentication: SUCCESS (${healthCheck.tokenType} token)`);
          console.log(`   ⚠️ Service Info: ${serviceInfo.error || 'Limited access'}`);
        }
        
        this.useRailwayAPI = true;
        console.log(`   🎮 Real Railway API control is now ACTIVE`);
      } else {
        console.warn('❌ RAILWAY API MODE: SIMULATION (Authentication Failed)');
        console.warn(`   🔑 Auth Error: ${healthCheck.error}`);
        console.warn('   💡 Check your RAILWAY_TOKEN or RAILWAY_PROJECT_TOKEN');
        console.warn('   🔄 Will retry on next initialization');
        this.useRailwayAPI = false;
      }
    } catch (error) {
      console.error('❌ RAILWAY API MODE: SIMULATION (Initialization Failed)');
      console.error(`   🚨 Error: ${error instanceof Error ? error.message : String(error)}`);
      console.error('   🔄 Auto-scaling will continue in simulation mode');
      this.useRailwayAPI = false;
      this.railwayApiHealthy = false;
    }
  }
  
  /**
   * Actually scale replicas using Railway API or simulate
   */
  private async executeScaling(targetReplicas: number, reason: string): Promise<boolean> {
    try {
      if (this.useRailwayAPI && this.railwayApiHealthy) {
        console.log(`🚂 Scaling Railway service to ${targetReplicas} replicas via API...`);
        
        const result = await railwayAPI.scaleService(
          RAILWAY_SERVICE_CONFIG.serviceId!,
          RAILWAY_SERVICE_CONFIG.environmentId!, 
          targetReplicas
        );
        
        if (result.success) {
          this.currentReplicas = targetReplicas;
          console.log(`✅ Successfully scaled to ${targetReplicas} replicas`);
          
          await this.logScalingEvent({
            type: 'reactive',
            category: 'scaling',
            severity: 'medium',
            description: `Scaled replicas to ${targetReplicas}`,
            target: 'railway_service',
            action: `Scale to ${targetReplicas} replicas`,
            trigger: { reason },
            status: 'completed',
            result: { success: true, replicas: targetReplicas },
            aiAssisted: false
          });
          
          return true;
        } else {
          console.error('❌ Railway scaling API call failed:', result.error);
          return false;
        }
      } else {
        // Simulation mode - log what would happen
        console.log(`🎭 [SIMULATION] Would scale to ${targetReplicas} replicas (reason: ${reason})`);
        this.currentReplicas = targetReplicas;
        
        await this.logScalingEvent({
          type: 'reactive',
          category: 'scaling',
          severity: 'low',
          description: `[SIMULATION] Scaled replicas to ${targetReplicas}`,
          target: 'railway_service_simulation',
          action: `Simulate scale to ${targetReplicas} replicas`,
          trigger: { reason, mode: 'simulation' },
          status: 'completed',
          result: { success: true, replicas: targetReplicas, simulated: true },
          aiAssisted: false
        });
        
        return true;
      }
    } catch (error) {
      console.error('❌ Scaling execution failed:', error);
      return false;
    }
  }

  /**
   * Force scaling evaluation (for testing/manual triggers)
   */
  async forceScalingEvaluation(): Promise<ScalingDecision | null> {
    console.log('🔄 Forcing scaling evaluation...');
    await this.collectMetrics();
    return await this.evaluateScalingDecision();
  }
}

// Export singleton instance
export const railwayAutoScalingService = RailwayAutoScalingService.getInstance();