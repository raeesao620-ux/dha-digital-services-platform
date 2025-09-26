
import { EventEmitter } from 'events';
import { WebSocketService } from '../websocket';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
  database: {
    connections: number;
    activeQueries: number;
    averageResponseTime: number;
  };
  application: {
    activeUsers: number;
    requestsPerMinute: number;
    errorRate: number;
    documentsGenerated: number;
  };
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  metric?: keyof SystemMetrics;
  value?: number;
  threshold?: number;
}

export class RealTimeMonitoring extends EventEmitter {
  private metrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private thresholds = {
    cpu: 80,
    memory: 85,
    disk: 90,
    errorRate: 5,
    responseTime: 2000
  };
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private wsService: WebSocketService) {
    super();
    this.startMonitoring();
  }

  public startMonitoring(intervalMs: number = 30000) { // 30 seconds
    if (this.isRunning) return;

    this.isRunning = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // Keep only last 100 metrics (about 50 minutes at 30s intervals)
        if (this.metrics.length > 100) {
          this.metrics = this.metrics.slice(-100);
        }

        // Check thresholds and generate alerts
        await this.checkThresholds(metrics);

        // Broadcast metrics to connected clients
        this.broadcastMetrics(metrics);

      } catch (error) {
        console.error('Monitoring error:', error);
        this.createAlert('critical', 'Monitoring Error', 
          `Failed to collect system metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, intervalMs);

    console.log('[Monitoring] Real-time monitoring started');
  }

  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('[Monitoring] Real-time monitoring stopped');
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const os = await import('os');
    const fs = await import('fs/promises');
    
    // CPU metrics
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    // Memory metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // Disk metrics (simplified - would need platform-specific code for production)
    let diskUsed = 0;
    let diskTotal = 0;
    try {
      const stats = await fs.stat(process.cwd());
      diskTotal = 100 * 1024 * 1024 * 1024; // Assume 100GB for demo
      diskUsed = diskTotal * 0.3; // Assume 30% used for demo
    } catch (error) {
      console.warn('Could not get disk stats:', error);
    }

    // Database metrics (would integrate with actual DB monitoring)
    const dbMetrics = {
      connections: 10, // Mock data
      activeQueries: 2,
      averageResponseTime: 150
    };

    // Application metrics (would integrate with actual app monitoring)
    const appMetrics = {
      activeUsers: this.wsService.getConnectedUserCount?.() || 0,
      requestsPerMinute: 45, // Mock data
      errorRate: 0.5,
      documentsGenerated: 12
    };

    return {
      timestamp: new Date(),
      cpu: {
        usage: this.calculateCPUUsage(cpus),
        cores: cpus.length,
        loadAverage: loadAvg
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100
      },
      disk: {
        used: diskUsed,
        total: diskTotal,
        percentage: diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0
      },
      network: {
        bytesIn: 1024 * 1024 * 10, // Mock data
        bytesOut: 1024 * 1024 * 8,
        connectionsActive: 25
      },
      database: dbMetrics,
      application: appMetrics
    };
  }

  private calculateCPUUsage(cpus: any[]): number {
    // Simplified CPU usage calculation
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return 100 - Math.floor((totalIdle / totalTick) * 100);
  }

  private async checkThresholds(metrics: SystemMetrics) {
    // CPU threshold check
    if (metrics.cpu.usage > this.thresholds.cpu) {
      this.createAlert('critical', 'High CPU Usage', 
        `CPU usage is ${metrics.cpu.usage}% (threshold: ${this.thresholds.cpu}%)`);
    }

    // Memory threshold check
    if (metrics.memory.percentage > this.thresholds.memory) {
      this.createAlert('critical', 'High Memory Usage',
        `Memory usage is ${metrics.memory.percentage.toFixed(1)}% (threshold: ${this.thresholds.memory}%)`);
    }

    // Disk threshold check
    if (metrics.disk.percentage > this.thresholds.disk) {
      this.createAlert('warning', 'High Disk Usage',
        `Disk usage is ${metrics.disk.percentage.toFixed(1)}% (threshold: ${this.thresholds.disk}%)`);
    }

    // Error rate threshold check
    if (metrics.application.errorRate > this.thresholds.errorRate) {
      this.createAlert('critical', 'High Error Rate',
        `Application error rate is ${metrics.application.errorRate}% (threshold: ${this.thresholds.errorRate}%)`);
    }

    // Database response time check
    if (metrics.database.averageResponseTime > this.thresholds.responseTime) {
      this.createAlert('warning', 'Slow Database Response',
        `Database response time is ${metrics.database.averageResponseTime}ms (threshold: ${this.thresholds.responseTime}ms)`);
    }
  }

  private createAlert(type: Alert['type'], title: string, message: string) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    // Emit alert event
    this.emit('alert', alert);

    // Broadcast alert to connected clients
    this.wsService.broadcast('system_alert', alert);

    console.log(`[Alert] ${type.toUpperCase()}: ${title} - ${message}`);
  }

  private broadcastMetrics(metrics: SystemMetrics) {
    // Broadcast simplified metrics to avoid overwhelming clients
    const simplifiedMetrics = {
      timestamp: metrics.timestamp,
      cpu: metrics.cpu.usage,
      memory: metrics.memory.percentage,
      disk: metrics.disk.percentage,
      activeUsers: metrics.application.activeUsers,
      requestsPerMinute: metrics.application.requestsPerMinute,
      errorRate: metrics.application.errorRate
    };

    this.wsService.broadcast('system_metrics', simplifiedMetrics);
  }

  // Public API methods
  public getLatestMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getMetricsHistory(hours: number = 1): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  public getAllAlerts(): Alert[] {
    return [...this.alerts];
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.wsService.broadcast('alert_resolved', { alertId });
      return true;
    }
    return false;
  }

  public updateThresholds(newThresholds: Partial<typeof this.thresholds>) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('[Monitoring] Thresholds updated:', this.thresholds);
  }

  public getSystemHealth(): 'healthy' | 'warning' | 'critical' {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.type === 'critical');
    const warningAlerts = activeAlerts.filter(a => a.type === 'warning');

    if (criticalAlerts.length > 0) return 'critical';
    if (warningAlerts.length > 0) return 'warning';
    return 'healthy';
  }
}

export let realTimeMonitoring: RealTimeMonitoring;

export function initializeRealTimeMonitoring(wsService: WebSocketService) {
  realTimeMonitoring = new RealTimeMonitoring(wsService);
  return realTimeMonitoring;
}
