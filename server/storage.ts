// PostgreSQL Storage Implementation for Railway Deployment
// This replaces the volatile MemStorage with persistent PostgreSQL database

import { PostgreSQLStorage } from "./postgresql-storage";

// Export the storage interface for backward compatibility
export interface IStorage {
  // User management
  getUser(id: string): Promise<any>;
  getUserByEmail(email: string): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  createUser(user: any): Promise<any>;
  updateUser(id: string, updates: any): Promise<any>;
  getUsers(): Promise<any[]>;

  // Conversation management
  getConversation(id: string): Promise<any>;
  getUserConversations(userId: string): Promise<any[]>;
  createConversation(conversation: any): Promise<any>;
  getConversations(): Promise<any[]>;

  // Message management
  getMessages(conversationId: string): Promise<any[]>;
  createMessage(message: any): Promise<any>;

  // Document management
  getDocument(id: string): Promise<any>;
  getUserDocuments(userId: string): Promise<any[]>;
  createDocument(document: any): Promise<any>;
  getDocuments(): Promise<any[]>;

  // Security management
  createSecurityEvent(event: any): Promise<any>;
  getSecurityEvents(userId: string): Promise<any[]>;
  getAllSecurityEvents(): Promise<any[]>;

  // System metrics
  createSystemMetric(metric: any): Promise<any>;
  getSystemMetrics(): Promise<any[]>;

  // Audit and compliance methods
  createAuditLog(auditLog: any): Promise<any>;
  getAuditLogs(filters: any): Promise<any[]>;
  createComplianceEvent(event: any): Promise<any>;
  getComplianceReport(regulation: string, startDate: Date, endDate: Date): Promise<any>;
  
  // User behavior profile methods
  getUserBehaviorProfile(userId: string): Promise<any>;
  createUserBehaviorProfile(profile: any): Promise<any>;
  updateUserBehaviorProfile(userId: string, updates: any): Promise<any>;

  // AI Bot Session methods
  getAiBotSession(id: string): Promise<any>;
  getUserAiBotSessions(userId: string): Promise<any[]>;
  createAiBotSession(session: any): Promise<any>;
  updateAiBotSession(id: string, updates: any): Promise<any>;
  deactivateAiBotSession(id: string): Promise<any>;

  // AI Command Interface methods
  getAiCommandInterface(id: string): Promise<any>;
  getSessionAiCommands(sessionId: string): Promise<any[]>;
  createAiCommandInterface(command: any): Promise<any>;
  updateAiCommandInterface(id: string, updates: any): Promise<any>;
  getAiCommandsByStatus(status: string): Promise<any[]>;

  // Statistics
  getStats(): Promise<any>;

  // Self-Healing Architecture methods
  createSelfHealingAction(action: any): Promise<any>;
  getSelfHealingActions(filters?: any): Promise<any[]>;
  updateSelfHealingAction(id: string, updates: any): Promise<any>;
  
  createSystemHealthSnapshot(snapshot: any): Promise<any>;
  getSystemHealthSnapshots(limit?: number): Promise<any[]>;
  getLatestSystemHealthSnapshot(): Promise<any>;
  
  createSecurityIncident(incident: any): Promise<any>;
  getSecurityIncidents(filters?: any): Promise<any[]>;
  updateSecurityIncident(id: string, updates: any): Promise<any>;
  
  createErrorCorrection(correction: any): Promise<any>;
  getErrorCorrections(filters?: any): Promise<any[]>;
  updateErrorCorrection(id: string, updates: any): Promise<any>;
  
  createHealthCheckResult(result: any): Promise<any>;
  getHealthCheckResults(checkId?: string): Promise<any[]>;
  
  createFailoverEvent(event: any): Promise<any>;
  getFailoverEvents(serviceId?: string): Promise<any[]>;
  updateFailoverEvent(id: string, updates: any): Promise<any>;
  
  createPerformanceBaseline(baseline: any): Promise<any>;
  getPerformanceBaselines(serviceName?: string): Promise<any[]>;
  updatePerformanceBaseline(id: string, updates: any): Promise<any>;
  
  createAlertRule(rule: any): Promise<any>;
  getAlertRules(): Promise<any[]>;
  updateAlertRule(id: string, updates: any): Promise<any>;
  
  createCircuitBreakerState(state: any): Promise<any>;
  getCircuitBreakerState(serviceName: string): Promise<any>;
  updateCircuitBreakerState(serviceName: string, updates: any): Promise<any>;
  
  createUptimeIncident(incident: any): Promise<any>;
  getUptimeIncidents(serviceId?: string): Promise<any[]>;
  updateUptimeIncident(id: string, updates: any): Promise<any>;
  
  createAutonomousOperation(operation: any): Promise<any>;
  getAutonomousOperations(filters?: any): Promise<any[]>;
  updateAutonomousOperation(id: string, updates: any): Promise<any>;
  
  createMaintenanceTask(task: any): Promise<any>;
  getMaintenanceTasks(filters?: any): Promise<any[]>;
  updateMaintenanceTask(id: string, updates: any): Promise<any>;
  
  createGovernmentComplianceAudit(audit: any): Promise<any>;
  getGovernmentComplianceAudits(auditType?: string): Promise<any[]>;
  updateGovernmentComplianceAudit(id: string, updates: any): Promise<any>;
  
  // Additional methods for specific functionality
  getFraudAlerts(userId?: string, resolved?: boolean): Promise<any[]>;
  createSecurityMetric(metric: any): Promise<any>;
  getSecurityMetrics(filters?: any): Promise<any[]>;
  createBiometricProfile(profile: any): Promise<any>;
  getBiometricProfile(userId: string): Promise<any>;
  updateBiometricProfile(userId: string, updates: any): Promise<any>;
  
  // Error logging
  createErrorLog(errorLog: any): Promise<any>;
  getErrorLogs(filters?: any): Promise<any[]>;
  
  // Additional methods that might be called by services
  getAllCircuitBreakerStates(): Promise<any[]>;
  createSecurityRule(rule: any): Promise<any>;
  getSecurityRules(): Promise<any[]>;
  updateSecurityRule(id: string, updates: any): Promise<any>;
}

// Create and export PostgreSQL storage instance
// CRITICAL: This replaces MemStorage to enable Railway deployment
export const storage = new PostgreSQLStorage();

console.log('✅ PostgreSQL storage initialized - MemStorage replaced for Railway deployment');

// Re-export types for backward compatibility
export type {
  User, InsertUser,
  Conversation, InsertConversation,
  Message, InsertMessage,
  Document, InsertDocument,
  SecurityEvent, InsertSecurityEvent,
  FraudAlert, InsertFraudAlert,
  SystemMetric, InsertSystemMetric,
  AuditLog, InsertAuditLog,
  ComplianceEvent, InsertComplianceEvent,
  UserBehaviorProfile, InsertUserBehaviorProfile,
  AiBotSession, InsertAiBotSession,
  AiCommandInterface, InsertAiCommandInterface,
  AiBotMode, AiCommandStatus
} from "@shared/schema";