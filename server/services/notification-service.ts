import { storage } from "../storage";
import { getWebSocketService } from "../websocket";
import { NotificationCategory, NotificationPriority, EventType } from "@shared/schema";
import type { 
  NotificationEvent, 
  InsertNotificationEvent, 
  UserNotificationPreferences,
  StatusUpdate,
  InsertStatusUpdate
} from "@shared/schema";

export interface NotificationPayload {
  userId?: string;
  category: keyof typeof NotificationCategory;
  eventType: string;
  priority: keyof typeof NotificationPriority;
  title: string;
  message: string;
  payload?: Record<string, any>;
  requiresAction?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
}

export interface StatusUpdatePayload {
  entityType: string;
  entityId: string;
  previousStatus?: string;
  currentStatus: string;
  statusDetails?: Record<string, any>;
  progressPercentage?: number;
  estimatedCompletion?: Date;
  userId?: string;
  updatedBy?: string;
  isPublic?: boolean;
}

export interface NotificationTemplate {
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  requiresAction?: boolean;
}

class NotificationService {
  // Notification templates for different events
  private templates: Record<string, NotificationTemplate> = {
    [EventType.DOCUMENT_UPLOADED]: {
      title: "Document Uploaded Successfully",
      message: "Your document '{{filename}}' has been uploaded and is being processed.",
    },
    [EventType.DOCUMENT_PROCESSING]: {
      title: "Document Processing",
      message: "Your document '{{filename}}' is currently being processed.",
    },
    [EventType.DOCUMENT_PROCESSED]: {
      title: "Document Processing Complete",
      message: "Your document '{{filename}}' has been processed successfully.",
      actionUrl: "/dashboard/documents/{{documentId}}",
      actionLabel: "View Document",
    },
    [EventType.DOCUMENT_VERIFIED]: {
      title: "Document Verified",
      message: "Your document '{{filename}}' has been verified and approved.",
      actionUrl: "/dashboard/documents/{{documentId}}",
      actionLabel: "Download Certificate",
    },
    [EventType.DOCUMENT_REJECTED]: {
      title: "Document Verification Failed",
      message: "Your document '{{filename}}' requires attention. {{reason}}",
      actionUrl: "/dashboard/documents/{{documentId}}",
      actionLabel: "Review Requirements",
      requiresAction: true,
    },
    [EventType.SECURITY_BREACH]: {
      title: "🚨 Security Alert",
      message: "Potential security breach detected from {{location}}. Please review your account activity.",
      actionUrl: "/dashboard/security",
      actionLabel: "Review Security",
      requiresAction: true,
    },
    [EventType.SECURITY_LOGIN]: {
      title: "New Login Detected",
      message: "New login from {{location}} at {{time}}.",
    },
    [EventType.SECURITY_FAILED_LOGIN]: {
      title: "Failed Login Attempt",
      message: "Failed login attempt detected from {{location}}.",
    },
    [EventType.FRAUD_DETECTED]: {
      title: "🚨 Fraud Alert",
      message: "High-risk activity detected. Risk Score: {{riskScore}}/100",
      actionUrl: "/dashboard/security",
      actionLabel: "Review Activity",
      requiresAction: true,
    },
    [EventType.BIOMETRIC_ENROLLED]: {
      title: "Biometric Profile Created",
      message: "{{biometricType}} profile has been successfully enrolled.",
    },
    [EventType.BIOMETRIC_VERIFIED]: {
      title: "Biometric Verification Success",
      message: "{{biometricType}} verification completed with {{confidence}}% confidence.",
    },
    [EventType.BIOMETRIC_FAILED]: {
      title: "Biometric Verification Failed",
      message: "{{biometricType}} verification failed. Please try again.",
      requiresAction: true,
    },
    [EventType.ADMIN_REVIEW_REQUIRED]: {
      title: "Admin Review Required",
      message: "{{documentType}} submission from {{username}} requires manual review.",
      actionUrl: "/admin/documents/review/{{documentId}}",
      actionLabel: "Review Document",
      requiresAction: true,
    },
    [EventType.SYSTEM_HEALTH_ALERT]: {
      title: "System Health Alert",
      message: "System component '{{component}}' is experiencing issues.",
      actionUrl: "/admin/monitoring",
      actionLabel: "View Details",
    },
    [EventType.SYSTEM_MAINTENANCE]: {
      title: "Scheduled Maintenance",
      message: "System maintenance scheduled for {{startTime}} - {{endTime}}.",
    },
    [EventType.USER_REGISTERED]: {
      title: "Welcome to DHA Digital Services",
      message: "Your account has been created successfully. Complete your profile to get started.",
      actionUrl: "/dashboard/profile",
      actionLabel: "Complete Profile",
    }
  };

  /**
   * Create and deliver a notification
   */
  async createNotification(payload: NotificationPayload): Promise<NotificationEvent> {
    // Process template if available
    const template = this.templates[payload.eventType];
    let processedTitle = payload.title;
    let processedMessage = payload.message;
    let actionUrl = payload.actionUrl;
    let actionLabel = payload.actionLabel;
    let requiresAction = payload.requiresAction;

    if (template) {
      processedTitle = this.processTemplate(template.title, payload.payload || {});
      processedMessage = this.processTemplate(template.message, payload.payload || {});
      actionUrl = actionUrl || this.processTemplate(template.actionUrl || "", payload.payload || {});
      actionLabel = actionLabel || template.actionLabel;
      requiresAction = requiresAction !== undefined ? requiresAction : template.requiresAction;
    }

    // Check user preferences before creating notification
    if (payload.userId) {
      const shouldNotify = await this.shouldNotifyUser(payload.userId, payload.category, payload.priority);
      if (!shouldNotify) {
        console.log(`Notification blocked by user preferences: ${payload.userId} - ${payload.eventType}`);
        return {} as NotificationEvent; // Return empty to indicate blocked
      }
    }

    // Create notification in storage
    const notificationData: InsertNotificationEvent = {
      userId: payload.userId,
      category: payload.category,
      eventType: payload.eventType,
      priority: payload.priority,
      title: processedTitle,
      message: processedMessage,
      payload: payload.payload,
      requiresAction: requiresAction || false,
      actionUrl,
      actionLabel,
      expiresAt: payload.expiresAt,
      relatedEntityType: payload.relatedEntityType,
      relatedEntityId: payload.relatedEntityId,
      createdBy: payload.createdBy,
    };

    const notification = await storage.createNotification(notificationData);

    // Deliver notification via WebSocket
    await this.deliverNotification(notification);

    // Send additional notifications based on preferences
    if (payload.userId) {
      await this.sendAdditionalNotifications(payload.userId, notification);
    }

    return notification;
  }

  /**
   * Create a status update with optional notification
   */
  async createStatusUpdate(
    payload: StatusUpdatePayload, 
    notifyUser: boolean = true,
    customNotification?: Partial<NotificationPayload>
  ): Promise<StatusUpdate> {
    // Create status update
    const statusUpdateData: InsertStatusUpdate = {
      entityType: payload.entityType,
      entityId: payload.entityId,
      previousStatus: payload.previousStatus,
      currentStatus: payload.currentStatus,
      statusDetails: payload.statusDetails,
      progressPercentage: payload.progressPercentage,
      estimatedCompletion: payload.estimatedCompletion,
      userId: payload.userId,
      updatedBy: payload.updatedBy,
      isPublic: payload.isPublic || false,
    };

    const statusUpdate = await storage.createStatusUpdate(statusUpdateData);

    // Deliver via WebSocket for real-time updates
    const wsService = getWebSocketService();
    if (wsService && payload.userId) {
      wsService.sendToUser(payload.userId, "status:update", {
        statusUpdate,
        entityType: payload.entityType,
        entityId: payload.entityId
      });
    }

    // Create notification if requested
    if (notifyUser && payload.userId) {
      const notificationPayload: NotificationPayload = {
        userId: payload.userId,
        category: "system",
        eventType: this.getEventTypeFromStatus(payload.entityType, payload.currentStatus),
        priority: this.getPriorityFromStatus(payload.currentStatus),
        title: customNotification?.title || `Status Update: ${payload.entityType}`,
        message: customNotification?.message || `Status changed to ${payload.currentStatus}`,
        payload: {
          entityType: payload.entityType,
          entityId: payload.entityId,
          previousStatus: payload.previousStatus,
          currentStatus: payload.currentStatus,
          progressPercentage: payload.progressPercentage
        },
        relatedEntityType: payload.entityType,
        relatedEntityId: payload.entityId,
        ...customNotification
      };

      await this.createNotification(notificationPayload);
    }

    return statusUpdate;
  }

  /**
   * Send system-wide notification to all users or specific role
   */
  async sendSystemNotification(
    payload: Omit<NotificationPayload, 'userId'>,
    targetRole?: 'user' | 'admin'
  ): Promise<NotificationEvent[]> {
    const users = await storage.getAllUsers();
    const targetUsers = targetRole 
      ? users.filter(user => user.role === targetRole)
      : users;

    const notifications: NotificationEvent[] = [];

    for (const user of targetUsers) {
      const notification = await this.createNotification({
        ...payload,
        userId: user.id
      });
      
      if (notification.id) { // Check if notification was created (not blocked)
        notifications.push(notification);
      }
    }

    return notifications;
  }

  /**
   * Send critical alert that bypasses user preferences
   */
  async sendCriticalAlert(payload: NotificationPayload): Promise<NotificationEvent> {
    const notificationData: InsertNotificationEvent = {
      userId: payload.userId,
      category: payload.category,
      eventType: payload.eventType,
      priority: "critical",
      title: payload.title,
      message: payload.message,
      payload: payload.payload,
      requiresAction: true,
      actionUrl: payload.actionUrl,
      actionLabel: payload.actionLabel,
      expiresAt: payload.expiresAt,
      relatedEntityType: payload.relatedEntityType,
      relatedEntityId: payload.relatedEntityId,
      createdBy: payload.createdBy,
    };

    const notification = await storage.createNotification(notificationData);

    // Deliver immediately via WebSocket
    await this.deliverNotification(notification, true);

    // Send emergency notifications regardless of preferences
    if (payload.userId) {
      // Could implement email, SMS, etc. for critical alerts
      console.log(`CRITICAL ALERT for user ${payload.userId}: ${payload.title}`);
    }

    return notification;
  }

  /**
   * Get notifications for a user with optional filtering
   */
  async getNotifications(
    userId: string,
    filters?: {
      category?: string;
      priority?: string;
      isRead?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<NotificationEvent[]> {
    return storage.getNotifications(userId, filters);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await storage.markNotificationAsRead(notificationId);
    
    // Notify via WebSocket for real-time UI updates
    const notification = await storage.getNotification(notificationId);
    if (notification) {
      const wsService = getWebSocketService();
      wsService?.sendToUser(notification.userId!, "notification:read", { notificationId });
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await storage.markAllNotificationsAsRead(userId);
    
    // Notify via WebSocket
    const wsService = getWebSocketService();
    wsService?.sendToUser(userId, "notifications:all_read", { userId });
  }

  /**
   * Get user's notification preferences
   */
  async getUserPreferences(userId: string): Promise<UserNotificationPreferences | undefined> {
    let preferences = await storage.getUserNotificationPreferences(userId);
    
    // Create default preferences if none exist
    if (!preferences) {
      preferences = await storage.createUserNotificationPreferences({
        userId,
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        categories: {
          system: { enabled: true, priority: "medium" },
          security: { enabled: true, priority: "high" },
          document: { enabled: true, priority: "high" },
          fraud: { enabled: true, priority: "critical" },
          biometric: { enabled: true, priority: "medium" },
          admin: { enabled: true, priority: "medium" }
        },
        quietHours: null
      });
    }
    
    return preferences;
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string, 
    updates: Partial<UserNotificationPreferences>
  ): Promise<void> {
    await storage.updateUserNotificationPreferences(userId, updates);
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return storage.getUnreadNotificationCount(userId);
  }

  // Private helper methods

  private async shouldNotifyUser(
    userId: string, 
    category: string, 
    priority: string
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    if (!preferences) return true;

    // Always allow critical notifications
    if (priority === "critical") return true;

    // Check if category is enabled
    const categorySettings = preferences.categories as Record<string, any>;
    if (!categorySettings[category]?.enabled) return false;

    // Check quiet hours
    if (preferences.quietHours && this.isQuietHours(preferences.quietHours as any)) {
      // Only allow high and critical during quiet hours
      return priority === "high" || priority === "critical";
    }

    return true;
  }

  private isQuietHours(quietHours: { start: string; end: string; enabled: boolean }): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private async deliverNotification(
    notification: NotificationEvent, 
    isCritical: boolean = false
  ): Promise<void> {
    const wsService = getWebSocketService();
    if (!wsService || !notification.userId) return;

    // Update delivery timestamp
    await storage.markNotificationAsRead(notification.id);

    // Send via WebSocket
    const eventName = isCritical ? "notification:critical" : "notification:new";
    wsService.sendToUser(notification.userId, eventName, notification);

    // Broadcast to admin role for critical system events
    if (notification.category === "system" && notification.priority === "critical") {
      wsService.sendToRole("admin", "system:critical_alert", notification);
    }
  }

  private async sendAdditionalNotifications(
    userId: string, 
    notification: NotificationEvent
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    if (!preferences) return;

    // Email notifications (placeholder - would integrate with email service)
    if (preferences.emailNotifications && notification.priority !== "low") {
      console.log(`Email notification: ${notification.title} to user ${userId}`);
    }

    // SMS notifications for critical alerts (placeholder)
    if (preferences.smsNotifications && notification.priority === "critical") {
      console.log(`SMS notification: ${notification.title} to user ${userId}`);
    }
  }

  private processTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private getEventTypeFromStatus(entityType: string, status: string): string {
    if (entityType === "document") {
      switch (status) {
        case "processing": return EventType.DOCUMENT_PROCESSING;
        case "completed": return EventType.DOCUMENT_PROCESSED;
        case "verified": return EventType.DOCUMENT_VERIFIED;
        case "rejected": return EventType.DOCUMENT_REJECTED;
        default: return "status.update";
      }
    }
    
    return "status.update";
  }

  private getPriorityFromStatus(status: string): keyof typeof NotificationPriority {
    switch (status.toLowerCase()) {
      case "failed":
      case "rejected":
      case "error":
        return "high";
      case "completed":
      case "verified":
        return "medium";
      default:
        return "low";
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;