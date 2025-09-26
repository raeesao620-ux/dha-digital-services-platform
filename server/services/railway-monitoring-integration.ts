/**
 * Railway Monitoring Integration with Queen Ultra AI
 * 
 * Integrates Railway monitoring with Queen Ultra AI systems and provides:
 * - Real-time alerting and notifications
 * - AI-powered incident analysis and response
 * - Automated monitoring dashboards
 * - Integration with existing self-healing systems
 * - Government-grade compliance monitoring
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { storage } from '../storage';
import { railwayHealthCheckSystem } from './railway-health-check-system';
import { railwayAutoScalingService } from './railway-auto-scaling-service';
import { circuitBreakerSystem } from './circuit-breaker-system';
import { enhancedDatabasePooling } from './enhanced-database-pooling';
import { zeroDowntimeDeployment } from './zero-downtime-deployment';
import { queenUltraAI } from './queen-ultra-ai';
import { selfHealingService } from './self-healing-service';
import { enhancedHighPrecisionMonitoringService } from './enhanced-high-precision-monitoring-service';
import { type InsertSystemMetric, type InsertSecurityEvent, type InsertSelfHealingAction } from '@shared/schema';

interface MonitoringAlert {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'scaling' | 'health' | 'performance' | 'security' | 'deployment';
  title: string;
  description: string;
  source: string;
  metrics: any;
  actions_taken: string[];
  resolution_status: 'open' | 'in_progress' | 'resolved' | 'acknowledged';
  ai_analysis?: string;
  recommended_actions?: string[];
}

interface RailwayDashboardData {
  timestamp: Date;
  overall_status: 'healthy' | 'degraded' | 'critical';
  systems: {
    auto_scaling: any;
    health_checks: any;
    circuit_breakers: any;
    database_pooling: any;
    deployment: any;
  };
  metrics: {
    uptime_percentage: number;
    response_time: number;
    error_rate: number;
    throughput: number;
    resource_utilization: number;
  };
  alerts: MonitoringAlert[];
  ai_insights: string[];
  compliance_status: {
    security_compliant: boolean;
    performance_compliant: boolean;
    availability_compliant: boolean;
    audit_trail_complete: boolean;
  };
}

interface IncidentResponse {
  incident_id: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affected_systems: string[];
  auto_response_triggered: boolean;
  manual_intervention_required: boolean;
  estimated_resolution_time: number;
  status: 'detecting' | 'responding' | 'recovering' | 'resolved';
  actions: IncidentAction[];
}

interface IncidentAction {
  action_type: 'scaling' | 'failover' | 'circuit_break' | 'restart' | 'notification';
  description: string;
  timestamp: Date;
  success: boolean;
  result: any;
}

/**
 * Railway Monitoring Integration System
 */
export class RailwayMonitoringIntegration extends EventEmitter {
  private static instance: RailwayMonitoringIntegration;
  
  private isRunning = false;
  private alerts: MonitoringAlert[] = [];
  private incidents: IncidentResponse[] = [];
  private dashboardData: RailwayDashboardData | null = null;
  
  // Monitoring intervals
  private alertProcessingInterval: NodeJS.Timeout | null = null;
  private dashboardUpdateInterval: NodeJS.Timeout | null = null;
  private complianceCheckInterval: NodeJS.Timeout | null = null;
  private aiAnalysisInterval: NodeJS.Timeout | null = null;

  private alertThresholds = {
    critical_response_time: 5000, // 5 seconds
    high_error_rate: 5, // 5%
    low_uptime: 99.9, // 99.9%
    critical_memory_usage: 90, // 90%
    critical_cpu_usage: 85, // 85%
    circuit_breaker_threshold: 3 // 3 open circuits
  };

  private constructor() {
    super();
    this.setupEventHandlers();
  }

  static getInstance(): RailwayMonitoringIntegration {
    if (!RailwayMonitoringIntegration.instance) {
      RailwayMonitoringIntegration.instance = new RailwayMonitoringIntegration();
    }
    return RailwayMonitoringIntegration.instance;
  }

  /**
   * Start the Railway monitoring integration
   */
  async start(): Promise<boolean> {
    try {
      console.log('📊 Starting Railway Monitoring Integration...');
      
      this.isRunning = true;
      
      // Subscribe to all Railway system events
      this.subscribeToSystemEvents();
      
      // Start monitoring intervals
      this.startAlertProcessing();
      this.startDashboardUpdates();
      this.startComplianceChecking();
      this.startAIAnalysis();
      
      // Perform initial system assessment
      await this.performInitialAssessment();
      
      await this.logMonitoringEvent({
        type: 'reactive',
        category: 'monitoring',
        severity: 'low',
        description: 'Railway monitoring integration started',
        target: 'monitoring_system',
        action: 'System initialization',
        trigger: { system_start: true },
        status: 'completed',
        result: { success: true },
        aiAssisted: false
      });

      console.log('✅ Railway Monitoring Integration started successfully');
      this.emit('monitoring_integration_started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start Railway Monitoring Integration:', error);
      return false;
    }
  }

  /**
   * Stop the monitoring integration
   */
  async stop(): Promise<boolean> {
    try {
      console.log('🛑 Stopping Railway Monitoring Integration...');
      
      this.isRunning = false;
      
      // Clear intervals
      if (this.alertProcessingInterval) {
        clearInterval(this.alertProcessingInterval);
        this.alertProcessingInterval = null;
      }
      
      if (this.dashboardUpdateInterval) {
        clearInterval(this.dashboardUpdateInterval);
        this.dashboardUpdateInterval = null;
      }
      
      if (this.complianceCheckInterval) {
        clearInterval(this.complianceCheckInterval);
        this.complianceCheckInterval = null;
      }
      
      if (this.aiAnalysisInterval) {
        clearInterval(this.aiAnalysisInterval);
        this.aiAnalysisInterval = null;
      }

      console.log('✅ Railway Monitoring Integration stopped');
      this.emit('monitoring_integration_stopped');
      return true;
    } catch (error) {
      console.error('❌ Error stopping Railway Monitoring Integration:', error);
      return false;
    }
  }

  /**
   * Setup event handlers for all Railway systems
   */
  private setupEventHandlers(): void {
    this.on('critical_alert', this.handleCriticalAlert.bind(this));
    this.on('system_degradation', this.handleSystemDegradation.bind(this));
    this.on('incident_detected', this.handleIncidentDetected.bind(this));
    this.on('compliance_violation', this.handleComplianceViolation.bind(this));
  }

  /**
   * Subscribe to events from all Railway systems
   */
  private subscribeToSystemEvents(): void {
    // Auto-scaling events
    railwayAutoScalingService.on('scaled_up', (data) => this.handleScalingEvent('scale_up', data));
    railwayAutoScalingService.on('scaled_down', (data) => this.handleScalingEvent('scale_down', data));
    railwayAutoScalingService.on('scaling_failed', (data) => this.handleScalingFailure(data));

    // Health check events
    railwayHealthCheckSystem.on('service_unhealthy', (data) => this.handleHealthIssue(data));
    railwayHealthCheckSystem.on('probe_failed', (data) => this.handleProbeFailure(data));
    railwayHealthCheckSystem.on('recovery_needed', (data) => this.handleRecoveryNeeded(data));

    // Circuit breaker events
    circuitBreakerSystem.on('circuit_opened', (data) => this.handleCircuitBreakerEvent('opened', data));
    circuitBreakerSystem.on('circuit_closed', (data) => this.handleCircuitBreakerEvent('closed', data));
    circuitBreakerSystem.on('fallback_activated', (data) => this.handleFallbackActivated(data));

    // Database pooling events
    enhancedDatabasePooling.on('pool_optimization_needed', (data) => this.handlePoolOptimization(data));
    enhancedDatabasePooling.on('connection_pool_exhausted', (data) => this.handlePoolExhaustion(data));

    // Deployment events
    zeroDowntimeDeployment.on('deployment_started', (data) => this.handleDeploymentEvent('started', data));
    zeroDowntimeDeployment.on('deployment_completed', (data) => this.handleDeploymentEvent('completed', data));
    zeroDowntimeDeployment.on('deployment_failed', (data) => this.handleDeploymentEvent('failed', data));
    zeroDowntimeDeployment.on('rollback_triggered', (data) => this.handleRollbackEvent(data));

    console.log('📡 Subscribed to all Railway system events');
  }

  /**
   * Start alert processing
   */
  private startAlertProcessing(): void {
    this.alertProcessingInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.processAlerts();
      }
    }, 30000); // Process alerts every 30 seconds
  }

  /**
   * Start dashboard updates
   */
  private startDashboardUpdates(): void {
    this.dashboardUpdateInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.updateDashboard();
      }
    }, 60000); // Update dashboard every minute
  }

  /**
   * Start compliance checking
   */
  private startComplianceChecking(): void {
    this.complianceCheckInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.checkCompliance();
      }
    }, 300000); // Check compliance every 5 minutes
  }

  /**
   * Start AI analysis
   */
  private startAIAnalysis(): void {
    this.aiAnalysisInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performAIAnalysis();
      }
    }, 120000); // AI analysis every 2 minutes
  }

  /**
   * Perform initial system assessment
   */
  private async performInitialAssessment(): Promise<void> {
    try {
      console.log('🔍 Performing initial Railway system assessment...');
      
      // Get status from all systems
      const healthStatus = railwayHealthCheckSystem.getOverallHealthStatus();
      const scalingStatus = railwayAutoScalingService.getScalingStatus();
      const circuitStatus = circuitBreakerSystem.getSystemStatus();
      const poolStatus = enhancedDatabasePooling.getPoolStatus();
      
      // Create initial alerts if needed
      if (healthStatus.status !== 'healthy') {
        await this.createAlert({
          severity: healthStatus.status === 'critical' ? 'critical' : 'high',
          category: 'health',
          title: 'System Health Issue Detected',
          description: `Overall health status: ${healthStatus.status}`,
          source: 'health_check_system',
          metrics: { health_status: healthStatus }
        });
      }
      
      if (circuitStatus.critical_services > 0) {
        await this.createAlert({
          severity: 'high',
          category: 'performance',
          title: 'Circuit Breakers Open',
          description: `${circuitStatus.critical_services} circuit breakers are open`,
          source: 'circuit_breaker_system',
          metrics: { circuit_status: circuitStatus }
        });
      }
      
      console.log('✅ Initial system assessment completed');
      
    } catch (error) {
      console.error('❌ Error performing initial assessment:', error);
    }
  }

  /**
   * Process and analyze alerts
   */
  private async processAlerts(): Promise<void> {
    try {
      // Get new alerts from all systems
      await this.collectSystemAlerts();
      
      // Process unresolved alerts
      const unresolvedAlerts = this.alerts.filter(a => a.resolution_status === 'open');
      
      for (const alert of unresolvedAlerts) {
        await this.processAlert(alert);
      }
      
      // Clean up old resolved alerts
      this.cleanupOldAlerts();
      
    } catch (error) {
      console.error('❌ Error processing alerts:', error);
    }
  }

  /**
   * Collect alerts from all systems
   */
  private async collectSystemAlerts(): Promise<void> {
    try {
      // Check system metrics against thresholds
      const healthStatus = railwayHealthCheckSystem.getOverallHealthStatus();
      const scalingStatus = railwayAutoScalingService.getScalingStatus();
      const circuitStatus = circuitBreakerSystem.getSystemStatus();
      const poolStatus = enhancedDatabasePooling.getPoolStatus();
      
      // Check for critical conditions
      if (healthStatus.status === 'critical') {
        await this.createAlert({
          severity: 'critical',
          category: 'health',
          title: 'Critical System Health',
          description: 'System health is critical - immediate attention required',
          source: 'health_monitoring',
          metrics: { health_status: healthStatus }
        });
      }
      
      if (circuitStatus.critical_services >= this.alertThresholds.circuit_breaker_threshold) {
        await this.createAlert({
          severity: 'high',
          category: 'performance',
          title: 'Multiple Circuit Breakers Open',
          description: `${circuitStatus.critical_services} circuit breakers are open`,
          source: 'circuit_breaker_monitoring',
          metrics: { circuit_status: circuitStatus }
        });
      }
      
      if (poolStatus.metrics.average_utilization > 90) {
        await this.createAlert({
          severity: 'medium',
          category: 'performance',
          title: 'High Database Pool Utilization',
          description: `Database pool utilization at ${poolStatus.metrics.average_utilization.toFixed(1)}%`,
          source: 'database_monitoring',
          metrics: { pool_status: poolStatus }
        });
      }
      
    } catch (error) {
      console.error('❌ Error collecting system alerts:', error);
    }
  }

  /**
   * Process individual alert
   */
  private async processAlert(alert: MonitoringAlert): Promise<void> {
    try {
      console.log(`🚨 Processing alert: ${alert.title} (${alert.severity})`);
      
      alert.resolution_status = 'in_progress';
      
      // Get AI analysis for the alert
      const aiAnalysis = await this.getAIAnalysis(alert);
      alert.ai_analysis = aiAnalysis.analysis;
      alert.recommended_actions = aiAnalysis.recommendations;
      
      // Take automatic actions based on severity and type
      if (alert.severity === 'critical') {
        await this.handleCriticalAlert({ alert });
      }
      
      // Integrate with self-healing system
      if (selfHealingService && alert.recommended_actions) {
        for (const action of alert.recommended_actions) {
          try {
            await selfHealingService.executeHealingAction(action, alert.metrics);
            alert.actions_taken.push(action);
          } catch (error) {
            console.warn(`⚠️ Failed to execute healing action: ${action}`, error);
          }
        }
      }
      
      // Log alert processing
      await this.logSystemMetric({
        metricType: 'alert_processed',
        value: JSON.stringify({
          alert_id: alert.id,
          severity: alert.severity,
          actions_taken: alert.actions_taken,
          ai_analysis: !!alert.ai_analysis
        }),
        unit: 'json'
      });
      
    } catch (error) {
      console.error('❌ Error processing alert:', error);
    }
  }

  /**
   * Update monitoring dashboard
   */
  private async updateDashboard(): Promise<void> {
    try {
      const healthStatus = railwayHealthCheckSystem.getOverallHealthStatus();
      const scalingStatus = railwayAutoScalingService.getScalingStatus();
      const circuitStatus = circuitBreakerSystem.getSystemStatus();
      const poolStatus = enhancedDatabasePooling.getPoolStatus();
      const deploymentStats = zeroDowntimeDeployment.getDeploymentStatistics();
      
      // Calculate system metrics
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      // Generate AI insights
      const aiInsights = await this.generateAIInsights({
        health: healthStatus,
        scaling: scalingStatus,
        circuits: circuitStatus,
        database: poolStatus,
        deployment: deploymentStats
      });
      
      this.dashboardData = {
        timestamp: new Date(),
        overall_status: healthStatus.status,
        systems: {
          auto_scaling: {
            status: scalingStatus.isRunning ? 'running' : 'stopped',
            current_replicas: scalingStatus.currentReplicas,
            recent_decisions: scalingStatus.recentDecisions.length
          },
          health_checks: {
            status: healthStatus.status,
            healthy_services: healthStatus.services.filter(s => s.overall_status === 'healthy').length,
            total_services: healthStatus.services.length
          },
          circuit_breakers: {
            status: circuitStatus.critical_services === 0 ? 'healthy' : 'degraded',
            total_services: circuitStatus.total_services,
            open_circuits: circuitStatus.circuits_open
          },
          database_pooling: {
            status: poolStatus.isRunning ? 'running' : 'stopped',
            utilization: poolStatus.metrics.average_utilization,
            pool_size: poolStatus.config.maxConnections
          },
          deployment: {
            status: deploymentStats.success_rate > 90 ? 'stable' : 'unstable',
            success_rate: deploymentStats.success_rate,
            recent_deployments: deploymentStats.total_deployments
          }
        },
        metrics: {
          uptime_percentage: Math.min((uptime / 86400) * 100, 100), // Last 24 hours
          response_time: healthStatus.services.reduce((acc, s) => acc + (s.checks[0]?.responseTime || 0), 0) / healthStatus.services.length,
          error_rate: circuitStatus.critical_services / circuitStatus.total_services * 100,
          throughput: scalingStatus.recentMetrics.reduce((acc, m) => acc + m.throughput, 0) / Math.max(scalingStatus.recentMetrics.length, 1),
          resource_utilization: memUsagePercent
        },
        alerts: this.alerts.filter(a => a.resolution_status !== 'resolved'),
        ai_insights: aiInsights,
        compliance_status: await this.checkComplianceStatus()
      };
      
      // Log dashboard update
      await this.logSystemMetric({
        metricType: 'dashboard_update',
        value: JSON.stringify({
          overall_status: this.dashboardData.overall_status,
          active_alerts: this.dashboardData.alerts.length,
          ai_insights_count: this.dashboardData.ai_insights.length
        }),
        unit: 'json'
      });
      
      console.log(`📊 Dashboard updated: ${this.dashboardData.overall_status} status, ${this.dashboardData.alerts.length} active alerts`);
      
    } catch (error) {
      console.error('❌ Error updating dashboard:', error);
    }
  }

  /**
   * Check compliance status
   */
  private async checkCompliance(): Promise<void> {
    try {
      const complianceStatus = await this.checkComplianceStatus();
      
      // Check for compliance violations
      if (!complianceStatus.security_compliant) {
        await this.createAlert({
          severity: 'high',
          category: 'security',
          title: 'Security Compliance Violation',
          description: 'System is not meeting security compliance requirements',
          source: 'compliance_monitoring',
          metrics: { compliance_status: complianceStatus }
        });
        
        this.emit('compliance_violation', { type: 'security', status: complianceStatus });
      }
      
      if (!complianceStatus.availability_compliant) {
        await this.createAlert({
          severity: 'medium',
          category: 'performance',
          title: 'Availability Compliance Issue',
          description: 'System availability is below compliance requirements',
          source: 'compliance_monitoring',
          metrics: { compliance_status: complianceStatus }
        });
        
        this.emit('compliance_violation', { type: 'availability', status: complianceStatus });
      }
      
      console.log(`📋 Compliance check completed: ${JSON.stringify(complianceStatus)}`);
      
    } catch (error) {
      console.error('❌ Error checking compliance:', error);
    }
  }

  /**
   * Check compliance status
   */
  private async checkComplianceStatus(): Promise<{
    security_compliant: boolean;
    performance_compliant: boolean;
    availability_compliant: boolean;
    audit_trail_complete: boolean;
  }> {
    try {
      const healthStatus = railwayHealthCheckSystem.getOverallHealthStatus();
      const uptime = process.uptime();
      const uptimePercentage = Math.min((uptime / 86400) * 100, 100);
      
      return {
        security_compliant: healthStatus.services.every(s => 
          s.service !== 'security_system' || s.overall_status === 'healthy'
        ),
        performance_compliant: healthStatus.services.filter(s => 
          s.overall_status === 'healthy'
        ).length / healthStatus.services.length >= 0.9,
        availability_compliant: uptimePercentage >= 99.9,
        audit_trail_complete: true // Simplified check
      };
    } catch (error) {
      return {
        security_compliant: false,
        performance_compliant: false,
        availability_compliant: false,
        audit_trail_complete: false
      };
    }
  }

  /**
   * Perform AI analysis on system state
   */
  private async performAIAnalysis(): Promise<void> {
    try {
      if (!this.dashboardData) return;
      
      // Analyze system patterns and trends
      const analysis = await queenUltraAI.analyzeSystemMetrics({
        dashboard_data: this.dashboardData,
        recent_alerts: this.alerts.slice(-10),
        system_trends: {
          scaling_patterns: railwayAutoScalingService.getScalingStatus().recentDecisions,
          health_trends: railwayHealthCheckSystem.getOverallHealthStatus(),
          circuit_patterns: circuitBreakerSystem.getAllCircuitBreakerStatuses()
        }
      });
      
      // Create proactive alerts based on AI analysis
      if (analysis.risk_factors && analysis.risk_factors.length > 0) {
        for (const risk of analysis.risk_factors) {
          await this.createAlert({
            severity: risk.severity,
            category: 'performance',
            title: `AI Detected Risk: ${risk.title}`,
            description: risk.description,
            source: 'ai_analysis',
            metrics: { ai_analysis: analysis }
          });
        }
      }
      
      console.log(`🤖 AI analysis completed: ${analysis.insights?.length || 0} insights generated`);
      
    } catch (error) {
      console.error('❌ Error performing AI analysis:', error);
    }
  }

  /**
   * Event handlers
   */
  private async handleScalingEvent(type: string, data: any): Promise<void> {
    await this.createAlert({
      severity: 'low',
      category: 'scaling',
      title: `Auto-scaling ${type}`,
      description: `System ${type} to ${data.replicas} replicas`,
      source: 'auto_scaling',
      metrics: data
    });
  }

  private async handleScalingFailure(data: any): Promise<void> {
    await this.createAlert({
      severity: 'high',
      category: 'scaling',
      title: 'Auto-scaling Failed',
      description: `Auto-scaling operation failed: ${data.error}`,
      source: 'auto_scaling',
      metrics: data
    });
  }

  private async handleHealthIssue(data: any): Promise<void> {
    await this.createAlert({
      severity: data.result.status === 'critical' ? 'critical' : 'medium',
      category: 'health',
      title: `Service Health Issue: ${data.service}`,
      description: `Service ${data.service} is ${data.result.status}`,
      source: 'health_monitoring',
      metrics: data
    });
  }

  private async handleProbeFailure(data: any): Promise<void> {
    await this.createAlert({
      severity: data.type === 'liveness' ? 'critical' : 'medium',
      category: 'health',
      title: `${data.type} Probe Failed`,
      description: `${data.type} probe failed for ${data.probe}`,
      source: 'health_monitoring',
      metrics: data
    });
  }

  private async handleRecoveryNeeded(data: any): Promise<void> {
    await this.createAlert({
      severity: 'medium',
      category: 'health',
      title: 'Service Recovery Needed',
      description: `Service ${data.service} requires recovery action: ${data.action}`,
      source: 'health_monitoring',
      metrics: data
    });
  }

  private async handleCircuitBreakerEvent(type: string, data: any): Promise<void> {
    await this.createAlert({
      severity: type === 'opened' ? 'high' : 'low',
      category: 'performance',
      title: `Circuit Breaker ${type}`,
      description: `Circuit breaker ${type} for ${data.serviceName}`,
      source: 'circuit_breaker',
      metrics: data
    });
  }

  private async handleFallbackActivated(data: any): Promise<void> {
    await this.createAlert({
      severity: 'medium',
      category: 'performance',
      title: 'Fallback Activated',
      description: `Fallback activated for ${data.serviceName}: ${data.strategy}`,
      source: 'circuit_breaker',
      metrics: data
    });
  }

  private async handlePoolOptimization(data: any): Promise<void> {
    await this.createAlert({
      severity: 'low',
      category: 'performance',
      title: 'Database Pool Optimization',
      description: `Database pool optimization needed: ${data.reason}`,
      source: 'database_pooling',
      metrics: data
    });
  }

  private async handlePoolExhaustion(data: any): Promise<void> {
    await this.createAlert({
      severity: 'high',
      category: 'performance',
      title: 'Database Pool Exhausted',
      description: `Database connection pool exhausted: ${data.utilization.toFixed(1)}% utilization`,
      source: 'database_pooling',
      metrics: data
    });
  }

  private async handleDeploymentEvent(type: string, data: any): Promise<void> {
    const severity = type === 'failed' ? 'high' : 'low';
    await this.createAlert({
      severity,
      category: 'deployment',
      title: `Deployment ${type}`,
      description: `Deployment ${data.deployment.id} ${type}`,
      source: 'zero_downtime_deployment',
      metrics: data
    });
  }

  private async handleRollbackEvent(data: any): Promise<void> {
    await this.createAlert({
      severity: 'high',
      category: 'deployment',
      title: 'Deployment Rollback',
      description: `Automatic rollback triggered for deployment ${data.deployment.id}`,
      source: 'zero_downtime_deployment',
      metrics: data
    });
  }

  private async handleCriticalAlert(data: { alert: MonitoringAlert }): Promise<void> {
    console.error(`🚨 CRITICAL ALERT: ${data.alert.title}`);
    
    // Trigger incident response
    const incident = await this.createIncident(data.alert);
    
    // Notify Queen Ultra AI for intelligent response
    try {
      await queenUltraAI.handleCriticalIncident({
        alert: data.alert,
        incident,
        system_state: this.dashboardData
      });
    } catch (error) {
      console.warn('⚠️ AI incident response failed:', error);
    }
    
    // Log critical alert
    await this.logMonitoringEvent({
      type: 'reactive',
      category: 'alert',
      severity: 'critical',
      description: `Critical alert: ${data.alert.title}`,
      target: data.alert.source,
      action: 'Critical alert processing',
      trigger: { alert: data.alert },
      status: 'in_progress',
      result: { incident_created: true },
      aiAssisted: true
    });
  }

  /**
   * Create monitoring alert
   */
  private async createAlert(alertData: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    source: string;
    metrics: any;
  }): Promise<MonitoringAlert> {
    const alert: MonitoringAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...alertData,
      actions_taken: [],
      resolution_status: 'open'
    };
    
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    console.log(`📢 Alert created: ${alert.title} (${alert.severity})`);
    this.emit('alert_created', { alert });
    
    return alert;
  }

  /**
   * Create incident response
   */
  private async createIncident(alert: MonitoringAlert): Promise<IncidentResponse> {
    const incident: IncidentResponse = {
      incident_id: `incident-${Date.now()}`,
      timestamp: new Date(),
      severity: alert.severity,
      description: alert.description,
      affected_systems: [alert.source],
      auto_response_triggered: true,
      manual_intervention_required: alert.severity === 'critical',
      estimated_resolution_time: this.getEstimatedResolutionTime(alert.severity),
      status: 'detecting',
      actions: []
    };
    
    this.incidents.push(incident);
    
    // Keep only last 50 incidents
    if (this.incidents.length > 50) {
      this.incidents = this.incidents.slice(-50);
    }
    
    this.emit('incident_detected', { incident });
    return incident;
  }

  /**
   * Get AI analysis for alert
   */
  private async getAIAnalysis(alert: MonitoringAlert): Promise<{
    analysis: string;
    recommendations: string[];
  }> {
    try {
      const analysis = await queenUltraAI.analyzeAlert({
        alert,
        system_context: this.dashboardData,
        historical_patterns: this.alerts.slice(-20)
      });
      
      return {
        analysis: analysis.summary || 'AI analysis completed',
        recommendations: analysis.recommendations || []
      };
    } catch (error) {
      return {
        analysis: 'AI analysis unavailable',
        recommendations: ['Manual investigation required']
      };
    }
  }

  /**
   * Generate AI insights
   */
  private async generateAIInsights(systemData: any): Promise<string[]> {
    try {
      const insights = await queenUltraAI.generateSystemInsights(systemData);
      return insights || [];
    } catch (error) {
      return ['AI insights unavailable'];
    }
  }

  /**
   * Get estimated resolution time
   */
  private getEstimatedResolutionTime(severity: string): number {
    switch (severity) {
      case 'critical': return 15; // 15 minutes
      case 'high': return 60; // 1 hour
      case 'medium': return 240; // 4 hours
      case 'low': return 1440; // 24 hours
      default: return 60;
    }
  }

  /**
   * Cleanup old alerts
   */
  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    this.alerts = this.alerts.filter(alert => 
      alert.timestamp.getTime() > cutoffTime || 
      alert.resolution_status !== 'resolved'
    );
  }

  /**
   * Get current monitoring data
   */
  getCurrentMonitoringData(): {
    dashboard: RailwayDashboardData | null;
    alerts: MonitoringAlert[];
    incidents: IncidentResponse[];
    system_status: string;
  } {
    return {
      dashboard: this.dashboardData,
      alerts: this.alerts,
      incidents: this.incidents,
      system_status: this.dashboardData?.overall_status || 'unknown'
    };
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStatistics(): {
    total_alerts: number;
    critical_alerts: number;
    resolved_alerts: number;
    active_incidents: number;
    average_resolution_time: number;
    system_uptime: number;
  } {
    const totalAlerts = this.alerts.length;
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical').length;
    const resolvedAlerts = this.alerts.filter(a => a.resolution_status === 'resolved').length;
    const activeIncidents = this.incidents.filter(i => i.status !== 'resolved').length;
    
    return {
      total_alerts: totalAlerts,
      critical_alerts: criticalAlerts,
      resolved_alerts: resolvedAlerts,
      active_incidents: activeIncidents,
      average_resolution_time: 0, // Would calculate from historical data
      system_uptime: process.uptime()
    };
  }

  /**
   * Logging methods
   */
  private async logMonitoringEvent(event: Omit<InsertSelfHealingAction, 'id' | 'timestamp'>): Promise<void> {
    try {
      await storage.insertSelfHealingAction({
        ...event,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('⚠️ Failed to log monitoring event:', error);
    }
  }

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
}

// Export singleton instance
export const railwayMonitoringIntegration = RailwayMonitoringIntegration.getInstance();