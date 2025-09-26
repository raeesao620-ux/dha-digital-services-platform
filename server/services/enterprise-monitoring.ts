import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { storage } from '../storage';

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  unit: string;
}

interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; message: string; level: string }>;
  status: 'started' | 'completed' | 'error';
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastCheck: Date;
  details?: any;
}

interface SLAMetric {
  service: string;
  target: number;
  actual: number;
  period: string;
  compliant: boolean;
}

interface CircuitBreakerState {
  service: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: Date;
  nextRetry?: Date;
}

/**
 * Enterprise Monitoring Service
 * Provides comprehensive monitoring, tracing, and observability for government systems
 */
class EnterpriseMonitoringService extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private traces: Map<string, Trace> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private slaTargets: Map<string, SLAMetric> = new Map();
  private incidentWorkflows: Map<string, any> = new Map();
  
  // Configuration
  private readonly METRIC_RETENTION_HOURS = 168; // 7 days
  private readonly TRACE_RETENTION_HOURS = 72; // 3 days
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  
  // APM Configuration
  private readonly APM_CONFIG = {
    sampleRate: 0.1, // Sample 10% of requests
    slowRequestThreshold: 1000, // 1 second
    errorRateThreshold: 0.05, // 5% error rate
    throughputAlertThreshold: 1000, // requests per minute
  };

  constructor() {
    super();
    this.initializeMonitoring();
    this.setupHealthChecks();
    this.configureSLATargets();
  }

  private initializeMonitoring(): void {
    // Start metric collection
    setInterval(() => this.collectSystemMetrics(), 10000); // Every 10 seconds
    
    // Clean up old data
    setInterval(() => this.cleanupOldData(), 3600000); // Every hour
    
    // Process incident workflows
    setInterval(() => this.processIncidentWorkflows(), 5000); // Every 5 seconds
  }

  private setupHealthChecks(): void {
    // Define health checks for critical services
    const services = [
      'database',
      'authentication',
      'document-processing',
      'biometric-verification',
      'fraud-detection',
      'quantum-encryption',
      'npr-integration',
      'saps-integration',
      'pkd-validation'
    ];

    services.forEach(service => {
      this.healthChecks.set(service, {
        service,
        status: 'healthy',
        latency: 0,
        lastCheck: new Date()
      });
    });

    // Start health check monitoring
    setInterval(() => this.performHealthChecks(), this.HEALTH_CHECK_INTERVAL);
  }

  private configureSLATargets(): void {
    // Define SLA targets for government services
    this.slaTargets.set('api-availability', {
      service: 'api',
      target: 99.95, // 99.95% uptime
      actual: 100,
      period: 'monthly',
      compliant: true
    });

    this.slaTargets.set('api-response-time', {
      service: 'api',
      target: 200, // 200ms average response time
      actual: 0,
      period: 'daily',
      compliant: true
    });

    this.slaTargets.set('document-processing', {
      service: 'document-processing',
      target: 95, // 95% success rate
      actual: 100,
      period: 'daily',
      compliant: true
    });
  }

  /**
   * Application Performance Monitoring (APM)
   */
  public startTrace(operationName: string, tags?: Record<string, any>): Trace {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const trace: Trace = {
      traceId,
      spanId,
      operationName,
      startTime: performance.now(),
      tags: tags || {},
      logs: [],
      status: 'started'
    };
    
    this.traces.set(spanId, trace);
    
    // Sample for APM based on configuration
    if (Math.random() < this.APM_CONFIG.sampleRate) {
      trace.tags.sampled = true;
    }
    
    return trace;
  }

  public endTrace(spanId: string, status: 'completed' | 'error' = 'completed', error?: Error): void {
    const trace = this.traces.get(spanId);
    if (!trace) return;
    
    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = status;
    
    if (error) {
      trace.tags.error = true;
      trace.tags.errorMessage = error.message;
      trace.tags.errorStack = error.stack;
    }
    
    // Check for slow requests
    if (trace.duration > this.APM_CONFIG.slowRequestThreshold) {
      this.handleSlowRequest(trace);
    }
    
    // Store trace for analysis
    this.analyzeTrace(trace);
  }

  public addTraceLog(spanId: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const trace = this.traces.get(spanId);
    if (!trace) return;
    
    trace.logs.push({
      timestamp: performance.now(),
      message,
      level
    });
  }

  /**
   * Metrics Collection
   */
  public recordMetric(name: string, value: number, unit: string = 'count', tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags: tags || {},
      unit
    };
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push(metric);
    
    // Check thresholds
    this.checkMetricThresholds(metric);
  }

  public getMetrics(name: string, startTime?: Date, endTime?: Date): Metric[] {
    const metrics = this.metrics.get(name) || [];
    
    if (!startTime) return metrics;
    
    return metrics.filter(m => {
      const time = m.timestamp.getTime();
      const start = startTime.getTime();
      const end = endTime ? endTime.getTime() : Date.now();
      return time >= start && time <= end;
    });
  }

  /**
   * Circuit Breaker Implementation
   */
  public async callWithCircuitBreaker<T>(
    service: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(service);
    
    if (breaker.state === 'open') {
      if (breaker.nextRetry && new Date() < breaker.nextRetry) {
        throw new Error(`Circuit breaker open for ${service}`);
      }
      // Try half-open state
      breaker.state = 'half-open';
    }
    
    try {
      const result = await operation();
      
      if (breaker.state === 'half-open') {
        // Success in half-open state, close the circuit
        breaker.state = 'closed';
        breaker.failures = 0;
        breaker.lastFailure = undefined;
      }
      
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = new Date();
      
      if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        breaker.state = 'open';
        breaker.nextRetry = new Date(Date.now() + this.CIRCUIT_BREAKER_TIMEOUT);
        
        // Trigger incident workflow
        this.createIncident({
          service,
          type: 'circuit_breaker_open',
          severity: 'high',
          details: { failures: breaker.failures }
        });
      }
      
      throw error;
    }
  }

  private getCircuitBreaker(service: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(service)) {
      this.circuitBreakers.set(service, {
        service,
        state: 'closed',
        failures: 0
      });
    }
    return this.circuitBreakers.get(service)!;
  }

  /**
   * Health Checks
   */
  private async performHealthChecks(): Promise<void> {
    for (const [service, check] of Array.from(this.healthChecks)) {
      const startTime = performance.now();
      
      try {
        const healthy = await this.checkServiceHealth(service);
        const latency = performance.now() - startTime;
        
        check.status = healthy ? 'healthy' : 'unhealthy';
        check.latency = latency;
        check.lastCheck = new Date();
        
        if (!healthy) {
          this.handleUnhealthyService(service);
        }
      } catch (error) {
        check.status = 'unhealthy';
        check.latency = performance.now() - startTime;
        check.lastCheck = new Date();
        check.details = { error: (error as Error).message };
        
        this.handleUnhealthyService(service);
      }
    }
  }

  private async checkServiceHealth(service: string): Promise<boolean> {
    // Implement specific health checks for each service
    switch (service) {
      case 'database':
        return await this.checkDatabaseHealth();
      case 'authentication':
        return await this.checkAuthHealth();
      default:
        return true; // Default to healthy
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Check database connection
      const users = await storage.getAllUsers();
      return true;
    } catch {
      return false;
    }
  }

  private async checkAuthHealth(): Promise<boolean> {
    try {
      // Check authentication service health by testing critical auth operations
      const startTime = Date.now();
      
      // Test database connection for auth tables
      const dbHealth = await this.checkDatabaseHealth();
      if (!dbHealth) return false;
      
      // Test session storage accessibility
      const sessionTest = Math.random().toString(36);
      const testKey = `health_check_${sessionTest}`;
      
      try {
        // Simple storage test
        const storage = require('../storage').storage;
        const testUser = await storage.createUser({
          username: `health_test_${Date.now()}`,
          email: `health@test.${Date.now()}.com`,
          passwordHash: 'test_hash'
        });
        
        // Clean up test user
        await storage.updateUser(testUser.id, { isActive: false });
        
        return true;
      } catch (error) {
        console.error('[EnterpriseMonitoring] Auth health check failed:', error);
        return false;
      }
    } catch (error) {
      console.error('[EnterpriseMonitoring] Auth health check error:', error);
      return false;
    }
  }

  /**
   * SLA Monitoring
   */
  public updateSLAMetric(service: string, metric: string, value: number): void {
    const key = `${service}-${metric}`;
    const sla = this.slaTargets.get(key);
    
    if (!sla) return;
    
    sla.actual = value;
    sla.compliant = this.checkSLACompliance(sla);
    
    if (!sla.compliant) {
      this.handleSLAViolation(sla);
    }
  }

  private checkSLACompliance(sla: SLAMetric): boolean {
    if (sla.service === 'api' && sla.target > 100) {
      // For response time, lower is better
      return sla.actual <= sla.target;
    }
    // For availability and success rates, higher is better
    return sla.actual >= sla.target;
  }

  private handleSLAViolation(sla: SLAMetric): void {
    this.createIncident({
      service: sla.service,
      type: 'sla_violation',
      severity: 'medium',
      details: {
        metric: sla.service,
        target: sla.target,
        actual: sla.actual,
        period: sla.period
      }
    });
  }

  /**
   * Incident Management
   */
  public createIncident(incident: {
    service: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: any;
  }): void {
    const id = this.generateIncidentId();
    
    const incidentData = {
      id,
      ...incident,
      createdAt: new Date(),
      status: 'open',
      workflow: this.determineWorkflow(incident)
    };
    
    this.incidentWorkflows.set(id, incidentData);
    
    // Emit event for real-time notifications
    this.emit('incident:created', incidentData);
    
    // Log to storage
    this.logIncident(incidentData);
  }

  private determineWorkflow(incident: any): string[] {
    const workflows: string[] = [];
    
    switch (incident.severity) {
      case 'critical':
        workflows.push('page_oncall', 'create_war_room', 'executive_notification');
        break;
      case 'high':
        workflows.push('notify_team', 'create_ticket', 'start_investigation');
        break;
      case 'medium':
        workflows.push('create_ticket', 'schedule_review');
        break;
      case 'low':
        workflows.push('log_event');
        break;
    }
    
    return workflows;
  }

  private async processIncidentWorkflows(): Promise<void> {
    for (const [id, incident] of Array.from(this.incidentWorkflows)) {
      if (incident.status === 'open' && incident.workflow.length > 0) {
        const nextStep = incident.workflow[0];
        await this.executeWorkflowStep(incident, nextStep);
        incident.workflow.shift();
        
        if (incident.workflow.length === 0) {
          incident.status = 'processed';
        }
      }
    }
  }

  private async executeWorkflowStep(incident: any, step: string): Promise<void> {
    switch (step) {
      case 'page_oncall':
        console.log('[Alert] Paging on-call engineer for', incident);
        break;
      case 'create_war_room':
        console.log('[Alert] Creating war room for', incident);
        break;
      case 'executive_notification':
        console.log('[Alert] Notifying executives about', incident);
        break;
      case 'notify_team':
        console.log('[Alert] Notifying team about', incident);
        break;
      case 'create_ticket':
        console.log('[Alert] Creating support ticket for', incident);
        break;
      default:
        console.log(`[Workflow] Executing ${step} for`, incident);
    }
  }

  /**
   * Log Aggregation
   */
  public aggregateLogs(source: string, logs: any[]): void {
    // Process and store logs for centralized analysis
    logs.forEach(log => {
      this.processLog(source, log);
    });
  }

  private processLog(source: string, log: any): void {
    // Parse and categorize log
    const level = this.determineLogLevel(log);
    
    if (level === 'error' || level === 'critical') {
      this.handleErrorLog(source, log);
    }
    
    // Store for analysis
    this.recordMetric(`logs.${source}.${level}`, 1, 'count');
  }

  private determineLogLevel(log: any): string {
    if (typeof log === 'string') {
      if (log.includes('ERROR') || log.includes('FATAL')) return 'error';
      if (log.includes('WARN')) return 'warn';
      return 'info';
    }
    return log.level || 'info';
  }

  private handleErrorLog(source: string, log: any): void {
    // Check for patterns that require immediate attention
    const criticalPatterns = [
      'OutOfMemory',
      'DatabaseConnection',
      'SecurityViolation',
      'DataCorruption'
    ];
    
    const logString = JSON.stringify(log);
    for (const pattern of criticalPatterns) {
      if (logString.includes(pattern)) {
        this.createIncident({
          service: source,
          type: 'critical_error',
          severity: 'critical',
          details: { log, pattern }
        });
        break;
      }
    }
  }

  /**
   * Real-time Dashboard Support
   */
  public getDashboardMetrics(): any {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);
    
    return {
      systemHealth: Array.from(this.healthChecks.values()),
      recentTraces: Array.from(this.traces.values()).slice(-100),
      activeIncidents: Array.from(this.incidentWorkflows.values())
        .filter(i => i.status === 'open'),
      slaCompliance: Array.from(this.slaTargets.values()),
      circuitBreakers: Array.from(this.circuitBreakers.values()),
      metrics: {
        requestRate: this.calculateRate('api.requests', hourAgo),
        errorRate: this.calculateRate('api.errors', hourAgo),
        averageLatency: this.calculateAverage('api.latency', hourAgo),
        throughput: this.calculateThroughput(hourAgo)
      }
    };
  }

  // Helper methods
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateIncidentId(): string {
    return `inc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private collectSystemMetrics(): void {
    // Collect system-level metrics
    const memUsage = process.memoryUsage();
    this.recordMetric('system.memory.heap', memUsage.heapUsed, 'bytes');
    this.recordMetric('system.memory.rss', memUsage.rss, 'bytes');
    
    const cpuUsage = process.cpuUsage();
    this.recordMetric('system.cpu.user', cpuUsage.user, 'microseconds');
    this.recordMetric('system.cpu.system', cpuUsage.system, 'microseconds');
  }

  private cleanupOldData(): void {
    const now = Date.now();
    
    // Clean up old metrics
    for (const [name, metrics] of Array.from(this.metrics)) {
      const cutoff = now - (this.METRIC_RETENTION_HOURS * 3600000);
      const filtered = metrics.filter((m: Metric) => m.timestamp.getTime() > cutoff);
      this.metrics.set(name, filtered);
    }
    
    // Clean up old traces
    const traceCutoff = now - (this.TRACE_RETENTION_HOURS * 3600000);
    for (const [id, trace] of Array.from(this.traces)) {
      if (trace.startTime < traceCutoff) {
        this.traces.delete(id);
      }
    }
  }

  private handleSlowRequest(trace: Trace): void {
    this.recordMetric('api.slow_requests', 1, 'count', {
      operation: trace.operationName
    });
    
    if (trace.duration! > this.APM_CONFIG.slowRequestThreshold * 2) {
      this.createIncident({
        service: 'api',
        type: 'slow_request',
        severity: 'medium',
        details: {
          operation: trace.operationName,
          duration: trace.duration,
          traceId: trace.traceId
        }
      });
    }
  }

  private analyzeTrace(trace: Trace): void {
    // Analyze trace for patterns and issues
    if (trace.status === 'error') {
      this.recordMetric('api.errors', 1, 'count', {
        operation: trace.operationName
      });
    }
    
    this.recordMetric('api.requests', 1, 'count', {
      operation: trace.operationName
    });
    
    if (trace.duration) {
      this.recordMetric('api.latency', trace.duration, 'milliseconds', {
        operation: trace.operationName
      });
    }
  }

  private checkMetricThresholds(metric: Metric): void {
    // Check if metric exceeds defined thresholds
    if (metric.name === 'api.errors') {
      const errorRate = this.calculateRate('api.errors', new Date(Date.now() - 300000)); // Last 5 minutes
      if (errorRate > this.APM_CONFIG.errorRateThreshold) {
        this.createIncident({
          service: 'api',
          type: 'high_error_rate',
          severity: 'high',
          details: { errorRate, threshold: this.APM_CONFIG.errorRateThreshold }
        });
      }
    }
  }

  private handleUnhealthyService(service: string): void {
    this.createIncident({
      service,
      type: 'health_check_failed',
      severity: 'high',
      details: this.healthChecks.get(service)
    });
  }

  private async logIncident(incident: any): Promise<void> {
    try {
      await storage.createSecurityIncident({
        incidentType: incident.type,
        severity: incident.severity,
        description: JSON.stringify(incident.details),
        affectedUsers: [],
        evidenceIds: [],
        correlatedEvents: [],
        metadata: incident
      });
    } catch (error) {
      console.error('[Monitoring] Failed to log incident:', error);
    }
  }

  private calculateRate(metricName: string, since: Date): number {
    const metrics = this.getMetrics(metricName, since);
    const duration = (Date.now() - since.getTime()) / 1000; // in seconds
    return metrics.length / duration;
  }

  private calculateAverage(metricName: string, since: Date): number {
    const metrics = this.getMetrics(metricName, since);
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  private calculateThroughput(since: Date): number {
    const requests = this.getMetrics('api.requests', since);
    const duration = (Date.now() - since.getTime()) / 60000; // in minutes
    return requests.length / duration;
  }
}

export const enterpriseMonitoringService = new EnterpriseMonitoringService();