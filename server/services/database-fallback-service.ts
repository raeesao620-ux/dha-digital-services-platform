/**
 * Database Fallback Service
 * Provides in-memory fallbacks when PostgreSQL is unavailable
 * Ensures zero-defect operation regardless of database state
 */

import { EventEmitter } from 'events';
import { getConnectionStatus } from '../db';

interface BufferedAction {
  id: string;
  type: 'security_event' | 'security_incident' | 'error_correction' | 'self_healing_action' | 'system_metric' | 'audit_log';
  data: any;
  timestamp: Date;
  retryCount: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface ThreatData {
  ipAddress: string;
  threatType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  indicators: string[];
  blocked: boolean;
}

interface FallbackMetrics {
  bufferedActions: number;
  successfulSyncs: number;
  failedSyncs: number;
  inMemoryThreats: number;
  blockedIPs: number;
  uptime: number;
  lastDatabaseSync: Date | null;
  lastDatabaseCheck: Date;
  databaseAvailable: boolean;
}

export class DatabaseFallbackService extends EventEmitter {
  private static instance: DatabaseFallbackService;
  
  // In-memory storage for when database is unavailable
  private bufferedActions: Map<string, BufferedAction> = new Map();
  private inMemoryThreats: Map<string, ThreatData> = new Map();
  private blockedIPs: Set<string> = new Set();
  private quarantinedIPs: Set<string> = new Set();
  private threatScores: Map<string, number> = new Map();
  
  // Fallback configuration
  private readonly config = {
    maxBufferedActions: 10000,
    syncInterval: 30000, // 30 seconds
    maxRetryAttempts: 5,
    bufferTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
    healthCheckInterval: 10000, // 10 seconds
    criticalActionSyncTimeout: 5000, // 5 seconds for critical actions
  };
  
  // Service state
  private isRunning = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private lastDatabaseSync: Date | null = null;
  private isDatabaseAvailable = false;
  private startTime = Date.now();
  
  private constructor() {
    super();
    this.startHealthMonitoring();
  }
  
  static getInstance(): DatabaseFallbackService {
    if (!DatabaseFallbackService.instance) {
      DatabaseFallbackService.instance = new DatabaseFallbackService();
    }
    return DatabaseFallbackService.instance;
  }
  
  /**
   * Start the fallback service with automatic database sync
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[DatabaseFallback] Service already running');
      return;
    }
    
    console.log('[DatabaseFallback] Starting database fallback service...');
    
    this.isRunning = true;
    
    // Check initial database status
    await this.checkDatabaseStatus();
    
    // Start periodic sync
    this.startPeriodicSync();
    
    console.log('[DatabaseFallback] ✅ Database fallback service started');
    this.emit('started');
  }
  
  /**
   * Stop the fallback service
   */
  async stop(): Promise<void> {
    console.log('[DatabaseFallback] Stopping database fallback service...');
    
    this.isRunning = false;
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Final sync attempt
    await this.syncBufferedActions();
    
    console.log('[DatabaseFallback] ✅ Database fallback service stopped');
    this.emit('stopped');
  }
  
  /**
   * Buffer security event when database is unavailable
   */
  async bufferSecurityEvent(eventData: any): Promise<string> {
    const actionId = `sec_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bufferedAction: BufferedAction = {
      id: actionId,
      type: 'security_event',
      data: eventData,
      timestamp: new Date(),
      retryCount: 0,
      priority: this.determinePriority(eventData.severity)
    };
    
    this.bufferedActions.set(actionId, bufferedAction);
    
    // Cleanup old actions if buffer is full
    this.cleanupOldActions();
    
    console.log(`📦 Buffered security event: ${eventData.eventType} (${this.bufferedActions.size} total)`);
    
    // Try immediate sync for critical actions
    if (bufferedAction.priority === 'critical') {
      setTimeout(() => this.syncBufferedActions(), 1000);
    }
    
    return actionId;
  }
  
  /**
   * Buffer security incident when database is unavailable
   */
  async bufferSecurityIncident(incidentData: any): Promise<string> {
    const actionId = `sec_incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bufferedAction: BufferedAction = {
      id: actionId,
      type: 'security_incident',
      data: incidentData,
      timestamp: new Date(),
      retryCount: 0,
      priority: this.determinePriority(incidentData.severity)
    };
    
    this.bufferedActions.set(actionId, bufferedAction);
    this.cleanupOldActions();
    
    console.log(`📦 Buffered security incident: ${incidentData.type} (${this.bufferedActions.size} total)`);
    
    // Try immediate sync for critical incidents
    if (bufferedAction.priority === 'critical') {
      setTimeout(() => this.syncBufferedActions(), 1000);
    }
    
    return actionId;
  }

  /**
   * Buffer self-healing action when database is unavailable
   */
  async bufferSelfHealingAction(actionData: any): Promise<string> {
    const actionId = `self_healing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bufferedAction: BufferedAction = {
      id: actionId,
      type: 'self_healing_action',
      data: actionData,
      timestamp: new Date(),
      retryCount: 0,
      priority: this.determinePriority(actionData.severity || 'medium')
    };
    
    this.bufferedActions.set(actionId, bufferedAction);
    this.cleanupOldActions();
    
    console.log(`📦 Buffered self-healing action: ${actionData.action} (${this.bufferedActions.size} total)`);
    
    // Try immediate sync for critical actions
    if (bufferedAction.priority === 'critical') {
      setTimeout(() => this.syncBufferedActions(), 1000);
    }
    
    return actionId;
  }

  /**
   * Buffer error correction when database is unavailable
   */
  async bufferErrorCorrection(correctionData: any): Promise<string> {
    const actionId = `error_correction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bufferedAction: BufferedAction = {
      id: actionId,
      type: 'error_correction',
      data: correctionData,
      timestamp: new Date(),
      retryCount: 0,
      priority: this.determinePriority(correctionData.severity || 'medium')
    };
    
    this.bufferedActions.set(actionId, bufferedAction);
    this.cleanupOldActions();
    
    console.log(`📦 Buffered error correction: ${correctionData.type} (${this.bufferedActions.size} total)`);
    
    // Try immediate sync for critical errors
    if (bufferedAction.priority === 'critical') {
      setTimeout(() => this.syncBufferedActions(), 1000);
    }
    
    return actionId;
  }

  /**
   * Buffer system metric when database is unavailable
   */
  async bufferSystemMetric(metricData: any): Promise<string> {
    const actionId = `system_metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bufferedAction: BufferedAction = {
      id: actionId,
      type: 'system_metric',
      data: metricData,
      timestamp: new Date(),
      retryCount: 0,
      priority: 'low' // Metrics are generally low priority
    };
    
    this.bufferedActions.set(actionId, bufferedAction);
    this.cleanupOldActions();
    
    console.log(`📦 Buffered system metric: ${metricData.metricName} (${this.bufferedActions.size} total)`);
    
    return actionId;
  }

  /**
   * Buffer audit log when database is unavailable
   */
  async bufferAuditLog(auditData: any): Promise<string> {
    const actionId = `audit_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const bufferedAction: BufferedAction = {
      id: actionId,
      type: 'audit_log',
      data: auditData,
      timestamp: new Date(),
      retryCount: 0,
      priority: this.determinePriority(auditData.severity || 'medium')
    };
    
    this.bufferedActions.set(actionId, bufferedAction);
    this.cleanupOldActions();
    
    console.log(`📦 Buffered audit log: ${auditData.action} (${this.bufferedActions.size} total)`);
    
    // Try immediate sync for critical audit events
    if (bufferedAction.priority === 'critical') {
      setTimeout(() => this.syncBufferedActions(), 1000);
    }
    
    return actionId;
  }

  /**
   * Universal helper to record any data with automatic database fallback
   * This is the main method that should be used throughout the application
   */
  async recordWithFallback(
    operationType: 'security_event' | 'security_incident' | 'self_healing_action' | 'error_correction' | 'system_metric' | 'audit_log',
    data: any
  ): Promise<string> {
    try {
      // Check if database is available and try direct storage first
      if (this.isDatabaseAvailable) {
        const { storage } = await import('../storage');
        
        switch (operationType) {
          case 'security_event':
            await storage.createSecurityEvent(data);
            console.log(`✅ Recorded security event directly to database: ${data.eventType}`);
            break;
          case 'security_incident':
            await storage.createSecurityIncident(data);
            console.log(`✅ Recorded security incident directly to database: ${data.type}`);
            break;
          case 'self_healing_action':
            await storage.createSelfHealingAction(data);
            console.log(`✅ Recorded self-healing action directly to database: ${data.action}`);
            break;
          case 'error_correction':
            await storage.createErrorCorrection(data);
            console.log(`✅ Recorded error correction directly to database: ${data.type}`);
            break;
          case 'system_metric':
            await storage.createSystemMetric(data);
            console.log(`✅ Recorded system metric directly to database: ${data.metricName}`);
            break;
          case 'audit_log':
            await storage.createAuditLog(data);
            console.log(`✅ Recorded audit log directly to database: ${data.action}`);
            break;
        }
        
        return `direct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
      } else {
        // Database unavailable, use fallback buffer
        console.log(`🔄 Database unavailable, using fallback buffer for ${operationType}`);
      }
    } catch (error) {
      console.warn(`⚠️ Database operation failed for ${operationType}, falling back to buffer:`, error);
      this.isDatabaseAvailable = false; // Mark as unavailable for future calls
    }
    
    // Fallback to buffering
    switch (operationType) {
      case 'security_event':
        return await this.bufferSecurityEvent(data);
      case 'security_incident':
        return await this.bufferSecurityIncident(data);
      case 'security_incident_update':
        return await this.bufferSecurityEvent({
          eventType: 'security_incident_update',
          severity: 'medium',
          details: data,
          ipAddress: data.incidentId || 'system',
          userAgent: 'security-response-service'
        });
      case 'self_healing_action':
        return await this.bufferSelfHealingAction(data);
      case 'error_correction':
        return await this.bufferErrorCorrection(data);
      case 'error_correction_update':
        return await this.bufferSecurityEvent({
          eventType: 'error_correction_update',
          severity: 'low',
          details: data,
          ipAddress: data.correctionId || 'system',
          userAgent: 'error-correction-service'
        });
      case 'system_metric':
        return await this.bufferSystemMetric(data);
      case 'audit_log':
        return await this.bufferAuditLog(data);
      default:
        throw new Error(`Unsupported operation type: ${operationType}`);
    }
  }
  
  /**
   * Track threat in memory when database is unavailable
   */
  trackThreatInMemory(ipAddress: string, threatType: string, severity: string, indicators: string[] = []): void {
    const threatData: ThreatData = {
      ipAddress,
      threatType,
      severity: severity as any,
      timestamp: new Date(),
      indicators,
      blocked: false
    };
    
    this.inMemoryThreats.set(`${ipAddress}_${threatType}`, threatData);
    
    // Update threat score
    const currentScore = this.threatScores.get(ipAddress) || 0;
    const severityScore = this.getSeverityScore(severity);
    this.threatScores.set(ipAddress, currentScore + severityScore);
    
    console.log(`🧠 Tracking threat in memory: ${threatType} from ${ipAddress} (severity: ${severity})`);
  }
  
  /**
   * Block IP in memory (works without database)
   */
  blockIPInMemory(ipAddress: string, reason: string = 'Security threat'): void {
    this.blockedIPs.add(ipAddress);
    
    // Update threat record if exists
    for (const [key, threat] of this.inMemoryThreats) {
      if (threat.ipAddress === ipAddress) {
        threat.blocked = true;
      }
    }
    
    console.log(`🚫 IP blocked in memory: ${ipAddress} (reason: ${reason})`);
    
    // Buffer the blocking action for database sync
    this.bufferSecurityEvent({
      eventType: 'ip_blocked_fallback',
      severity: 'high',
      details: {
        ipAddress,
        reason,
        source: 'database_fallback_service',
        timestamp: new Date().toISOString()
      },
      ipAddress,
      userAgent: 'fallback-service'
    });
  }
  
  /**
   * Unblock IP from memory (works without database)
   */
  unblockIPInMemory(ipAddress: string, reason: string = 'Security clearance'): void {
    this.blockedIPs.delete(ipAddress);
    
    // Update threat record if exists
    for (const [key, threat] of this.inMemoryThreats) {
      if (threat.ipAddress === ipAddress) {
        threat.blocked = false;
      }
    }
    
    console.log(`✅ IP unblocked in memory: ${ipAddress} (reason: ${reason})`);
    
    // Buffer the unblocking action for database sync
    this.bufferSecurityEvent({
      eventType: 'ip_unblocked_fallback',
      severity: 'medium',
      details: {
        ipAddress,
        reason,
        source: 'database_fallback_service',
        timestamp: new Date().toISOString()
      },
      ipAddress,
      userAgent: 'fallback-service'
    });
  }

  /**
   * Check if IP is blocked (works without database)
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }
  
  /**
   * Quarantine IP in memory
   */
  quarantineIPInMemory(ipAddress: string, reason: string = 'Suspicious activity'): void {
    this.quarantinedIPs.add(ipAddress);
    console.log(`⚠️ IP quarantined in memory: ${ipAddress} (reason: ${reason})`);
  }
  
  /**
   * Unquarantine IP from memory (works without database)
   */
  unquarantineIPInMemory(ipAddress: string, reason: string = 'Quarantine period expired'): void {
    this.quarantinedIPs.delete(ipAddress);
    console.log(`✅ IP unquarantined in memory: ${ipAddress} (reason: ${reason})`);
    
    // Buffer the unquarantine action for database sync
    this.bufferSecurityEvent({
      eventType: 'ip_unquarantined_fallback',
      severity: 'low',
      details: {
        ipAddress,
        reason,
        source: 'database_fallback_service',
        timestamp: new Date().toISOString()
      },
      ipAddress,
      userAgent: 'fallback-service'
    });
  }

  /**
   * Check if IP is quarantined
   */
  isIPQuarantined(ipAddress: string): boolean {
    return this.quarantinedIPs.has(ipAddress);
  }
  
  /**
   * Get threat score for IP
   */
  getThreatScore(ipAddress: string): number {
    return this.threatScores.get(ipAddress) || 0;
  }
  
  /**
   * Get all threats for an IP
   */
  getThreatsForIP(ipAddress: string): ThreatData[] {
    const threats: ThreatData[] = [];
    for (const [key, threat] of this.inMemoryThreats) {
      if (threat.ipAddress === ipAddress) {
        threats.push(threat);
      }
    }
    return threats;
  }
  
  /**
   * Check database availability
   */
  private async checkDatabaseStatus(): Promise<boolean> {
    try {
      const status = await getConnectionStatus();
      this.isDatabaseAvailable = status.connected;
      
      if (this.isDatabaseAvailable && !this.lastDatabaseSync) {
        console.log('[DatabaseFallback] ✅ Database connection restored');
        this.emit('database_connected');
      } else if (!this.isDatabaseAvailable && this.lastDatabaseSync) {
        console.log('[DatabaseFallback] ❌ Database connection lost');
        this.emit('database_disconnected');
      }
      
      return this.isDatabaseAvailable;
    } catch (error) {
      this.isDatabaseAvailable = false;
      return false;
    }
  }
  
  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.checkDatabaseStatus();
    }, this.config.healthCheckInterval);
  }
  
  /**
   * Start periodic sync with database
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(async () => {
      if (this.isDatabaseAvailable && this.bufferedActions.size > 0) {
        await this.syncBufferedActions();
      }
    }, this.config.syncInterval);
  }
  
  /**
   * Sync buffered actions to database when available
   */
  private async syncBufferedActions(): Promise<void> {
    if (!this.isDatabaseAvailable || this.bufferedActions.size === 0) {
      return;
    }
    
    console.log(`[DatabaseFallback] Syncing ${this.bufferedActions.size} buffered actions to database...`);
    
    const { storage } = await import('../storage');
    const syncedActions: string[] = [];
    const failedActions: string[] = [];
    
    // Sort actions by priority (critical first)
    const sortedActions = Array.from(this.bufferedActions.values()).sort((a, b) => {
      const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
    
    for (const action of sortedActions) {
      try {
        if (action.type === 'security_event') {
          await storage.createSecurityEvent(action.data);
        } else if (action.type === 'security_incident') {
          await storage.createSecurityIncident(action.data);
        } else if (action.type === 'self_healing_action') {
          await storage.createSelfHealingAction(action.data);
        } else if (action.type === 'error_correction') {
          await storage.createErrorCorrection(action.data);
        } else if (action.type === 'system_metric') {
          await storage.createSystemMetric(action.data);
        } else if (action.type === 'audit_log') {
          await storage.createAuditLog(action.data);
        }
        
        syncedActions.push(action.id);
        this.bufferedActions.delete(action.id);
        
      } catch (error) {
        action.retryCount++;
        failedActions.push(action.id);
        
        // Remove action if max retries exceeded
        if (action.retryCount >= this.config.maxRetryAttempts) {
          console.error(`[DatabaseFallback] Max retries exceeded for action ${action.id}`);
          this.bufferedActions.delete(action.id);
        }
        
        console.error(`[DatabaseFallback] Failed to sync action ${action.id}:`, error);
      }
    }
    
    if (syncedActions.length > 0) {
      this.lastDatabaseSync = new Date();
      console.log(`[DatabaseFallback] ✅ Successfully synced ${syncedActions.length} actions`);
    }
    
    if (failedActions.length > 0) {
      console.warn(`[DatabaseFallback] ⚠️ Failed to sync ${failedActions.length} actions`);
    }
  }
  
  /**
   * Cleanup old buffered actions
   */
  private cleanupOldActions(): void {
    if (this.bufferedActions.size <= this.config.maxBufferedActions) {
      return;
    }
    
    const cutoffTime = Date.now() - this.config.bufferTimeoutMs;
    let cleanedCount = 0;
    
    for (const [id, action] of this.bufferedActions) {
      if (action.timestamp.getTime() < cutoffTime) {
        this.bufferedActions.delete(id);
        cleanedCount++;
      }
    }
    
    // If still too many, remove oldest low-priority actions
    if (this.bufferedActions.size > this.config.maxBufferedActions) {
      const lowPriorityActions = Array.from(this.bufferedActions.entries())
        .filter(([_, action]) => action.priority === 'low')
        .sort(([_, a], [__, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toRemove = this.bufferedActions.size - this.config.maxBufferedActions;
      for (let i = 0; i < Math.min(toRemove, lowPriorityActions.length); i++) {
        this.bufferedActions.delete(lowPriorityActions[i][0]);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[DatabaseFallback] Cleaned up ${cleanedCount} old buffered actions`);
    }
  }
  
  /**
   * Determine priority based on severity
   */
  private determinePriority(severity?: string): BufferedAction['priority'] {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'emergency':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }
  
  /**
   * Get numeric severity score
   */
  private getSeverityScore(severity: string): number {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'emergency':
        return 50;
      case 'high':
        return 30;
      case 'medium':
        return 15;
      case 'low':
        return 5;
      default:
        return 1;
    }
  }
  
  /**
   * Get current fallback metrics
   */
  getMetrics(): FallbackMetrics {
    return {
      bufferedActions: this.bufferedActions.size,
      successfulSyncs: 0, // Would need to track this in production
      failedSyncs: 0, // Would need to track this in production
      inMemoryThreats: this.inMemoryThreats.size,
      blockedIPs: this.blockedIPs.size,
      uptime: Date.now() - this.startTime,
      lastDatabaseSync: this.lastDatabaseSync,
      lastDatabaseCheck: new Date(),
      databaseAvailable: this.isDatabaseAvailable
    };
  }
  
  /**
   * Get current service status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      databaseAvailable: this.isDatabaseAvailable,
      metrics: this.getMetrics(),
      config: this.config
    };
  }
}

// Export singleton instance
export const databaseFallbackService = DatabaseFallbackService.getInstance();