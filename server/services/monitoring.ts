import { storage } from "../storage";
import { InsertSystemMetric } from "@shared/schema";
import os from "os";
import { EventEmitter } from "events";

export interface SystemHealth {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  timestamp: Date;
}

export interface SecurityMetrics {
  threatsBlocked: number;
  suspiciousActivities: number;
  falsePositives: number;
  detectionRate: number;
  timestamp: Date;
}

export interface RegionalStatus {
  region: string;
  nodes: number;
  threatLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "online" | "warning" | "offline";
}

export class MonitoringService extends EventEmitter {
  private metricsInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;

  constructor() {
    super();
  }

  startMonitoring(intervalMs = 30000) {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;
    this.collectMetrics(); // Collect immediately

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log("Security monitoring started");
  }

  stopMonitoring() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.isCollecting = false;
    console.log("Security monitoring stopped");
  }

  private async collectMetrics() {
    try {
      const systemHealth = await this.getSystemHealth();
      const securityMetrics = await this.getSecurityMetrics();
      const quantumStatus = await this.getQuantumStatus(); // Collect quantum status

      // Store system metrics
      await this.storeSystemMetrics(systemHealth);

      // Emit real-time events
      this.emit('systemHealth', systemHealth);
      this.emit('securityMetrics', securityMetrics);
      this.emit('quantumStatus', quantumStatus); // Emit quantum status

      // Check for alerts
      await this.checkAlerts(systemHealth, securityMetrics);

    } catch (error) {
      console.error("Metrics collection error:", error);
    }
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const networkUsage = await this.getNetworkUsage();
    const storageUsage = await this.getStorageUsage();

    return {
      cpu: Math.round(cpuUsage),
      memory: Math.round(memoryUsage),
      network: Math.round(networkUsage),
      storage: Math.round(storageUsage),
      timestamp: new Date()
    };
  }

  private async getCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;

    return 100 - ~~(100 * idle / total);
  }

  private getMemoryUsage(): number {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return (usedMem / totalMem) * 100;
  }

  private async getNetworkUsage(): Promise<number> {
    // Simplified network usage calculation
    // In production, use proper network monitoring tools
    const networkInterfaces = os.networkInterfaces();
    let activeInterfaces = 0;
    let totalInterfaces = 0;

    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        totalInterfaces += interfaces.length;
        activeInterfaces += interfaces.filter(iface => !iface.internal).length;
      }
    }

    return totalInterfaces > 0 ? (activeInterfaces / totalInterfaces) * 100 : 0;
  }

  private async getStorageUsage(): Promise<number> {
    // Simplified storage usage
    // In production, use disk usage monitoring tools
    return Math.random() * 100; // Placeholder
  }

  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent security events
    const recentEvents = await storage.getSecurityEvents(undefined, 1000);
    const todayEvents = recentEvents.filter(event => event.createdAt > oneDayAgo);

    // Get fraud alerts
    const fraudAlerts = await storage.getFraudAlerts();
    const todayFraudAlerts = fraudAlerts.filter(alert => alert.createdAt > oneDayAgo);

    const threatsBlocked = todayEvents.filter(event => 
      event.eventType.includes("blocked") || 
      event.eventType.includes("prevented") ||
      event.severity === "high"
    ).length;

    const suspiciousActivities = todayFraudAlerts.filter(alert => 
      alert.riskScore >= 60 && !alert.isResolved
    ).length;

    const falsePositives = todayFraudAlerts.filter(alert => 
      alert.isResolved && alert.riskScore < 40
    ).length;

    const totalThreats = threatsBlocked + suspiciousActivities;
    const detectionRate = totalThreats > 0 ? ((threatsBlocked / totalThreats) * 100) : 100;

    return {
      threatsBlocked,
      suspiciousActivities,
      falsePositives,
      detectionRate: Math.round(detectionRate * 10) / 10,
      timestamp: now
    };
  }

  private async storeSystemMetrics(health: SystemHealth) {
    const metrics: InsertSystemMetric[] = [
      {
        metricType: "cpu",
        value: health.cpu,
        unit: "percent",
        timestamp: health.timestamp
      },
      {
        metricType: "memory",
        value: health.memory,
        unit: "percent",
        timestamp: health.timestamp
      },
      {
        metricType: "network",
        value: health.network,
        unit: "percent",
        timestamp: health.timestamp
      },
      {
        metricType: "storage",
        value: health.storage,
        unit: "percent",
        timestamp: health.timestamp
      }
    ];

    for (const metric of metrics) {
      await storage.createSystemMetric(metric);
    }
  }

  private async checkAlerts(health: SystemHealth, security: SecurityMetrics) {
    // CPU alert
    if (health.cpu > 90) {
      await this.createAlert("HIGH_CPU_USAGE", "high", { cpuUsage: health.cpu });
    }

    // Memory alert
    if (health.memory > 85) {
      await this.createAlert("HIGH_MEMORY_USAGE", "medium", { memoryUsage: health.memory });
    }

    // Security alerts
    if (security.suspiciousActivities > 10) {
      await this.createAlert("HIGH_SUSPICIOUS_ACTIVITY", "high", { 
        count: security.suspiciousActivities 
      });
    }

    if (security.detectionRate < 95) {
      await this.createAlert("LOW_DETECTION_RATE", "medium", { 
        detectionRate: security.detectionRate 
      });
    }
  }

  private async createAlert(type: string, severity: string, details: any) {
    await storage.createSecurityEvent({
      eventType: `system_alert_${type.toLowerCase()}`,
      severity: severity as "low" | "medium" | "high",
      details: {
        alertType: type,
        ...details,
        timestamp: new Date()
      }
    });

    this.emit('alert', { type, severity, details });
  }

  async getMetricsHistory(metricType?: string, hours = 24) {
    return await storage.getSystemMetrics(metricType, hours);
  }

  async getRegionalStatus(): Promise<RegionalStatus[]> {
    try {
      // In production, this would get real regional data
      const regionalStatus: RegionalStatus[] = [
        {
          region: "North America",
          nodes: 47,
          threatLevel: "LOW" as const,
          status: "online" as const
        },
        {
          region: "Europe",
          nodes: 32,
          threatLevel: "MEDIUM" as const,
          status: "warning" as const
        },
        {
          region: "Asia Pacific",
          nodes: 28,
          threatLevel: "LOW" as const,
          status: "online" as const
        },
        {
          region: "Global Threat Intel",
          nodes: 107,
          threatLevel: "HIGH" as const,
          status: "online" as const
        }
      ];
      return regionalStatus;
    } catch (error) {
      console.error("Error getting regional status:", error);
      return []; // Always return an array
    }
  }

  async generateSystemReport() {
    const health = await this.getSystemHealth();
    const security = await this.getSecurityMetrics();
    const regional = await this.getRegionalStatus();
    const quantum = await this.getQuantumStatus();


    return {
      timestamp: new Date(),
      systemHealth: health,
      securityMetrics: security,
      regionalStatus: regional,
      quantumStatus: quantum,
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version
    };
  }

  async getQuantumStatus(): Promise<any> {
    try {
      return {
        entropy: 0.95,
        nextRotation: "24h",
        keysGenerated: 42,
        activeTunnels: 7
      };
    } catch (error) {
      console.error("Error getting quantum status:", error);
      return {
        entropy: 0.0,
        nextRotation: "Unknown",
        keysGenerated: 0,
        activeTunnels: 0
      };
    }
  }
}

export const monitoringService = new MonitoringService();