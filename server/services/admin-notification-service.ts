import { storage } from "../storage";
import { getWebSocketService } from "../websocket";
import { notificationService } from "./notification-service";
import { monitoringService } from "./monitoring";
import { fraudDetectionService } from "./fraud-detection";
import { NotificationCategory, NotificationPriority, EventType } from "@shared/schema";
import type { 
  NotificationEvent, 
  User,
  SecurityEvent,
  FraudAlert,
  ErrorLog,
  Document 
} from "@shared/schema";

export interface AdminNotificationRule {
  id: string;
  name: string;
  eventType: string;
  condition: (data: any) => boolean;
  priority: keyof typeof NotificationPriority;
  autoEscalate?: boolean;
  escalateAfterMinutes?: number;
  assignToRoles?: string[];
  notificationTemplate: {
    title: string;
    message: string;
    actionLabel?: string;
    actionUrl?: string;
  };
}

export interface AdminAlert {
  id: string;
  type: 'security' | 'fraud' | 'system' | 'document' | 'user';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata: Record<string, any>;
  isResolved: boolean;
  assignedToAdmin?: string;
  escalatedAt?: Date;
  createdAt: Date;
  resolvedAt?: Date;
}

class AdminNotificationService {
  private notificationRules: AdminNotificationRule[] = [
    // Document review rules
    {
      id: "doc-review-required",
      name: "Document Review Required",
      eventType: EventType.DOCUMENT_PROCESSED,
      condition: (data) => data.requiresManualReview === true,
      priority: "high",
      autoEscalate: true,
      escalateAfterMinutes: 30,
      assignToRoles: ["admin"],
      notificationTemplate: {
        title: "Document Review Required",
        message: "{{documentType}} from {{username}} requires manual verification",
        actionLabel: "Review Document",
        actionUrl: "/admin/documents/review/{{documentId}}"
      }
    },
    
    // Security event rules
    {
      id: "security-critical",
      name: "Critical Security Event",
      eventType: EventType.SECURITY_BREACH,
      condition: (data) => data.severity === "critical",
      priority: "critical",
      autoEscalate: false,
      assignToRoles: ["admin"],
      notificationTemplate: {
        title: "🚨 Critical Security Alert",
        message: "{{eventType}}: {{details}}",
        actionLabel: "Investigate",
        actionUrl: "/admin/security/events/{{eventId}}"
      }
    },
    
    // Fraud detection rules
    {
      id: "fraud-high-risk",
      name: "High Risk Fraud Detection",
      eventType: EventType.FRAUD_DETECTED,
      condition: (data) => data.riskScore >= 80,
      priority: "critical",
      autoEscalate: true,
      escalateAfterMinutes: 15,
      assignToRoles: ["admin"],
      notificationTemplate: {
        title: "🚨 High-Risk Fraud Alert",
        message: "Risk Score: {{riskScore}}/100 - {{alertType}}",
        actionLabel: "Review Alert",
        actionUrl: "/admin/fraud/alerts/{{alertId}}"
      }
    },
    
    // System health rules
    {
      id: "system-health-critical",
      name: "Critical System Health Issue",
      eventType: EventType.SYSTEM_HEALTH_ALERT,
      condition: (data) => data.status === "critical" || data.severity === "critical",
      priority: "critical",
      autoEscalate: true,
      escalateAfterMinutes: 5,
      assignToRoles: ["admin"],
      notificationTemplate: {
        title: "⚠️ Critical System Issue",
        message: "{{component}}: {{message}}",
        actionLabel: "View Monitoring",
        actionUrl: "/admin/monitoring/{{component}}"
      }
    },
    
    // User account rules
    {
      id: "user-suspicious-activity",
      name: "Suspicious User Activity",
      eventType: EventType.SECURITY_SUSPICIOUS_ACTIVITY,
      condition: (data) => data.confidenceLevel >= 0.8,
      priority: "high",
      autoEscalate: true,
      escalateAfterMinutes: 60,
      assignToRoles: ["admin"],
      notificationTemplate: {
        title: "Suspicious Activity Detected",
        message: "User {{username}}: {{activityType}}",
        actionLabel: "Review User",
        actionUrl: "/admin/users/{{userId}}"
      }
    },
    
    // Error logging rules
    {
      id: "critical-error",
      name: "Critical Application Error",
      eventType: "error.critical",
      condition: (data) => data.severity === "critical",
      priority: "critical",
      autoEscalate: false,
      assignToRoles: ["admin"],
      notificationTemplate: {
        title: "Critical Application Error",
        message: "{{errorType}}: {{message}}",
        actionLabel: "View Errors",
        actionUrl: "/admin/monitoring/errors"
      }
    }
  ];

  private activeAlerts = new Map<string, AdminAlert>();
  private escalationTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Initialize admin notification service with periodic checks
   */
  async initialize(): Promise<void> {
    console.log("Initializing Admin Notification Service...");
    
    // Set up periodic system checks
    setInterval(() => this.performSystemChecks(), 5 * 60 * 1000); // Every 5 minutes
    setInterval(() => this.checkEscalations(), 60 * 1000); // Every minute
    
    // Perform initial checks
    await this.performSystemChecks();
    
    console.log("Admin Notification Service initialized");
  }

  /**
   * Process an event against all admin notification rules
   */
  async processEvent(eventType: string, eventData: any, sourceUserId?: string): Promise<void> {
    const matchingRules = this.notificationRules.filter(rule => 
      rule.eventType === eventType && rule.condition(eventData)
    );

    for (const rule of matchingRules) {
      await this.createAdminNotification(rule, eventData, sourceUserId);
    }
  }

  /**
   * Create admin notification from rule
   */
  private async createAdminNotification(
    rule: AdminNotificationRule, 
    eventData: any,
    sourceUserId?: string
  ): Promise<NotificationEvent[]> {
    const notifications: NotificationEvent[] = [];
    
    // Get all admin users
    const adminUsers = await this.getAdminUsers(rule.assignToRoles);
    
    for (const admin of adminUsers) {
      // Process template
      const processedTitle = this.processTemplate(rule.notificationTemplate.title, eventData);
      const processedMessage = this.processTemplate(rule.notificationTemplate.message, eventData);
      const actionUrl = rule.notificationTemplate.actionUrl 
        ? this.processTemplate(rule.notificationTemplate.actionUrl, eventData)
        : undefined;

      // Create notification
      const notification = await notificationService.createNotification({
        userId: admin.id,
        category: "admin",
        eventType: rule.eventType,
        priority: rule.priority,
        title: processedTitle,
        message: processedMessage,
        payload: eventData,
        requiresAction: true,
        actionUrl,
        actionLabel: rule.notificationTemplate.actionLabel,
        relatedEntityType: eventData.entityType,
        relatedEntityId: eventData.entityId,
        createdBy: sourceUserId
      });

      notifications.push(notification);

      // Set up auto-escalation if configured
      if (rule.autoEscalate && rule.escalateAfterMinutes) {
        this.scheduleEscalation(notification.id, rule.escalateAfterMinutes);
      }
    }

    // Send immediate WebSocket notifications for critical alerts
    if (rule.priority === "critical") {
      await this.broadcastCriticalAlert({
        id: notifications[0]?.id || "",
        type: this.getAlertTypeFromEvent(rule.eventType),
        severity: rule.priority,
        title: this.processTemplate(rule.notificationTemplate.title, eventData),
        message: this.processTemplate(rule.notificationTemplate.message, eventData),
        source: rule.name,
        relatedEntityId: eventData.entityId,
        relatedEntityType: eventData.entityType,
        metadata: eventData,
        isResolved: false,
        createdAt: new Date()
      });
    }

    return notifications;
  }

  /**
   * Get unresolved admin alerts
   */
  async getActiveAlerts(): Promise<AdminAlert[]> {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Resolve an admin alert
   */
  async resolveAlert(alertId: string, adminId: string, resolution?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.isResolved = true;
      alert.resolvedAt = new Date();
      
      // Cancel escalation timer
      const timer = this.escalationTimers.get(alertId);
      if (timer) {
        clearTimeout(timer);
        this.escalationTimers.delete(alertId);
      }

      // Create resolution notification for other admins
      await notificationService.sendSystemNotification({
        category: "admin",
        eventType: EventType.ADMIN_ACTION_COMPLETED,
        priority: "low",
        title: "Alert Resolved",
        message: `Alert "${alert.title}" has been resolved`,
        payload: { alertId, resolvedBy: adminId, resolution }
      }, "admin");

      // Remove from active alerts
      this.activeAlerts.delete(alertId);
      
      // Broadcast resolution via WebSocket
      const wsService = getWebSocketService();
      wsService?.sendToRole("admin", "alert:resolved", { alertId, resolvedBy: adminId });
    }
  }

  /**
   * Assign alert to specific admin
   */
  async assignAlert(alertId: string, adminId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.assignedToAdmin = adminId;
      
      // Notify assigned admin
      await notificationService.createNotification({
        userId: adminId,
        category: "admin",
        eventType: "admin.alert_assigned",
        priority: "medium",
        title: "Alert Assigned",
        message: `You have been assigned: ${alert.title}`,
        requiresAction: true,
        relatedEntityId: alertId
      });

      // Broadcast assignment
      const wsService = getWebSocketService();
      wsService?.sendToRole("admin", "alert:assigned", { alertId, assignedTo: adminId });
    }
  }

  /**
   * Escalate an alert
   */
  private async escalateAlert(notificationId: string): Promise<void> {
    const notification = await storage.getNotification(notificationId);
    if (!notification || notification.isRead) {
      return; // Already read, no need to escalate
    }

    // Create escalation notification
    await notificationService.sendSystemNotification({
      category: "admin", 
      eventType: EventType.ADMIN_ESCALATION,
      priority: "critical",
      title: `🚨 ESCALATED: ${notification.title}`,
      message: `Unresolved alert escalated: ${notification.message}`,
      payload: {
        originalNotificationId: notificationId,
        escalatedAt: new Date()
      },
      actionUrl: notification.actionUrl,
      actionLabel: "Handle Escalation",
      requiresAction: true
    }, "admin");

    // Mark escalation in active alerts
    const alertId = notification.relatedEntityId;
    if (alertId) {
      const alert = this.activeAlerts.get(alertId);
      if (alert) {
        alert.escalatedAt = new Date();
      }
    }

    // Send critical alert via WebSocket
    const wsService = getWebSocketService();
    wsService?.sendToRole("admin", "alert:escalated", {
      originalNotification: notification,
      escalatedAt: new Date()
    });
  }

  /**
   * Perform periodic system health checks
   */
  private async performSystemChecks(): Promise<void> {
    try {
      // Check system health
      const systemHealth = await monitoringService.getSystemHealth();
      if (systemHealth.status === "error" || systemHealth.status === "critical") {
        await this.processEvent(EventType.SYSTEM_HEALTH_ALERT, {
          component: "system",
          status: systemHealth.status,
          message: "System health check failed",
          severity: systemHealth.status,
          details: systemHealth
        });
      }

      // Check for unresolved fraud alerts
      const fraudAlerts = await storage.getFraudAlerts(undefined, false);
      const highRiskAlerts = fraudAlerts.filter(alert => alert.riskScore >= 80);
      
      for (const alert of highRiskAlerts) {
        const timeSinceCreated = Date.now() - alert.createdAt.getTime();
        const hoursOld = timeSinceCreated / (1000 * 60 * 60);
        
        if (hoursOld > 2) { // Alert older than 2 hours
          await this.processEvent(EventType.FRAUD_DETECTED, {
            alertId: alert.id,
            riskScore: alert.riskScore,
            alertType: alert.alertType,
            hoursOld: Math.round(hoursOld)
          });
        }
      }

      // Check for recent critical errors
      const recentErrors = await storage.getRecentErrors(1, 10); // Last hour
      const criticalErrors = recentErrors.filter(error => error.severity === "critical");
      
      for (const error of criticalErrors) {
        await this.processEvent("error.critical", {
          errorId: error.id,
          errorType: error.errorType,
          message: error.message,
          severity: error.severity,
          timestamp: error.timestamp
        });
      }

      // Check for documents awaiting review
      const pendingDocuments = await storage.getAllDocuments();
      const reviewRequired = pendingDocuments.filter(doc => 
        doc.processingStatus === "completed" && !doc.isVerified
      );
      
      if (reviewRequired.length > 10) { // Threshold check
        await this.processEvent("document.review_backlog", {
          count: reviewRequired.length,
          documents: reviewRequired.slice(0, 5).map(doc => ({
            id: doc.id,
            filename: doc.filename,
            createdAt: doc.createdAt
          }))
        });
      }

    } catch (error) {
      console.error("System checks error:", error);
    }
  }

  /**
   * Check for escalations that need to be triggered
   */
  private checkEscalations(): void {
    // This is handled by individual timers, but we can add additional logic here
    console.log(`Active escalation timers: ${this.escalationTimers.size}`);
  }

  /**
   * Schedule escalation for a notification
   */
  private scheduleEscalation(notificationId: string, delayMinutes: number): void {
    const timer = setTimeout(() => {
      this.escalateAlert(notificationId);
      this.escalationTimers.delete(notificationId);
    }, delayMinutes * 60 * 1000);

    this.escalationTimers.set(notificationId, timer);
  }

  /**
   * Broadcast critical alert to all admin users
   */
  private async broadcastCriticalAlert(alert: AdminAlert): Promise<void> {
    this.activeAlerts.set(alert.id, alert);
    
    const wsService = getWebSocketService();
    wsService?.sendToRole("admin", "alert:critical", alert);
    
    // Also send individual notifications
    const adminUsers = await this.getAdminUsers();
    for (const admin of adminUsers) {
      wsService?.sendToUser(admin.id, "notification:critical", {
        title: alert.title,
        message: alert.message,
        alertId: alert.id,
        severity: alert.severity
      });
    }
  }

  /**
   * Get admin users with optional role filtering
   */
  private async getAdminUsers(roles?: string[]): Promise<User[]> {
    const allUsers = await storage.getAllUsers();
    return allUsers.filter(user => 
      user.role === "admin" && 
      user.isActive &&
      (!roles || roles.includes(user.role))
    );
  }

  /**
   * Process template with data substitution
   */
  private processTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Map event type to alert type
   */
  private getAlertTypeFromEvent(eventType: string): AdminAlert['type'] {
    if (eventType.startsWith('security.')) return 'security';
    if (eventType.startsWith('fraud.')) return 'fraud';
    if (eventType.startsWith('system.')) return 'system';
    if (eventType.startsWith('document.')) return 'document';
    if (eventType.startsWith('user.')) return 'user';
    return 'system';
  }
}

export const adminNotificationService = new AdminNotificationService();
export default adminNotificationService;