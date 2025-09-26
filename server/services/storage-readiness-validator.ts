
import { db } from "../db";
import { storage } from "../storage";

export interface StorageReadinessReport {
  ready: boolean;
  timestamp: Date;
  database: {
    connected: boolean;
    poolStatus: any;
    tableCount: number;
    indexCount: number;
  };
  performance: {
    queryResponseTime: number;
    connectionLatency: number;
    throughput: number;
  };
  security: {
    encryptionEnabled: boolean;
    backupsConfigured: boolean;
    auditLogging: boolean;
  };
  capacity: {
    storageUsed: number;
    storageAvailable: number;
    documentCount: number;
    userCount: number;
  };
  issues: string[];
  recommendations: string[];
}

export class StorageReadinessValidator {
  
  async validateStorageReadiness(): Promise<StorageReadinessReport> {
    console.log('🔍 Validating storage system readiness...');
    
    const report: StorageReadinessReport = {
      ready: false,
      timestamp: new Date(),
      database: {
        connected: false,
        poolStatus: null,
        tableCount: 0,
        indexCount: 0
      },
      performance: {
        queryResponseTime: 0,
        connectionLatency: 0,
        throughput: 0
      },
      security: {
        encryptionEnabled: false,
        backupsConfigured: false,
        auditLogging: false
      },
      capacity: {
        storageUsed: 0,
        storageAvailable: 0,
        documentCount: 0,
        userCount: 0
      },
      issues: [],
      recommendations: []
    };

    try {
      // Test database connectivity
      await this.validateDatabaseConnection(report);
      
      // Test performance metrics
      await this.validatePerformance(report);
      
      // Check security configuration
      await this.validateSecurity(report);
      
      // Analyze capacity and usage
      await this.validateCapacity(report);
      
      // Overall readiness assessment
      report.ready = this.assessOverallReadiness(report);
      
      console.log(`✅ Storage readiness validation complete: ${report.ready ? 'READY' : 'NOT READY'}`);
      
    } catch (error) {
      report.issues.push(`Storage validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Storage validation error:', error);
    }

    return report;
  }

  private async validateDatabaseConnection(report: StorageReadinessReport): Promise<void> {
    try {
      if (!db) {
        report.issues.push('Database connection not available');
        return;
      }

      // Test basic connectivity
      const start = Date.now();
      const result = await db.execute('SELECT 1 as test');
      const latency = Date.now() - start;
      
      report.database.connected = true;
      report.performance.connectionLatency = latency;
      
      // Get table count
      const tables = await db.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      report.database.tableCount = Number(tables[0]?.count) || 0;
      
      if (report.database.tableCount < 10) {
        report.issues.push('Insufficient database tables configured');
      }
      
    } catch (error) {
      report.issues.push('Database connectivity test failed');
    }
  }

  private async validatePerformance(report: StorageReadinessReport): Promise<void> {
    try {
      // Test query performance
      const queries = [
        'SELECT COUNT(*) FROM users',
        'SELECT COUNT(*) FROM documents', 
        'SELECT COUNT(*) FROM security_events'
      ];

      let totalTime = 0;
      let successfulQueries = 0;

      for (const query of queries) {
        try {
          const start = Date.now();
          await db?.execute(query);
          const duration = Date.now() - start;
          totalTime += duration;
          successfulQueries++;
        } catch (error) {
          report.issues.push(`Query performance test failed: ${query}`);
        }
      }

      if (successfulQueries > 0) {
        report.performance.queryResponseTime = totalTime / successfulQueries;
        report.performance.throughput = successfulQueries / (totalTime / 1000);
      }

      if (report.performance.queryResponseTime > 1000) {
        report.recommendations.push('Consider database optimization for better performance');
      }

    } catch (error) {
      report.issues.push('Performance validation failed');
    }
  }

  private async validateSecurity(report: StorageReadinessReport): Promise<void> {
    try {
      // Check encryption configuration
      report.security.encryptionEnabled = !!(
        process.env.ENCRYPTION_KEY && 
        process.env.DATABASE_URL?.includes('sslmode=require')
      );

      // Check audit logging
      report.security.auditLogging = !!(
        process.env.AUDIT_LOGGING_ENABLED === 'true'
      );

      // Check backup configuration
      report.security.backupsConfigured = !!(
        process.env.BACKUP_ENABLED === 'true' ||
        process.env.DATABASE_URL?.includes('backup')
      );

      if (!report.security.encryptionEnabled) {
        report.issues.push('Database encryption not properly configured');
      }

    } catch (error) {
      report.issues.push('Security validation failed');
    }
  }

  private async validateCapacity(report: StorageReadinessReport): Promise<void> {
    try {
      // Get user count
      const users = await storage.getAllUsers();
      report.capacity.userCount = users.length;

      // Get document count
      const documents = await storage.getAllDocuments();
      report.capacity.documentCount = documents.length;

      // Estimate storage usage (mock calculation)
      report.capacity.storageUsed = (documents.length * 50000) + (users.length * 1000); // Rough estimate
      report.capacity.storageAvailable = 10000000000; // 10GB mock limit

      if (report.capacity.storageUsed > report.capacity.storageAvailable * 0.8) {
        report.recommendations.push('Consider increasing storage capacity');
      }

    } catch (error) {
      report.issues.push('Capacity analysis failed');
    }
  }

  private assessOverallReadiness(report: StorageReadinessReport): boolean {
    const criticalChecks = [
      report.database.connected,
      report.performance.queryResponseTime < 2000,
      report.security.encryptionEnabled,
      report.issues.length === 0
    ];

    return criticalChecks.every(check => check);
  }
}

export const storageReadinessValidator = new StorageReadinessValidator();
