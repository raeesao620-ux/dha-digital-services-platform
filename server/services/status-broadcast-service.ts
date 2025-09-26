import { getWebSocketService } from "../websocket";
import { storage } from "../storage";
import { notificationService } from "./notification-service";
import { EventType, NotificationCategory, NotificationPriority } from "@shared/schema";
import type { StatusUpdate, Document, DhaApplication } from "@shared/schema";

export interface StatusBroadcast {
  entityType: string;
  entityId: string;
  status: string;
  progress?: number;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  isPublic: boolean;
  updatedBy?: string;
}

export interface ProgressUpdate {
  entityType: string;
  entityId: string;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  progress: number;
  estimatedTimeRemaining?: number;
  message: string;
}

class StatusBroadcastService {
  private progressTrackers = new Map<string, ProgressUpdate>();
  private statusSubscriptions = new Map<string, Set<string>>(); // entityKey -> userIds

  /**
   * Broadcast status update to subscribed users and relevant channels
   */
  async broadcastStatusUpdate(statusUpdate: StatusBroadcast): Promise<void> {
    const wsService = getWebSocketService();
    if (!wsService) return;

    const entityKey = `${statusUpdate.entityType}:${statusUpdate.entityId}`;
    const channel = `status:${statusUpdate.entityType}:${statusUpdate.entityId}`;

    // Store status update in database
    const storedUpdate = await storage.createStatusUpdate({
      entityType: statusUpdate.entityType,
      entityId: statusUpdate.entityId,
      currentStatus: statusUpdate.status,
      statusDetails: { 
        message: statusUpdate.message,
        ...statusUpdate.metadata 
      },
      progressPercentage: statusUpdate.progress,
      isPublic: statusUpdate.isPublic,
      updatedBy: statusUpdate.updatedBy
    });

    // Broadcast to all subscribers
    wsService.sendToRole("admin", "status:update", {
      entityType: statusUpdate.entityType,
      entityId: statusUpdate.entityId,
      status: storedUpdate,
      broadcast: statusUpdate
    });

    // Send to specific entity channel
    const io = wsService as any;
    io.io?.to(channel).emit("status:update", {
      entityType: statusUpdate.entityType,
      entityId: statusUpdate.entityId,
      status: storedUpdate,
      broadcast: statusUpdate
    });

    // Send notifications for critical status changes
    if (statusUpdate.status === "failed" || statusUpdate.status === "error") {
      await this.sendFailureNotification(statusUpdate);
    } else if (statusUpdate.status === "completed" || statusUpdate.status === "approved") {
      await this.sendSuccessNotification(statusUpdate);
    }

    console.log(`Status broadcast: ${entityKey} -> ${statusUpdate.status}`);
  }

  /**
   * Update progress for a specific entity
   */
  async updateProgress(update: ProgressUpdate): Promise<void> {
    const entityKey = `${update.entityType}:${update.entityId}`;
    this.progressTrackers.set(entityKey, update);

    const wsService = getWebSocketService();
    if (wsService) {
      const channel = `status:${update.entityType}:${update.entityId}`;
      const io = wsService as any;
      io.io?.to(channel).emit("progress:update", update);
      
      // Also send to admins
      wsService.sendToRole("admin", "progress:update", update);
    }

    // Update status if this represents a significant milestone
    if (update.completedSteps === update.totalSteps) {
      await this.broadcastStatusUpdate({
        entityType: update.entityType,
        entityId: update.entityId,
        status: "completed",
        progress: 100,
        message: "Processing completed successfully",
        timestamp: new Date(),
        isPublic: true
      });
    } else if (update.progress >= 50 && !this.hasReachedMidpoint(entityKey)) {
      await this.broadcastStatusUpdate({
        entityType: update.entityType,
        entityId: update.entityId,
        status: "processing",
        progress: update.progress,
        message: `Processing: ${update.currentStep}`,
        timestamp: new Date(),
        isPublic: true
      });
    }
  }

  /**
   * Document processing status updates
   */
  async updateDocumentStatus(documentId: string, status: string, details?: any): Promise<void> {
    const document = await storage.getDocument(documentId);
    if (!document) return;

    const progressMap: Record<string, number> = {
      "uploaded": 10,
      "processing": 30,
      "extracting": 50,
      "validating": 70,
      "analyzing": 80,
      "completed": 100,
      "failed": 0
    };

    await this.broadcastStatusUpdate({
      entityType: "document",
      entityId: documentId,
      status,
      progress: progressMap[status] || 0,
      message: this.getDocumentStatusMessage(status, document.filename),
      metadata: { ...details, processingStatus: document.processingStatus },
      timestamp: new Date(),
      isPublic: true
    });

    // Update progress tracker for detailed steps
    if (status === "processing") {
      await this.updateProgress({
        entityType: "document",
        entityId: documentId,
        currentStep: "Text Extraction",
        totalSteps: 5,
        completedSteps: 1,
        progress: 20,
        message: "Extracting text and metadata from document"
      });
    } else if (status === "extracting") {
      await this.updateProgress({
        entityType: "document",
        entityId: documentId,
        currentStep: "Data Validation",
        totalSteps: 5,
        completedSteps: 2,
        progress: 40,
        message: "Validating extracted data against requirements"
      });
    }
  }

  /**
   * DHA application status updates
   */
  async updateApplicationStatus(applicationId: string, status: string, details?: any): Promise<void> {
    const application = await storage.getDhaApplication(applicationId);
    if (!application) return;

    const progressMap: Record<string, number> = {
      "submitted": 10,
      "under_review": 30,
      "additional_docs_required": 50,
      "background_check": 70,
      "final_review": 85,
      "approved": 100,
      "rejected": 0,
      "pending": 20
    };

    await this.broadcastStatusUpdate({
      entityType: "application",
      entityId: applicationId,
      status,
      progress: progressMap[status] || 0,
      message: this.getApplicationStatusMessage(status, application.applicationType),
      metadata: { ...details, applicationType: application.applicationType },
      timestamp: new Date(),
      isPublic: true
    });
  }

  /**
   * System health status updates
   */
  async updateSystemHealth(component: string, status: 'healthy' | 'warning' | 'critical', details: any): Promise<void> {
    await this.broadcastStatusUpdate({
      entityType: "system",
      entityId: component,
      status,
      message: `System component ${component}: ${status}`,
      metadata: details,
      timestamp: new Date(),
      isPublic: false // Only for admins
    });

    // Send critical system alerts
    if (status === 'critical') {
      const wsService = getWebSocketService();
      wsService?.sendToRole("admin", "alert:critical", {
        id: `system-${component}-${Date.now()}`,
        type: 'system',
        severity: 'critical',
        title: `Critical System Alert: ${component}`,
        message: `System component ${component} is in critical state`,
        source: 'System Health Monitor',
        metadata: details,
        isResolved: false,
        createdAt: new Date()
      });
    }
  }

  /**
   * Security event status updates
   */
  async updateSecurityEventStatus(eventId: string, status: string, details?: any): Promise<void> {
    await this.broadcastStatusUpdate({
      entityType: "security",
      entityId: eventId,
      status,
      message: `Security event: ${status}`,
      metadata: details,
      timestamp: new Date(),
      isPublic: false // Only for admins
    });
  }

  /**
   * Get current progress for an entity
   */
  getProgress(entityType: string, entityId: string): ProgressUpdate | null {
    const entityKey = `${entityType}:${entityId}`;
    return this.progressTrackers.get(entityKey) || null;
  }

  /**
   * Subscribe user to status updates for specific entity
   */
  subscribeToEntity(userId: string, entityType: string, entityId: string): void {
    const entityKey = `${entityType}:${entityId}`;
    if (!this.statusSubscriptions.has(entityKey)) {
      this.statusSubscriptions.set(entityKey, new Set());
    }
    this.statusSubscriptions.get(entityKey)!.add(userId);
  }

  /**
   * Unsubscribe user from status updates
   */
  unsubscribeFromEntity(userId: string, entityType: string, entityId: string): void {
    const entityKey = `${entityType}:${entityId}`;
    const subscribers = this.statusSubscriptions.get(entityKey);
    if (subscribers) {
      subscribers.delete(userId);
      if (subscribers.size === 0) {
        this.statusSubscriptions.delete(entityKey);
      }
    }
  }

  /**
   * Clean up old progress trackers
   */
  cleanupOldTrackers(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const entries = Array.from(this.progressTrackers.entries());
    for (const [key, tracker] of entries) {
      if (tracker.progress >= 100 || Date.now() - oneHourAgo > 0) {
        this.progressTrackers.delete(key);
      }
    }
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(statusUpdate: StatusBroadcast): Promise<void> {
    let userId: string | undefined;
    
    if (statusUpdate.entityType === "document") {
      const document = await storage.getDocument(statusUpdate.entityId);
      userId = document?.userId;
    } else if (statusUpdate.entityType === "application") {
      const application = await storage.getDhaApplication(statusUpdate.entityId);
      userId = application?.applicantId; // Assuming applicantId maps to userId
    }

    if (userId) {
      await notificationService.createNotification({
        userId,
        category: statusUpdate.entityType === "document" ? "DOCUMENT" : "USER",
        eventType: EventType.PROCESSING_FAILED,
        priority: "HIGH",
        title: "Processing Failed",
        message: statusUpdate.message,
        actionUrl: `/${statusUpdate.entityType}s/${statusUpdate.entityId}`,
        actionLabel: "View Details"
      });
    }
  }

  /**
   * Send success notification
   */
  private async sendSuccessNotification(statusUpdate: StatusBroadcast): Promise<void> {
    let userId: string | undefined;
    
    if (statusUpdate.entityType === "document") {
      const document = await storage.getDocument(statusUpdate.entityId);
      userId = document?.userId;
    } else if (statusUpdate.entityType === "application") {
      const application = await storage.getDhaApplication(statusUpdate.entityId);
      userId = application?.applicantId;
    }

    if (userId) {
      await notificationService.createNotification({
        userId,
        category: statusUpdate.entityType === "document" ? "DOCUMENT" : "USER",
        eventType: EventType.PROCESSING_COMPLETED,
        priority: "MEDIUM",
        title: "Processing Completed",
        message: statusUpdate.message,
        actionUrl: `/${statusUpdate.entityType}s/${statusUpdate.entityId}`,
        actionLabel: "View Results"
      });
    }
  }

  private getDocumentStatusMessage(status: string, filename: string): string {
    const messages: Record<string, string> = {
      "uploaded": `Document "${filename}" has been uploaded successfully`,
      "processing": `Processing document "${filename}"...`,
      "extracting": `Extracting data from "${filename}"...`,
      "validating": `Validating extracted data from "${filename}"...`,
      "analyzing": `Analyzing document "${filename}" for compliance...`,
      "completed": `Document "${filename}" has been processed successfully`,
      "failed": `Processing failed for document "${filename}"`
    };
    return messages[status] || `Document "${filename}" status: ${status}`;
  }

  private getApplicationStatusMessage(status: string, applicationType: string): string {
    const messages: Record<string, string> = {
      "submitted": `${applicationType} application has been submitted`,
      "under_review": `Your ${applicationType} application is under review`,
      "additional_docs_required": `Additional documents required for ${applicationType} application`,
      "background_check": `Background check in progress for ${applicationType} application`,
      "final_review": `${applicationType} application in final review stage`,
      "approved": `${applicationType} application has been approved`,
      "rejected": `${applicationType} application has been rejected`,
      "pending": `${applicationType} application is pending review`
    };
    return messages[status] || `${applicationType} application status: ${status}`;
  }

  private hasReachedMidpoint(entityKey: string): boolean {
    const tracker = this.progressTrackers.get(entityKey);
    return tracker ? tracker.progress >= 50 : false;
  }
}

// Initialize cleanup interval
const statusBroadcastService = new StatusBroadcastService();

// Clean up old trackers every 10 minutes
setInterval(() => {
  statusBroadcastService.cleanupOldTrackers();
}, 10 * 60 * 1000);

export { statusBroadcastService };
export default statusBroadcastService;