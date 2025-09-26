import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { Request, Response, NextFunction } from 'express';

interface LoadBalancerNode {
  id: string;
  host: string;
  port: number;
  weight: number;
  status: 'healthy' | 'unhealthy' | 'draining';
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
  responseTime: number;
  lastHealthCheck: Date;
  metadata: any;
}

interface HealthCheck {
  endpoint: string;
  method: 'GET' | 'POST' | 'HEAD';
  expectedStatus: number[];
  timeout: number;
  interval: number;
  retries: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

interface LoadBalancingStrategy {
  type: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash' | 'consistent-hash';
  sessionAffinity: boolean;
  affinityTimeout: number;
  failoverPolicy: 'immediate' | 'graceful' | 'manual';
}

interface ClusterNode {
  id: string;
  role: 'master' | 'slave' | 'arbiter';
  priority: number;
  status: 'active' | 'standby' | 'syncing' | 'failed';
  lastSync: Date;
  lagTime: number; // milliseconds behind master
  dataVersion: string;
  endpoints: string[];
}

interface FailoverEvent {
  id: string;
  timestamp: Date;
  type: 'automatic' | 'manual' | 'scheduled';
  fromNode: string;
  toNode: string;
  reason: string;
  duration: number;
  dataLoss: boolean;
  rollbackAvailable: boolean;
}

interface ReplicationConfig {
  mode: 'synchronous' | 'asynchronous' | 'semi-synchronous';
  maxLag: number; // Maximum acceptable lag in milliseconds
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  batchSize: number;
  parallelStreams: number;
}

interface HAMetrics {
  uptime: number;
  availability: number; // Percentage
  failoverCount: number;
  averageFailoverTime: number;
  dataConsistency: number; // Percentage
  replicationLag: number;
  activeNodes: number;
  totalNodes: number;
  requestsPerSecond: number;
  errorRate: number;
}

/**
 * High Availability Service
 * Provides load balancing, failover, clustering, and replication capabilities
 */
export class HighAvailabilityService extends EventEmitter {
  private loadBalancerNodes: Map<string, LoadBalancerNode> = new Map();
  private clusterNodes: Map<string, ClusterNode> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private strategies: Map<string, LoadBalancingStrategy> = new Map();
  private replicationConfigs: Map<string, ReplicationConfig> = new Map();
  private failoverHistory: FailoverEvent[] = [];
  private sessionAffinities: Map<string, string> = new Map(); // IP -> Node mapping
  private nodeHealthHistory: Map<string, boolean[]> = new Map();
  
  // Current state
  private currentMaster: string | null = null;
  private roundRobinIndex: number = 0;
  private isFailoverInProgress: boolean = false;
  
  // Configuration
  private readonly MAX_FAILOVER_ATTEMPTS = 3;
  private readonly FAILOVER_COOLDOWN = 60000; // 1 minute
  private readonly HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_HEALTH_HISTORY = 100;
  private readonly SYNC_CHECK_INTERVAL = 1000; // 1 second
  
  // Metrics
  private metrics: HAMetrics = {
    uptime: 0,
    availability: 100,
    failoverCount: 0,
    averageFailoverTime: 0,
    dataConsistency: 100,
    replicationLag: 0,
    activeNodes: 0,
    totalNodes: 0,
    requestsPerSecond: 0,
    errorRate: 0
  };
  
  private startTime: Date = new Date();
  private requestCounts: Map<number, number> = new Map(); // timestamp -> count

  constructor() {
    super();
    this.initializeHA();
    this.setupDefaultNodes();
    this.startHealthMonitoring();
  }

  private initializeHA(): void {
    // Start uptime tracking
    setInterval(() => {
      this.metrics.uptime = Date.now() - this.startTime.getTime();
    }, 1000);
    
    // Monitor cluster health
    setInterval(() => this.monitorClusterHealth(), 5000);
    
    // Check replication status
    setInterval(() => this.checkReplicationStatus(), this.SYNC_CHECK_INTERVAL);
    
    // Calculate metrics
    setInterval(() => this.calculateMetrics(), 10000);
    
    // Cleanup old session affinities
    setInterval(() => this.cleanupSessionAffinities(), 60000);
  }

  private setupDefaultNodes(): void {
    // Setup load balancer nodes
    this.addLoadBalancerNode({
      id: 'lb-node-1',
      host: 'localhost',
      port: 3001,
      weight: 100,
      status: 'healthy',
      activeConnections: 0,
      totalRequests: 0,
      errorRate: 0,
      responseTime: 0,
      lastHealthCheck: new Date(),
      metadata: {}
    });
    
    this.addLoadBalancerNode({
      id: 'lb-node-2',
      host: 'localhost',
      port: 3002,
      weight: 100,
      status: 'healthy',
      activeConnections: 0,
      totalRequests: 0,
      errorRate: 0,
      responseTime: 0,
      lastHealthCheck: new Date(),
      metadata: {}
    });
    
    // Setup cluster nodes
    this.addClusterNode({
      id: 'cluster-master',
      role: 'master',
      priority: 100,
      status: 'active',
      lastSync: new Date(),
      lagTime: 0,
      dataVersion: 'v1.0.0',
      endpoints: ['postgres://master:5432']
    });
    
    this.addClusterNode({
      id: 'cluster-slave-1',
      role: 'slave',
      priority: 90,
      status: 'active',
      lastSync: new Date(),
      lagTime: 0,
      dataVersion: 'v1.0.0',
      endpoints: ['postgres://slave1:5432']
    });
    
    this.currentMaster = 'cluster-master';
    
    // Setup default strategy
    this.strategies.set('default', {
      type: 'round-robin',
      sessionAffinity: true,
      affinityTimeout: 3600000, // 1 hour
      failoverPolicy: 'immediate'
    });
    
    // Setup replication config
    this.replicationConfigs.set('default', {
      mode: 'asynchronous',
      maxLag: 1000, // 1 second
      compressionEnabled: true,
      encryptionEnabled: true,
      batchSize: 1000,
      parallelStreams: 4
    });
  }

  private startHealthMonitoring(): void {
    // Setup health checks for load balancer nodes
    for (const node of this.loadBalancerNodes.values()) {
      this.healthChecks.set(node.id, {
        endpoint: `/health`,
        method: 'GET',
        expectedStatus: [200, 204],
        timeout: this.HEALTH_CHECK_TIMEOUT,
        interval: 5000,
        retries: 3,
        healthyThreshold: 2,
        unhealthyThreshold: 3
      });
      
      this.scheduleHealthCheck(node.id);
    }
  }

  /**
   * Load Balancing
   */
  public selectNode(
    req: Request,
    strategy?: LoadBalancingStrategy
  ): LoadBalancerNode | null {
    const activeStrategy = strategy || this.strategies.get('default')!;
    const healthyNodes = Array.from(this.loadBalancerNodes.values())
      .filter(node => node.status === 'healthy');
    
    if (healthyNodes.length === 0) return null;
    
    // Check session affinity
    if (activeStrategy.sessionAffinity) {
      const clientIp = this.getClientIp(req);
      const affinityNode = this.sessionAffinities.get(clientIp);
      
      if (affinityNode) {
        const node = this.loadBalancerNodes.get(affinityNode);
        if (node && node.status === 'healthy') {
          return node;
        }
      }
    }
    
    let selectedNode: LoadBalancerNode | null = null;
    
    switch (activeStrategy.type) {
      case 'round-robin':
        selectedNode = this.selectRoundRobin(healthyNodes);
        break;
        
      case 'least-connections':
        selectedNode = this.selectLeastConnections(healthyNodes);
        break;
        
      case 'weighted':
        selectedNode = this.selectWeighted(healthyNodes);
        break;
        
      case 'ip-hash':
        selectedNode = this.selectIpHash(req, healthyNodes);
        break;
        
      case 'consistent-hash':
        selectedNode = this.selectConsistentHash(req, healthyNodes);
        break;
        
      default:
        selectedNode = healthyNodes[0];
    }
    
    // Update session affinity
    if (selectedNode && activeStrategy.sessionAffinity) {
      const clientIp = this.getClientIp(req);
      this.sessionAffinities.set(clientIp, selectedNode.id);
    }
    
    // Update metrics
    if (selectedNode) {
      selectedNode.activeConnections++;
      selectedNode.totalRequests++;
    }
    
    return selectedNode;
  }

  private selectRoundRobin(nodes: LoadBalancerNode[]): LoadBalancerNode {
    const node = nodes[this.roundRobinIndex % nodes.length];
    this.roundRobinIndex++;
    return node;
  }

  private selectLeastConnections(nodes: LoadBalancerNode[]): LoadBalancerNode {
    return nodes.reduce((min, node) => 
      node.activeConnections < min.activeConnections ? node : min
    );
  }

  private selectWeighted(nodes: LoadBalancerNode[]): LoadBalancerNode {
    const totalWeight = nodes.reduce((sum, node) => sum + node.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const node of nodes) {
      random -= node.weight;
      if (random <= 0) return node;
    }
    
    return nodes[nodes.length - 1];
  }

  private selectIpHash(req: Request, nodes: LoadBalancerNode[]): LoadBalancerNode {
    const clientIp = this.getClientIp(req);
    const hash = createHash('md5').update(clientIp).digest('hex');
    const index = parseInt(hash.substring(0, 8), 16) % nodes.length;
    return nodes[index];
  }

  private selectConsistentHash(req: Request, nodes: LoadBalancerNode[]): LoadBalancerNode {
    const key = req.url || '/';
    const hash = createHash('md5').update(key).digest('hex');
    const index = parseInt(hash.substring(0, 8), 16) % nodes.length;
    return nodes[index];
  }

  /**
   * Failover Management
   */
  public async initiateFailover(
    reason: string,
    manual: boolean = false
  ): Promise<boolean> {
    if (this.isFailoverInProgress) {
      console.log('[HA] Failover already in progress');
      return false;
    }
    
    this.isFailoverInProgress = true;
    const startTime = performance.now();
    
    try {
      // Find next available master
      const nextMaster = this.selectNextMaster();
      if (!nextMaster) {
        throw new Error('No suitable master candidate found');
      }
      
      // Create failover event
      const failoverEvent: FailoverEvent = {
        id: this.generateEventId(),
        timestamp: new Date(),
        type: manual ? 'manual' : 'automatic',
        fromNode: this.currentMaster || 'unknown',
        toNode: nextMaster.id,
        reason,
        duration: 0,
        dataLoss: false,
        rollbackAvailable: true
      };
      
      // Perform pre-failover checks
      const checks = await this.performPreFailoverChecks(nextMaster);
      if (!checks.passed) {
        throw new Error(`Pre-failover checks failed: ${checks.reason}`);
      }
      
      // Stop writes to current master
      await this.suspendWrites();
      
      // Wait for replication to catch up
      await this.waitForReplicationSync(nextMaster, 10000); // 10 second timeout
      
      // Promote new master
      await this.promoteToMaster(nextMaster);
      
      // Update routing
      this.currentMaster = nextMaster.id;
      
      // Demote old master
      if (failoverEvent.fromNode !== 'unknown') {
        const oldMaster = this.clusterNodes.get(failoverEvent.fromNode);
        if (oldMaster) {
          oldMaster.role = 'slave';
          oldMaster.status = 'standby';
        }
      }
      
      // Resume writes
      await this.resumeWrites();
      
      // Record failover
      failoverEvent.duration = performance.now() - startTime;
      this.failoverHistory.push(failoverEvent);
      this.metrics.failoverCount++;
      
      // Emit event
      this.emit('failover:completed', failoverEvent);
      
      console.log(`[HA] Failover completed in ${failoverEvent.duration}ms`);
      
      return true;
    } catch (error) {
      console.error('[HA] Failover failed:', error);
      
      // Attempt rollback
      await this.rollbackFailover();
      
      return false;
    } finally {
      this.isFailoverInProgress = false;
    }
  }

  private selectNextMaster(): ClusterNode | null {
    const candidates = Array.from(this.clusterNodes.values())
      .filter(node => 
        node.role === 'slave' &&
        node.status === 'active' &&
        node.lagTime < 1000 // Less than 1 second behind
      )
      .sort((a, b) => b.priority - a.priority);
    
    return candidates[0] || null;
  }

  private async performPreFailoverChecks(node: ClusterNode): Promise<{
    passed: boolean;
    reason?: string;
  }> {
    // Check node health
    if (node.status !== 'active') {
      return { passed: false, reason: 'Node not active' };
    }
    
    // Check replication lag
    if (node.lagTime > 5000) { // More than 5 seconds behind
      return { passed: false, reason: 'Replication lag too high' };
    }
    
    // Check data consistency
    const consistency = await this.checkDataConsistency(node);
    if (consistency < 99) { // Less than 99% consistent
      return { passed: false, reason: 'Data consistency check failed' };
    }
    
    return { passed: true };
  }

  private async suspendWrites(): Promise<void> {
    // Implement write suspension logic
    console.log('[HA] Writes suspended');
  }

  private async resumeWrites(): Promise<void> {
    // Implement write resumption logic
    console.log('[HA] Writes resumed');
  }

  private async waitForReplicationSync(node: ClusterNode, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (node.lagTime < 100) { // Less than 100ms lag
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Replication sync timeout');
  }

  private async promoteToMaster(node: ClusterNode): Promise<void> {
    node.role = 'master';
    node.priority = 100;
    console.log(`[HA] Promoted ${node.id} to master`);
  }

  private async rollbackFailover(): Promise<void> {
    // Implement failover rollback logic
    console.log('[HA] Attempting failover rollback');
  }

  /**
   * Health Monitoring
   */
  private async scheduleHealthCheck(nodeId: string): Promise<void> {
    const check = this.healthChecks.get(nodeId);
    const node = this.loadBalancerNodes.get(nodeId);
    
    if (!check || !node) return;
    
    const performCheck = async () => {
      try {
        const healthy = await this.performHealthCheck(node, check);
        
        // Update health history
        if (!this.nodeHealthHistory.has(nodeId)) {
          this.nodeHealthHistory.set(nodeId, []);
        }
        
        const history = this.nodeHealthHistory.get(nodeId)!;
        history.push(healthy);
        
        if (history.length > this.MAX_HEALTH_HISTORY) {
          history.shift();
        }
        
        // Determine node status based on thresholds
        const recentChecks = history.slice(-check.unhealthyThreshold);
        const healthyCount = recentChecks.filter(h => h).length;
        const unhealthyCount = recentChecks.filter(h => !h).length;
        
        if (unhealthyCount >= check.unhealthyThreshold && node.status === 'healthy') {
          node.status = 'unhealthy';
          this.emit('node:unhealthy', node);
          
          // Trigger failover if needed
          if (node.id === this.currentMaster) {
            await this.initiateFailover('Master node unhealthy');
          }
        } else if (healthyCount >= check.healthyThreshold && node.status === 'unhealthy') {
          node.status = 'healthy';
          this.emit('node:healthy', node);
        }
        
        node.lastHealthCheck = new Date();
      } catch (error) {
        console.error(`[HA] Health check failed for ${nodeId}:`, error);
      }
      
      // Schedule next check
      setTimeout(() => performCheck(), check.interval);
    };
    
    // Start health checks
    performCheck();
  }

  private async performHealthCheck(
    node: LoadBalancerNode,
    check: HealthCheck
  ): Promise<boolean> {
    // Simulate health check
    // In production, make actual HTTP request to node
    return Math.random() > 0.05; // 95% healthy
  }

  /**
   * Replication Management
   */
  private async checkReplicationStatus(): Promise<void> {
    const config = this.replicationConfigs.get('default');
    if (!config) return;
    
    for (const node of this.clusterNodes.values()) {
      if (node.role === 'slave') {
        // Simulate lag calculation
        node.lagTime = Math.random() * 500; // 0-500ms lag
        
        // Check if lag exceeds threshold
        if (node.lagTime > config.maxLag) {
          this.emit('replication:lag', {
            node: node.id,
            lag: node.lagTime,
            threshold: config.maxLag
          });
        }
      }
    }
    
    // Update average replication lag
    const slaves = Array.from(this.clusterNodes.values())
      .filter(n => n.role === 'slave');
    
    if (slaves.length > 0) {
      const totalLag = slaves.reduce((sum, n) => sum + n.lagTime, 0);
      this.metrics.replicationLag = totalLag / slaves.length;
    }
  }

  private async checkDataConsistency(node: ClusterNode): Promise<number> {
    // Simulate data consistency check
    // In production, compare checksums or row counts
    return 99.5 + Math.random() * 0.5; // 99.5-100%
  }

  /**
   * Cluster Management
   */
  private monitorClusterHealth(): void {
    let activeNodes = 0;
    const totalNodes = this.clusterNodes.size;
    
    for (const node of this.clusterNodes.values()) {
      if (node.status === 'active') {
        activeNodes++;
      }
    }
    
    this.metrics.activeNodes = activeNodes;
    this.metrics.totalNodes = totalNodes;
    
    // Check if we have minimum nodes for HA
    if (activeNodes < 2) {
      this.emit('ha:degraded', {
        activeNodes,
        totalNodes,
        reason: 'Insufficient active nodes for high availability'
      });
    }
  }

  /**
   * Metrics Calculation
   */
  private calculateMetrics(): void {
    // Calculate availability
    const uptime = Date.now() - this.startTime.getTime();
    const downtime = this.failoverHistory.reduce((sum, event) => sum + event.duration, 0);
    this.metrics.availability = ((uptime - downtime) / uptime) * 100;
    
    // Calculate average failover time
    if (this.failoverHistory.length > 0) {
      const totalTime = this.failoverHistory.reduce((sum, event) => sum + event.duration, 0);
      this.metrics.averageFailoverTime = totalTime / this.failoverHistory.length;
    }
    
    // Calculate requests per second
    const now = Math.floor(Date.now() / 1000);
    const recentCounts = Array.from(this.requestCounts.entries())
      .filter(([timestamp]) => timestamp > now - 60)
      .map(([, count]) => count);
    
    if (recentCounts.length > 0) {
      const totalRequests = recentCounts.reduce((sum, count) => sum + count, 0);
      this.metrics.requestsPerSecond = totalRequests / recentCounts.length;
    }
    
    // Calculate error rate
    const nodes = Array.from(this.loadBalancerNodes.values());
    if (nodes.length > 0) {
      const totalErrorRate = nodes.reduce((sum, node) => sum + node.errorRate, 0);
      this.metrics.errorRate = totalErrorRate / nodes.length;
    }
    
    // Calculate data consistency
    const consistencyChecks = Array.from(this.clusterNodes.values())
      .filter(n => n.role === 'slave')
      .map(n => this.checkDataConsistency(n));
    
    Promise.all(consistencyChecks).then(results => {
      if (results.length > 0) {
        const totalConsistency = results.reduce((sum, c) => sum + c, 0);
        this.metrics.dataConsistency = totalConsistency / results.length;
      }
    });
  }

  /**
   * Session Management
   */
  private cleanupSessionAffinities(): void {
    const strategy = this.strategies.get('default');
    if (!strategy) return;
    
    const now = Date.now();
    const timeout = strategy.affinityTimeout;
    
    // In production, track last access time for each session
    // For now, clear all affinities older than timeout
    // This is a simplified implementation
    if (this.sessionAffinities.size > 1000) {
      this.sessionAffinities.clear();
    }
  }

  /**
   * Helper Methods
   */
  private getClientIp(req: Request): string {
    return req.ip || 
           req.headers['x-forwarded-for'] as string || 
           req.socket.remoteAddress || 
           'unknown';
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private addLoadBalancerNode(node: LoadBalancerNode): void {
    this.loadBalancerNodes.set(node.id, node);
  }

  private addClusterNode(node: ClusterNode): void {
    this.clusterNodes.set(node.id, node);
  }

  /**
   * Public Methods
   */
  public getMetrics(): HAMetrics {
    return { ...this.metrics };
  }

  public getNodes(): {
    loadBalancer: LoadBalancerNode[];
    cluster: ClusterNode[];
  } {
    return {
      loadBalancer: Array.from(this.loadBalancerNodes.values()),
      cluster: Array.from(this.clusterNodes.values())
    };
  }

  public getFailoverHistory(limit: number = 10): FailoverEvent[] {
    return this.failoverHistory.slice(-limit);
  }

  public async testFailover(): Promise<boolean> {
    console.log('[HA] Starting failover test');
    return await this.initiateFailover('Test failover', true);
  }

  public recordRequest(nodeId: string): void {
    const now = Math.floor(Date.now() / 1000);
    const count = this.requestCounts.get(now) || 0;
    this.requestCounts.set(now, count + 1);
    
    // Cleanup old entries
    for (const [timestamp] of Array.from(this.requestCounts)) {
      if (timestamp < now - 300) { // Keep 5 minutes of data
        this.requestCounts.delete(timestamp);
      }
    }
  }

  public releaseConnection(nodeId: string): void {
    const node = this.loadBalancerNodes.get(nodeId);
    if (node && node.activeConnections > 0) {
      node.activeConnections--;
    }
  }

  public updateNodeMetrics(nodeId: string, metrics: {
    responseTime?: number;
    errorRate?: number;
  }): void {
    const node = this.loadBalancerNodes.get(nodeId);
    if (node) {
      if (metrics.responseTime !== undefined) {
        node.responseTime = metrics.responseTime;
      }
      if (metrics.errorRate !== undefined) {
        node.errorRate = metrics.errorRate;
      }
    }
  }
}

// Export singleton instance
export const highAvailabilityService = new HighAvailabilityService();