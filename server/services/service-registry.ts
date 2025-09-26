/**
 * Service Registry for Self-Healing Architecture
 * Provides graceful dependency handling and service discovery
 */

// Utility function to safely import services with fallbacks
export async function safeImportService(servicePath: string, exportName: string): Promise<any> {
  try {
    const module = await import(servicePath);
    const service = module[exportName];
    
    if (!service) {
      console.warn(`⚠️ Service '${exportName}' not found in '${servicePath}', using fallback`);
      return createFallbackService(exportName);
    }
    
    return service;
  } catch (error) {
    console.warn(`⚠️ Failed to import '${servicePath}': ${error.message}, using fallback`);
    return createFallbackService(exportName);
  }
}

// Create a fallback service that implements basic EventEmitter functionality
function createFallbackService(serviceName: string) {
  const EventEmitter = require('events');
  
  return new (class FallbackService extends EventEmitter {
    constructor() {
      super();
      this.serviceName = serviceName;
    }

    async start() {
      console.log(`📝 Fallback service '${serviceName}' started`);
      return true;
    }

    async stop() {
      console.log(`📝 Fallback service '${serviceName}' stopped`);
      return true;
    }

    async logEvent(event: any) {
      console.log(`📝 Fallback '${serviceName}' logged event:`, event);
      return { id: 'fallback-' + Date.now() };
    }

    async detectThreat(data: any) {
      console.log(`📝 Fallback '${serviceName}' threat detection (no-op)`);
      return null;
    }

    async correctError(error: any) {
      console.log(`📝 Fallback '${serviceName}' error correction (no-op)`);
      return { success: false, reason: 'fallback service' };
    }

    async sendAlert(alert: any) {
      console.log(`📝 Fallback '${serviceName}' alert sent:`, alert);
      return true;
    }
  })();
}

// Service registry for commonly used services
export const serviceRegistry = {
  async getQueenUltraAiService() {
    return await safeImportService('./queen-ultra-ai', 'queenUltraAI') ||
           await safeImportService('./queen-ultra-ai', 'queenUltraAiService');
  },

  async getAuditTrailService() {
    return await safeImportService('./audit-trail-service', 'auditTrailService');
  },

  async getErrorTrackingService() {
    return await safeImportService('./error-tracking', 'errorTrackingService');
  },

  async getFraudDetectionService() {
    return await safeImportService('./fraud-detection', 'fraudDetectionService');
  },

  async getIntelligentAlertingService() {
    return await safeImportService('./intelligent-alerting-service', 'intelligentAlertingService');
  },

  async getEnhancedMonitoringService() {
    return await safeImportService('./enhanced-monitoring-service', 'enhancedMonitoringService');
  },

  async getSecurityCorrelationEngine() {
    return await safeImportService('./security-correlation-engine', 'securityCorrelationEngine');
  },

  async getAutonomousMonitoringBot() {
    return await safeImportService('./autonomous-monitoring-bot', 'AutonomousMonitoringBot');
  },

  async getAutoRecoveryService() {
    return await safeImportService('./auto-recovery', 'AutoRecoveryService');
  }
};

export default serviceRegistry;