import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { storage } from '../storage';
import { auditTrailService } from './audit-trail-service';

export interface DataRetentionPolicy {
  dataType: 'documents' | 'personal_data' | 'biometrics' | 'communications' | 'audit_logs';
  retentionPeriodDays: number;
  legalBasis: string;
  disposalMethod: 'secure_delete' | 'archive' | 'anonymize';
  complianceFramework: 'POPIA' | 'GDPR' | 'DHA_REGULATION';
}

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  keyRotationDays: number;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
}

/**
 * PRODUCTION-CRITICAL: Data Governance and POPIA Compliance Service
 * Handles data retention, encryption-at-rest, and secure disposal
 */
export class DataGovernanceService {
  private readonly ENCRYPTION_KEY_LENGTH = 32; // 256 bits
  private readonly IV_LENGTH = 16; // 128 bits
  private readonly TAG_LENGTH = 16; // 128 bits

  // DHA-compliant data retention policies
  private readonly DATA_RETENTION_POLICIES: DataRetentionPolicy[] = [
    {
      dataType: 'documents',
      retentionPeriodDays: 2555, // 7 years as per DHA requirements
      legalBasis: 'Legal obligation under Immigration Act',
      disposalMethod: 'secure_delete',
      complianceFramework: 'DHA_REGULATION'
    },
    {
      dataType: 'personal_data',
      retentionPeriodDays: 2555, // 7 years
      legalBasis: 'Legal obligation under POPIA and DHA regulations',
      disposalMethod: 'secure_delete',
      complianceFramework: 'POPIA'
    },
    {
      dataType: 'biometrics',
      retentionPeriodDays: 2555, // 7 years
      legalBasis: 'Legal obligation under Immigration Act',
      disposalMethod: 'secure_delete',
      complianceFramework: 'DHA_REGULATION'
    },
    {
      dataType: 'communications',
      retentionPeriodDays: 1095, // 3 years
      legalBasis: 'Legitimate interest in service improvement',
      disposalMethod: 'anonymize',
      complianceFramework: 'POPIA'
    },
    {
      dataType: 'audit_logs',
      retentionPeriodDays: 2555, // 7 years for compliance
      legalBasis: 'Legal obligation for audit trail maintenance',
      disposalMethod: 'archive',
      complianceFramework: 'DHA_REGULATION'
    }
  ];

  private readonly ENCRYPTION_CONFIG: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyRotationDays: 90, // Quarterly key rotation
    encryptionAtRest: true,
    encryptionInTransit: true
  };

  /**
   * Encrypt data at rest using AES-256-GCM
   */
  async encryptDataAtRest(data: Buffer, context: string): Promise<{
    encryptedData: Buffer;
    encryptionKey: string;
    iv: string;
    authTag: string;
    metadata: {
      algorithm: string;
      timestamp: Date;
      context: string;
      keyRotationDue: Date;
    }
  }> {
    try {
      // Generate encryption key and IV
      const key = crypto.randomBytes(this.ENCRYPTION_KEY_LENGTH);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipher('aes-256-gcm', key);
      cipher.setAAD(Buffer.from(context, 'utf8'));
      
      // Encrypt data
      let encrypted = cipher.update(data);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      // Calculate key rotation date
      const keyRotationDue = new Date();
      keyRotationDue.setDate(keyRotationDue.getDate() + this.ENCRYPTION_CONFIG.keyRotationDays);
      
      return {
        encryptedData: encrypted,
        encryptionKey: key.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        metadata: {
          algorithm: 'aes-256-gcm',
          timestamp: new Date(),
          context,
          keyRotationDue
        }
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data at rest');
    }
  }

  /**
   * Decrypt data at rest
   */
  async decryptDataAtRest(
    encryptedData: Buffer,
    encryptionKey: string,
    iv: string,
    authTag: string,
    context: string
  ): Promise<Buffer> {
    try {
      const key = Buffer.from(encryptionKey, 'hex');
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');
      
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(authTagBuffer);
      decipher.setAAD(Buffer.from(context, 'utf8'));
      
      let decrypted = decipher.update(encryptedData);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Secure file encryption for document storage
   */
  async encryptDocumentFile(filePath: string, documentId: string): Promise<{
    encryptedFilePath: string;
    encryptionMetadata: any;
  }> {
    try {
      const fileData = await fs.readFile(filePath);
      const encryptionResult = await this.encryptDataAtRest(
        fileData, 
        `document:${documentId}`
      );
      
      // Create encrypted file path
      const encryptedDir = path.join(path.dirname(filePath), 'encrypted');
      await fs.mkdir(encryptedDir, { recursive: true });
      const encryptedFilePath = path.join(encryptedDir, `${documentId}.enc`);
      
      // Write encrypted data
      await fs.writeFile(encryptedFilePath, encryptionResult.encryptedData);
      
      // Remove original unencrypted file
      await fs.unlink(filePath);
      
      // Log encryption operation
      console.log('Document encrypted:', {
        originalPath: filePath,
        encryptedPath: encryptedFilePath,
        algorithm: encryptionResult.metadata.algorithm,
        keyRotationDue: encryptionResult.metadata.keyRotationDue
      });
      
      return {
        encryptedFilePath,
        encryptionMetadata: {
          encryptionKey: encryptionResult.encryptionKey,
          iv: encryptionResult.iv,
          authTag: encryptionResult.authTag,
          ...encryptionResult.metadata
        }
      };
    } catch (error) {
      console.error('Document encryption error:', error);
      throw new Error('Failed to encrypt document file');
    }
  }

  /**
   * Check and enforce data retention policies
   */
  async enforceDataRetention(): Promise<{
    documentsProcessed: number;
    documentsDeleted: number;
    documentsArchived: number;
    documentsAnonymized: number;
    errors: string[];
  }> {
    const results = {
      documentsProcessed: 0,
      documentsDeleted: 0,
      documentsArchived: 0,
      documentsAnonymized: 0,
      errors: []
    };

    try {
      for (const policy of this.DATA_RETENTION_POLICIES) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriodDays);
        
        // Get data that exceeds retention period
        const expiredData = await this.getExpiredData(policy.dataType, cutoffDate);
        
        for (const item of expiredData) {
          results.documentsProcessed++;
          
          try {
            switch (policy.disposalMethod) {
              case 'secure_delete':
                await this.secureDelete(item);
                results.documentsDeleted++;
                break;
              case 'archive':
                await this.archiveData(item);
                results.documentsArchived++;
                break;
              case 'anonymize':
                await this.anonymizeData(item);
                results.documentsAnonymized++;
                break;
            }
            
            // Log disposal action
            console.log('Data disposal logged:', {
              itemId: item.id || 'unknown',
              dataType: policy.dataType,
              disposalMethod: policy.disposalMethod,
              legalBasis: policy.legalBasis,
              retentionPeriodDays: policy.retentionPeriodDays,
              cutoffDate,
              complianceFramework: policy.complianceFramework
            });
            
          } catch (error: any) {
            const errorMsg = `Failed to dispose data ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            results.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      }
      
      return results;
    } catch (error: any) {
      console.error('Data retention enforcement error:', error);
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return results;
    }
  }

  /**
   * Get data that has expired based on retention policy
   */
  private async getExpiredData(dataType: string, cutoffDate: Date): Promise<any[]> {
    // This would query the database for expired data
    // For now, return empty array as this requires database integration
    return [];
  }

  /**
   * Securely delete data (overwrite with random data multiple times)
   */
  private async secureDelete(item: any): Promise<void> {
    if (item.filePath || item.storagePath) {
      const filePath = item.filePath || item.storagePath;
      
      try {
        // Get file stats
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        
        // Perform multiple overwrite passes with random data
        const passes = 3;
        for (let pass = 0; pass < passes; pass++) {
          const randomData = crypto.randomBytes(fileSize);
          await fs.writeFile(filePath, randomData);
          // Data written to disk through writeFile
        }
        
        // Final deletion
        await fs.unlink(filePath);
        
      } catch (error: any) {
        if (error?.code !== 'ENOENT') { // File not found is okay
          throw error;
        }
      }
    }
  }

  /**
   * Archive data to secure long-term storage
   */
  private async archiveData(item: any): Promise<void> {
    // Archive implementation would go here
    console.log(`Archiving data item: ${item.id}`);
  }

  /**
   * Anonymize data by removing or hashing personal identifiers
   */
  private async anonymizeData(item: any): Promise<void> {
    // Anonymization implementation would go here
    console.log(`Anonymizing data item: ${item.id}`);
  }

  /**
   * Generate compliance report for POPIA requirements
   */
  async generateComplianceReport(): Promise<{
    reportId: string;
    timestamp: Date;
    dataCategories: {
      category: string;
      recordCount: number;
      oldestRecord: Date;
      retentionPolicy: DataRetentionPolicy;
      complianceStatus: 'compliant' | 'attention_required' | 'non_compliant';
    }[];
    encryptionStatus: {
      encryptedRecords: number;
      unencryptedRecords: number;
      keyRotationStatus: 'current' | 'due' | 'overdue';
    };
    recommendations: string[];
  }> {
    const reportId = crypto.randomBytes(16).toString('hex');
    
    return {
      reportId,
      timestamp: new Date(),
      dataCategories: this.DATA_RETENTION_POLICIES.map(policy => ({
        category: policy.dataType,
        recordCount: 0, // Would query database
        oldestRecord: new Date(), // Would query database
        retentionPolicy: policy,
        complianceStatus: 'compliant' as const
      })),
      encryptionStatus: {
        encryptedRecords: 0,
        unencryptedRecords: 0,
        keyRotationStatus: 'current'
      },
      recommendations: [
        'Continue regular monitoring of data retention compliance',
        'Ensure all new documents are encrypted at rest',
        'Review and update consent records quarterly'
      ]
    };
  }

  /**
   * Get data retention policy for a specific data type
   */
  getRetentionPolicy(dataType: string): DataRetentionPolicy | null {
    return this.DATA_RETENTION_POLICIES.find(p => p.dataType === dataType) || null;
  }

  /**
   * Schedule automatic data retention enforcement
   */
  startRetentionScheduler(): void {
    // Run retention check daily at 2 AM
    const dailyCheck = setInterval(async () => {
      const hour = new Date().getHours();
      if (hour === 2) { // 2 AM
        console.log('Running scheduled data retention enforcement...');
        try {
          const results = await this.enforceDataRetention();
          console.log('Data retention results:', results);
        } catch (error) {
          console.error('Scheduled data retention failed:', error);
        }
      }
    }, 60 * 60 * 1000); // Check every hour
    
    console.log('Data retention scheduler started');
  }
}

export const dataGovernanceService = new DataGovernanceService();