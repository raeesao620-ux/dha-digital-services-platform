import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { autonomousMonitoringBot } from './autonomous-monitoring-bot';
import { selfHealingService } from './self-healing-service';
import { enhancedErrorDetectionService } from './enhanced-error-detection';
import { proactiveMaintenanceService } from './proactive-maintenance-service';
import { intelligentAlertingService } from './intelligent-alerting-service';
import { storage } from '../storage';

export interface MonitoringWebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'health_update' | 'alert' | 'autonomous_action' | 'incident' | 'maintenance' | 'error' | 'status' | 'analysis_update' | 'test';
  data?: any;
  timestamp?: string;
  channels?: string[];
}

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  connectedAt: Date;
  lastPing: Date;
  isAlive: boolean;
}

/**
 * WebSocket Monitoring Service
 * Provides real-time monitoring updates to connected clients
 */
export class WebSocketMonitoringService {
  private static instance: WebSocketMonitoringService;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private isActive = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly METRICS_BROADCAST_INTERVAL = 5000; // 5 seconds
  private readonly MAX_CLIENTS = 100;

  private constructor() {}

  static getInstance(): WebSocketMonitoringService {
    if (!WebSocketMonitoringService.instance) {
      WebSocketMonitoringService.instance = new WebSocketMonitoringService();
    }
    return WebSocketMonitoringService.instance;
  }

  /**
   * Initialize WebSocket server
   */
  public async initialize(server: Server): Promise<void> {
    if (this.wss) {
      console.log('[WebSocketMonitoring] Already initialized');
      return;
    }

    console.log('[WebSocketMonitoring] Initializing WebSocket monitoring service...');

    try {
      // Create WebSocket server
      this.wss = new WebSocketServer({
        server,
        path: '/ws/monitoring',
        maxPayload: 16 * 1024, // 16KB
        perMessageDeflate: true
      });

      // Setup connection handling
      this.wss.on('connection', (socket, request) => {
        this.handleConnection(socket, request);
      });

      this.wss.on('error', (error) => {
        console.error('[WebSocketMonitoring] WebSocket server error:', error);
        this.handleWebSocketError(error);
      });

      // Setup event listeners for monitoring services
      this.setupServiceListeners();

      // Start heartbeat monitoring
      this.startHeartbeat();

      // Start metrics broadcasting
      this.startMetricsBroadcast();

      this.isActive = true;
      console.log('[WebSocketMonitoring] WebSocket monitoring service initialized');

    } catch (error) {
      console.error('[WebSocketMonitoring] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: any): void {
    if (this.clients.size >= this.MAX_CLIENTS) {
      console.log('[WebSocketMonitoring] Max clients reached, rejecting connection');
      socket.close(1013, 'Server overloaded');
      return;
    }

    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPing: new Date(),
      isAlive: true
    };

    this.clients.set(clientId, client);

    console.log(`[WebSocketMonitoring] Client connected: ${clientId} (${this.clients.size} total clients)`);

    // Setup client event handlers with error handling
    socket.on('message', (data) => {
      try {
        this.handleClientMessage(client, data);
      } catch (error) {
        console.error(`[WebSocketMonitoring] Error handling message from client ${clientId}:`, error);
        this.sendErrorToClient(client, 'Message processing failed');
      }
    });

    socket.on('error', (error) => {
      console.error(`[WebSocketMonitoring] Client ${clientId} error:`, error);
      this.handleClientError(client, error);
    });

    socket.on('close', (code, reason) => {
      console.log(`[WebSocketMonitoring] Client ${clientId} disconnected: ${code} ${reason}`);
      this.handleClientDisconnect(clientId, code, reason);
    });

    socket.on('pong', () => {
      client.isAlive = true;
      client.lastPing = new Date();
    });

    // Send initial connection success message
    this.sendToClient(client, {
      type: 'status',
      data: { connected: true, clientId, timestamp: new Date() }
    });

    // Send welcome message
    this.sendToClient(client, {
      type: 'status',
      data: {
        connected: true,
        clientId: clientId,
        timestamp: new Date().toISOString(),
        availableChannels: ['health', 'alerts', 'autonomous_actions', 'incidents', 'maintenance', 'errors']
      }
    });

    // Send initial system status
    this.sendInitialStatus(client);
  }

  /**
   * Handle client message
   */
  private async handleClientMessage(client: WebSocketClient, data: any): Promise<void> {
    try {
      const message: MonitoringWebSocketMessage = JSON.parse(Buffer.isBuffer(data) ? data.toString() : data.toString());

      switch (message.type) {
        case 'subscribe':
          await this.handleSubscription(client, message.channels || []);
          break;

        case 'unsubscribe':
          await this.handleUnsubscription(client, message.channels || []);
          break;

        default:
          console.log(`[WebSocketMonitoring] Unknown message type from ${client.id}: ${message.type}`);
      }

    } catch (error) {
      console.error(`[WebSocketMonitoring] Error handling message from ${client.id}:`, error);
      this.sendToClient(client, {
        type: 'error',
        data: { message: 'Invalid message format' },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle client subscription
   */
  private async handleSubscription(client: WebSocketClient, channels: string[]): Promise<void> {
    for (const channel of channels) {
      if (this.isValidChannel(channel)) {
        client.subscriptions.add(channel);
        console.log(`[WebSocketMonitoring] Client ${client.id} subscribed to ${channel}`);
      }
    }

    this.sendToClient(client, {
      type: 'status',
      data: {
        subscribed: Array.from(client.subscriptions),
        timestamp: new Date().toISOString()
      }
    });

    // Send recent data for subscribed channels
    await this.sendRecentData(client);
  }

  /**
   * Handle client unsubscription
   */
  private async handleUnsubscription(client: WebSocketClient, channels: string[]): Promise<void> {
    for (const channel of channels) {
      client.subscriptions.delete(channel);
      console.log(`[WebSocketMonitoring] Client ${client.id} unsubscribed from ${channel}`);
    }

    this.sendToClient(client, {
      type: 'status',
      data: {
        subscribed: Array.from(client.subscriptions),
        timestamp: new Date().toISOString()
      }
    });
  }


  /**
   * Setup service event listeners
   */
  private setupServiceListeners(): void {
    // Autonomous monitoring bot events
    autonomousMonitoringBot.on('healthCheck', (data) => {
      this.broadcast('health', {
        type: 'health_update',
        data: {
          overall: data.status,
          snapshot: data.snapshot,
          timestamp: new Date().toISOString()
        }
      });
    });

    autonomousMonitoringBot.on('actionCompleted', (data) => {
      this.broadcast('autonomous_actions', {
        type: 'autonomous_action',
        data: {
          action: data,
          status: 'completed',
          timestamp: new Date().toISOString()
        }
      });
    });

    autonomousMonitoringBot.on('incidentCreated', (data) => {
      this.broadcast('incidents', {
        type: 'incident',
        data: {
          incident: data,
          status: 'created',
          timestamp: new Date().toISOString()
        }
      });
    });

    // Self-healing service events
    selfHealingService.on('healingActionCompleted', (data) => {
      this.broadcast('autonomous_actions', {
        type: 'autonomous_action',
        data: {
          action: data.action,
          service: data.serviceName,
          result: data.result,
          status: 'healing_completed',
          timestamp: new Date().toISOString()
        }
      });
    });

    selfHealingService.on('circuitBreakerOpened', (data) => {
      this.broadcast('alerts', {
        type: 'alert',
        data: {
          title: `Circuit Breaker Opened: ${data.serviceName}`,
          description: `Circuit breaker opened for ${data.serviceName} after ${data.failureCount} failures`,
          severity: 'high',
          category: 'availability',
          service: data.serviceName,
          timestamp: new Date().toISOString()
        }
      });
    });

    selfHealingService.on('circuitBreakerClosed', (data) => {
      this.broadcast('alerts', {
        type: 'alert',
        data: {
          title: `Circuit Breaker Closed: ${data.serviceName}`,
          description: `Circuit breaker closed for ${data.serviceName} - service recovered`,
          severity: 'info',
          category: 'availability',
          service: data.serviceName,
          resolved: true,
          autoResolved: true,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Enhanced error detection events
    enhancedErrorDetectionService.on('patternMatched', (data) => {
      this.broadcast('alerts', {
        type: 'alert',
        data: {
          title: `Error Pattern Detected: ${data.pattern.description}`,
          description: `Pattern "${data.pattern.id}" matched with ${(data.pattern.confidence * 100).toFixed(1)}% confidence`,
          severity: data.pattern.severity,
          category: data.pattern.category,
          timestamp: new Date().toISOString()
        }
      });
    });

    enhancedErrorDetectionService.on('errorEscalated', (data) => {
      this.broadcast('incidents', {
        type: 'incident',
        data: {
          incident: data.incident,
          pattern: data.pattern,
          error: data.error,
          status: 'escalated',
          timestamp: new Date().toISOString()
        }
      });
    });

    enhancedErrorDetectionService.on('analysisCompleted', (data) => {
      this.broadcast('health', {
        type: 'analysis_update',
        data: {
          errorCount: data.results.errorCount,
          patterns: data.results.patterns.length,
          anomalies: data.results.anomalies.length,
          correlations: data.results.correlations.length,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Proactive maintenance events
    proactiveMaintenanceService.on('maintenanceCompleted', (data) => {
      this.broadcast('maintenance', {
        type: 'maintenance',
        data: {
          task: data.schedule.name,
          type: data.schedule.type,
          result: data.result,
          status: 'completed',
          timestamp: new Date().toISOString()
        }
      });
    });

    proactiveMaintenanceService.on('capacityAlert', (data) => {
      this.broadcast('alerts', {
        type: 'alert',
        data: {
          title: `Capacity Alert: ${data.service}`,
          description: `Service ${data.service} will reach capacity limits in ${data.plan.timeToLimit} days`,
          severity: data.plan.timeToLimit <= 3 ? 'critical' : 'high',
          category: 'performance',
          service: data.service,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Intelligent alerting events
    intelligentAlertingService.on('smartAlertCreated', (data) => {
      this.broadcast('alerts', {
        type: 'alert',
        data: {
          smartAlert: data,
          title: data.title,
          description: data.description,
          severity: data.severity,
          category: data.category,
          rootCause: data.rootCauseAnalysis.primaryCause,
          timestamp: new Date().toISOString()
        }
      });
    });

    intelligentAlertingService.on('escalationExecuted', (data) => {
      this.broadcast('incidents', {
        type: 'incident',
        data: {
          escalation: data,
          level: data.level.level,
          rule: data.rule.name,
          status: 'escalated',
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of Array.from(this.clients)) {
        if (!client.isAlive) {
          console.log(`[WebSocketMonitoring] Terminating unresponsive client: ${clientId}`);
          client.socket.terminate();
          this.clients.delete(clientId);
        } else {
          client.isAlive = false;
          client.socket.ping();
        }
      }
    }, this.HEARTBEAT_INTERVAL);

    console.log('[WebSocketMonitoring] Heartbeat monitoring started');
  }

  /**
   * Start metrics broadcasting
   */
  private startMetricsBroadcast(): void {
    this.metricsInterval = setInterval(async () => {
      await this.broadcastSystemMetrics();
    }, this.METRICS_BROADCAST_INTERVAL);

    console.log('[WebSocketMonitoring] Metrics broadcasting started');
  }

  /**
   * Broadcast system metrics
   */
  private async broadcastSystemMetrics(): Promise<void> {
    try {
      const systemHealth = await autonomousMonitoringBot.getSystemHealthStatus();
      
      this.broadcast('health', {
        type: 'health_update',
        data: {
          ...systemHealth,
          connectedClients: this.clients.size,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[WebSocketMonitoring] Error broadcasting metrics:', error);
    }
  }

  /**
   * Send initial status to client
   */
  private async sendInitialStatus(client: WebSocketClient): Promise<void> {
    try {
      // Send current system health
      const systemHealth = await autonomousMonitoringBot.getSystemHealthStatus();
      this.sendToClient(client, {
        type: 'health_update',
        data: systemHealth,
        timestamp: new Date().toISOString()
      });

      // Send recent autonomous actions
      const recentActions = await autonomousMonitoringBot.getAutonomousOperationsHistory(10);
      this.sendToClient(client, {
        type: 'autonomous_action',
        data: { recentActions },
        timestamp: new Date().toISOString()
      });

      // Send active incidents
      const activeIncidents = await autonomousMonitoringBot.getActiveIncidents();
      this.sendToClient(client, {
        type: 'incident',
        data: { activeIncidents },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`[WebSocketMonitoring] Error sending initial status to ${client.id}:`, error);
    }
  }

  /**
   * Send recent data for subscribed channels
   */
  private async sendRecentData(client: WebSocketClient): Promise<void> {
    try {
      if (client.subscriptions.has('alerts')) {
        const recentAlerts = await this.getRecentAlerts();
        this.sendToClient(client, {
          type: 'alert',
          data: { recentAlerts },
          timestamp: new Date().toISOString()
        });
      }

      if (client.subscriptions.has('autonomous_actions')) {
        const recentActions = await autonomousMonitoringBot.getAutonomousOperationsHistory(5);
        this.sendToClient(client, {
          type: 'autonomous_action',
          data: { recentActions },
          timestamp: new Date().toISOString()
        });
      }

      if (client.subscriptions.has('maintenance')) {
        const maintenanceHistory = proactiveMaintenanceService.getMaintenanceHistory();
        this.sendToClient(client, {
          type: 'maintenance',
          data: { recentMaintenance: maintenanceHistory.slice(0, 5) },
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error(`[WebSocketMonitoring] Error sending recent data to ${client.id}:`, error);
    }
  }

  /**
   * Get recent alerts
   */
  private async getRecentAlerts(): Promise<any[]> {
    try {
      // Get recent notifications as alerts
      const notifications = await storage.getNotifications(undefined, {
        limit: 10,
        isArchived: false
      });

      return notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        description: notification.title || '',
        severity: notification.priority,
        category: notification.category,
        timestamp: notification.createdAt.toISOString(),
        resolved: notification.isRead
      }));

    } catch (error) {
      console.error('[WebSocketMonitoring] Error getting recent alerts:', error);
      return [];
    }
  }

  /**
   * Broadcast message to all subscribed clients
   */
  private broadcast(channel: string, message: MonitoringWebSocketMessage): void {
    let sentCount = 0;

    for (const client of Array.from(this.clients.values())) {
      if (client.subscriptions.has(channel) && client.socket.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(`[WebSocketMonitoring] Broadcast to ${sentCount} clients on channel: ${channel}`);
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocketClient, message: MonitoringWebSocketMessage): void {
    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        const messageWithTimestamp = {
          ...message,
          timestamp: message.timestamp || new Date().toISOString()
        };

        client.socket.send(JSON.stringify(messageWithTimestamp));
      }
    } catch (error) {
      console.error(`[WebSocketMonitoring] Error sending message to client ${client.id}:`, error);
      this.handleClientDisconnect(client.id, 1011, Buffer.from('Send error'));
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if channel is valid
   */
  private isValidChannel(channel: string): boolean {
    const validChannels = ['health', 'alerts', 'autonomous_actions', 'incidents', 'maintenance', 'errors'];
    return validChannels.includes(channel);
  }

  /**
   * Stop the WebSocket service
   */
  public async stop(): Promise<void> {
    console.log('[WebSocketMonitoring] Stopping WebSocket monitoring service...');

    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    // Close all client connections
    for (const client of Array.from(this.clients.values())) {
      client.socket.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.isActive = false;
    console.log('[WebSocketMonitoring] WebSocket monitoring service stopped');
  }

  /**
   * Get service status
   */
  public getStatus(): any {
    return {
      isActive: this.isActive,
      connectedClients: this.clients.size,
      maxClients: this.MAX_CLIENTS,
      heartbeatInterval: this.HEARTBEAT_INTERVAL,
      metricsInterval: this.METRICS_BROADCAST_INTERVAL,
      clientSubscriptions: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        subscriptions: Array.from(client.subscriptions),
        connectedAt: client.connectedAt,
        lastPing: client.lastPing
      }))
    };
  }

  /**
   * Force broadcast for testing
   */
  public forceBroadcast(channel: string, data: any): void {
    this.broadcast(channel, {
      type: 'test',
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle WebSocket server errors with recovery
   */
  private async handleWebSocketError(error: Error): Promise<void> {
    console.error('[WebSocketMonitoring] Attempting error recovery...');
    
    // Log error details
    await storage.createSecurityEvent({
      eventType: 'websocket_error',
      severity: 'high',
      details: { error: error.message, stack: error.stack },
      userId: 'system',
      ipAddress: 'localhost',
      userAgent: 'websocket-server'
    });

    // If error is critical, attempt restart
    if (error.message.includes('EADDRINUSE') || error.message.includes('listen')) {
      console.error('[WebSocketMonitoring] Critical error detected, attempting recovery...');
      setTimeout(() => {
        if (!this.isActive && this.wss) {
          console.log('[WebSocketMonitoring] Attempting to restart WebSocket server...');
        }
      }, 5000);
    }
  }

  /**
   * Send error message to client safely
   */
  private sendErrorToClient(client: WebSocketClient, errorMessage: string): void {
    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        this.sendToClient(client, {
          type: 'error',
          data: { 
            message: errorMessage,
            timestamp: new Date().toISOString(),
            clientId: client.id 
          }
        });
      }
    } catch (sendError) {
      console.error(`[WebSocketMonitoring] Failed to send error to client ${client.id}:`, sendError);
      // Force disconnect problematic client
      this.forceDisconnectClient(client.id);
    }
  }

  /**
   * Handle individual client errors
   */
  private async handleClientError(client: WebSocketClient, error: Error): Promise<void> {
    console.error(`[WebSocketMonitoring] Client ${client.id} error:`, error);
    
    // Log client error
    await storage.createSecurityEvent({
      eventType: 'client_error',
      severity: 'medium',
      details: { clientId: client.id, error: error.message },
      userId: client.id,
      ipAddress: 'websocket_client',
      userAgent: 'websocket'
    });

    // If client has too many errors, disconnect
    const clientErrors = (client as any).errorCount || 0;
    (client as any).errorCount = clientErrors + 1;
    
    if (clientErrors > 5) {
      console.warn(`[WebSocketMonitoring] Client ${client.id} exceeded error threshold, disconnecting`);
      this.forceDisconnectClient(client.id);
    }
  }

  /**
   * Handle client disconnection with cleanup
   */
  private handleClientDisconnect(clientId: string, code?: number, reason?: Buffer | string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`[WebSocketMonitoring] Client ${clientId} disconnected: ${code} ${reason}`);
    
    // Clean up client
    this.clients.delete(clientId);
    
    // Clear subscriptions
    client.subscriptions.clear();
    
    // Log disconnection
    storage.createSecurityEvent({
      eventType: 'client_disconnect',
      severity: 'low',
      details: { clientId, code, reason: reason?.toString() },
      userId: clientId,
      ipAddress: 'websocket_client',
      userAgent: 'websocket'
    }).catch(error => {
      console.error('[WebSocketMonitoring] Failed to log disconnection:', error);
    });
  }

  /**
   * Force disconnect a problematic client
   */
  private forceDisconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      client.socket.terminate();
      this.handleClientDisconnect(clientId, 1011, 'Forced disconnect');
    }
  }
}

// Export singleton instance
export const webSocketMonitoringService = WebSocketMonitoringService.getInstance();