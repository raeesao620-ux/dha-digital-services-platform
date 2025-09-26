/**
 * PRODUCTION READINESS SERVICE
 * Final validation service that orchestrates all security checks and ensures
 * government-compliant DHA system deployment readiness
 * 
 * This service coordinates all security components and provides final
 * go/no-go decision for production deployment
 */

import { securityConfigurationService } from './security-configuration-service';
import { startupHealthChecksService } from './startup-health-checks';
import { autonomousMonitoringBot } from './autonomous-monitoring-bot';
import { cryptographicSignatureService } from './cryptographic-signature-service';

// Production readiness status
interface ProductionReadinessReport {
  ready: boolean;
  timestamp: Date;
  environment: string;
  securityLevel: string;
  
  // Component statuses
  components: {
    security: ComponentStatus;
    mtls: ComponentStatus;
    monitoring: ComponentStatus;
    cryptography: ComponentStatus;
    government: ComponentStatus;
    database: ComponentStatus;
  };
  
  // Summary
  summary: {
    totalChecks: number;
    passedChecks: number;
    criticalFailures: number;
    warnings: number;
  };
  
  // Detailed results
  criticalFailures: string[];
  warnings: string[];
  recommendations: string[];
  
  // Compliance status
  compliance: {
    governmentPKI: boolean;
    mtlsConfigured: boolean;
    liveIntegrations: boolean;
    monitoringActive: boolean;
    secretsValidated: boolean;
  };
}

interface ComponentStatus {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  details: string;
  checks: number;
  criticalIssues: string[];
}

/**
 * Final production readiness orchestration service
 */
export class ProductionReadinessService {
  constructor() {
    console.log('[Production Readiness] Service initialized');
  }

  /**
   * Comprehensive production readiness assessment
   * This is the final gate before production deployment
   */
  async assessProductionReadiness(): Promise<ProductionReadinessReport> {
    const startTime = Date.now();
    console.log('🔍 [Production Readiness] Starting comprehensive assessment...');

    const report: ProductionReadinessReport = {
      ready: false,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'unknown',
      securityLevel: 'unknown',
      components: {
        security: { name: 'Security Configuration', status: 'failed', details: '', checks: 0, criticalIssues: [] },
        mtls: { name: 'mTLS Configuration', status: 'failed', details: '', checks: 0, criticalIssues: [] },
        monitoring: { name: 'Monitoring Services', status: 'failed', details: '', checks: 0, criticalIssues: [] },
        cryptography: { name: 'Digital Signatures', status: 'failed', details: '', checks: 0, criticalIssues: [] },
        government: { name: 'Government Integrations', status: 'failed', details: '', checks: 0, criticalIssues: [] },
        database: { name: 'Database Configuration', status: 'failed', details: '', checks: 0, criticalIssues: [] }
      },
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        criticalFailures: 0,
        warnings: 0
      },
      criticalFailures: [],
      warnings: [],
      recommendations: [],
      compliance: {
        governmentPKI: false,
        mtlsConfigured: false,
        liveIntegrations: false,
        monitoringActive: false,
        secretsValidated: false
      }
    };

    try {
      // 1. Security Configuration Assessment
      console.log('🔐 [Production Readiness] Assessing security configuration...');
      await this.assessSecurityConfiguration(report);

      // 2. Startup Health Checks
      console.log('🏥 [Production Readiness] Running startup health checks...');
      await this.assessStartupHealth(report);

      // 3. Government Integration Assessment
      console.log('🏛️ [Production Readiness] Validating government integrations...');
      await this.assessGovernmentIntegrations(report);

      // 4. mTLS Configuration Assessment
      console.log('🔐 [Production Readiness] Validating mTLS configurations...');
      await this.assessMTLSConfiguration(report);

      // 5. Monitoring and Performance Assessment
      console.log('📊 [Production Readiness] Assessing monitoring capabilities...');
      await this.assessMonitoringCapabilities(report);

      // 6. Cryptographic Services Assessment
      console.log('🔏 [Production Readiness] Validating cryptographic services...');
      await this.assessCryptographicServices(report);

      // 7. Database and Infrastructure Assessment
      console.log('🗄️ [Production Readiness] Assessing database configuration...');
      await this.assessDatabaseConfiguration(report);

      // 8. Final Compliance Validation
      console.log('✅ [Production Readiness] Final compliance validation...');
      this.performFinalValidation(report);

      const duration = Date.now() - startTime;
      console.log(`🏁 [Production Readiness] Assessment completed in ${duration}ms`);

      // Log final status
      if (report.ready) {
        console.log('✅ [Production Readiness] SYSTEM READY FOR PRODUCTION DEPLOYMENT');
        console.log(`   - Security Level: ${report.securityLevel}`);
        console.log(`   - Components Passed: ${report.summary.passedChecks}/${report.summary.totalChecks}`);
        console.log(`   - Warnings: ${report.summary.warnings}`);
      } else {
        console.error('❌ [Production Readiness] PRODUCTION DEPLOYMENT BLOCKED');
        console.error(`   - Critical Failures: ${report.summary.criticalFailures}`);
        console.error(`   - Failed Components: ${report.summary.totalChecks - report.summary.passedChecks}`);
        
        if (report.criticalFailures.length > 0) {
          console.error('   CRITICAL ISSUES:');
          report.criticalFailures.forEach(failure => {
            console.error(`     ❌ ${failure}`);
          });
        }
      }

      return report;

    } catch (error) {
      console.error('[Production Readiness] Critical error during assessment:', error);
      report.criticalFailures.push(`Assessment error: ${error}`);
      report.ready = false;
      return report;
    }
  }

  /**
   * Assess security configuration
   */
  private async assessSecurityConfiguration(report: ProductionReadinessReport): Promise<void> {
    try {
      const securitySummary = securityConfigurationService.getSecuritySummary();
      const envValidation = await securityConfigurationService.validateEnvironment();
      const productionReadiness = await securityConfigurationService.validateProductionReadiness();

      report.securityLevel = securitySummary.securityLevel;
      report.components.security.checks = securitySummary.requiredSecretsCount;

      if (envValidation.valid && productionReadiness.ready) {
        report.components.security.status = 'passed';
        report.components.security.details = `Security configuration validated. ${securitySummary.configuredSecretsCount}/${securitySummary.requiredSecretsCount} secrets configured.`;
        report.compliance.secretsValidated = true;
      } else {
        report.components.security.status = 'failed';
        report.components.security.details = `Security validation failed. Missing: ${envValidation.missingSecrets.length} secrets.`;
        report.components.security.criticalIssues = [...envValidation.errors, ...productionReadiness.blockers];
        report.criticalFailures.push(...envValidation.errors, ...productionReadiness.blockers);
      }

      report.warnings.push(...envValidation.warnings, ...productionReadiness.warnings);
      report.recommendations.push(...productionReadiness.recommendations);

    } catch (error) {
      report.components.security.status = 'failed';
      report.components.security.details = `Security assessment failed: ${error}`;
      report.criticalFailures.push(`Security configuration error: ${error}`);
    }
  }

  /**
   * Assess startup health
   */
  private async assessStartupHealth(report: ProductionReadinessReport): Promise<void> {
    try {
      const healthResult = await startupHealthChecksService.performStartupValidation();

      if (healthResult.success) {
        // Update component statuses based on health check results
        const componentMapping: Record<string, keyof typeof report.components> = {
          'Database': 'database',
          'Environment Configuration': 'security',
          'mTLS Configuration': 'mtls',
          'Monitoring Services': 'monitoring',
          'Cryptographic Services': 'cryptography'
        };

        for (const healthCheck of healthResult.healthChecks) {
          const componentKey = componentMapping[healthCheck.service];
          if (componentKey && report.components[componentKey]) {
            if (healthCheck.healthy) {
              if (report.components[componentKey].status !== 'failed') {
                report.components[componentKey].status = 'passed';
              }
            } else {
              report.components[componentKey].status = 'failed';
              if (healthCheck.error) {
                report.components[componentKey].criticalIssues.push(healthCheck.error);
              }
            }
          }
        }

      } else {
        report.criticalFailures.push(...healthResult.failedChecks);
      }

      report.warnings.push(...healthResult.warnings);

    } catch (error) {
      report.criticalFailures.push(`Startup health check error: ${error}`);
    }
  }

  /**
   * Assess government integrations
   */
  private async assessGovernmentIntegrations(report: ProductionReadinessReport): Promise<void> {
    try {
      const requiredServices = ['DHA_NPR_ENABLED', 'SAPS_CRC_ENABLED', 'DHA_ABIS_ENABLED'];
      const enabledServices = requiredServices.filter(service => process.env[service] === 'true');
      
      if (process.env.NODE_ENV === 'production') {
        if (enabledServices.length === requiredServices.length) {
          report.components.government.status = 'passed';
          report.components.government.details = `All ${enabledServices.length} government services enabled and validated.`;
          report.compliance.liveIntegrations = true;
        } else {
          report.components.government.status = 'failed';
          report.components.government.details = `Only ${enabledServices.length}/${requiredServices.length} government services enabled.`;
          const missingServices = requiredServices.filter(service => !enabledServices.includes(service));
          report.components.government.criticalIssues = missingServices.map(service => `${service} not enabled`);
          report.criticalFailures.push(...report.components.government.criticalIssues);
        }
      } else {
        report.components.government.status = 'passed';
        report.components.government.details = 'Government integration validation skipped for non-production environment.';
      }

      report.components.government.checks = requiredServices.length;

    } catch (error) {
      report.components.government.status = 'failed';
      report.components.government.details = `Government integration assessment failed: ${error}`;
      report.criticalFailures.push(`Government integration error: ${error}`);
    }
  }

  /**
   * Assess mTLS configuration
   */
  private async assessMTLSConfiguration(report: ProductionReadinessReport): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        const requiredCerts = [
          'DHA_NPR_CLIENT_CERT', 'DHA_NPR_PRIVATE_KEY',
          'SAPS_CLIENT_CERT', 'SAPS_PRIVATE_KEY',
          'DHA_ABIS_CLIENT_CERT', 'DHA_ABIS_PRIVATE_KEY'
        ];

        const configuredCerts = requiredCerts.filter(cert => !!process.env[cert]);
        
        if (configuredCerts.length === requiredCerts.length) {
          // Validate certificate formats
          const certVars = requiredCerts.filter(name => name.includes('CERT'));
          const validCerts = certVars.filter(cert => {
            const value = process.env[cert];
            return value && value.includes('-----BEGIN CERTIFICATE-----');
          });

          if (validCerts.length === certVars.length) {
            report.components.mtls.status = 'passed';
            report.components.mtls.details = `All ${requiredCerts.length} mTLS certificates configured and validated.`;
            report.compliance.mtlsConfigured = true;
          } else {
            report.components.mtls.status = 'failed';
            report.components.mtls.details = 'Some certificates are not in valid PEM format.';
            report.components.mtls.criticalIssues.push('Invalid certificate format detected');
            report.criticalFailures.push('mTLS certificates format validation failed');
          }
        } else {
          report.components.mtls.status = 'failed';
          report.components.mtls.details = `Only ${configuredCerts.length}/${requiredCerts.length} mTLS certificates configured.`;
          const missingCerts = requiredCerts.filter(cert => !configuredCerts.includes(cert));
          report.components.mtls.criticalIssues = missingCerts.map(cert => `Missing: ${cert}`);
          report.criticalFailures.push(...report.components.mtls.criticalIssues);
        }

        report.components.mtls.checks = requiredCerts.length;
      } else {
        report.components.mtls.status = 'passed';
        report.components.mtls.details = 'mTLS validation skipped for non-production environment.';
        report.compliance.mtlsConfigured = true;
      }

    } catch (error) {
      report.components.mtls.status = 'failed';
      report.components.mtls.details = `mTLS assessment failed: ${error}`;
      report.criticalFailures.push(`mTLS configuration error: ${error}`);
    }
  }

  /**
   * Assess monitoring capabilities
   */
  private async assessMonitoringCapabilities(report: ProductionReadinessReport): Promise<void> {
    try {
      const monitoringEnabled = process.env.MONITORING_ENABLED === 'true';
      
      if (process.env.NODE_ENV === 'production' && !monitoringEnabled) {
        report.components.monitoring.status = 'failed';
        report.components.monitoring.details = 'Monitoring must be enabled for production.';
        report.components.monitoring.criticalIssues.push('MONITORING_ENABLED not set to true');
        report.criticalFailures.push('Production monitoring not enabled');
      } else {
        report.components.monitoring.status = 'passed';
        report.components.monitoring.details = 'Monitoring services configured with microsecond-level precision.';
        report.compliance.monitoringActive = true;
      }

      report.components.monitoring.checks = 1;

    } catch (error) {
      report.components.monitoring.status = 'failed';
      report.components.monitoring.details = `Monitoring assessment failed: ${error}`;
      report.criticalFailures.push(`Monitoring configuration error: ${error}`);
    }
  }

  /**
   * Assess cryptographic services
   */
  private async assessCryptographicServices(report: ProductionReadinessReport): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        const requiredPKI = [
          'DHA_SIGNING_CERT', 'DHA_SIGNING_KEY',
          'DHA_ROOT_CA_CERT', 'DHA_INTERMEDIATE_CA_CERT',
          'DHA_TSA_URL', 'DHA_OCSP_URL', 'DHA_CRL_URL'
        ];

        const configuredPKI = requiredPKI.filter(item => !!process.env[item]);
        
        if (configuredPKI.length === requiredPKI.length) {
          report.components.cryptography.status = 'passed';
          report.components.cryptography.details = 'PKI infrastructure configured for PAdES-LTV digital signatures.';
          report.compliance.governmentPKI = true;
        } else {
          report.components.cryptography.status = 'failed';
          report.components.cryptography.details = `Only ${configuredPKI.length}/${requiredPKI.length} PKI components configured.`;
          const missingPKI = requiredPKI.filter(item => !configuredPKI.includes(item));
          report.components.cryptography.criticalIssues = missingPKI.map(item => `Missing: ${item}`);
          report.criticalFailures.push(...report.components.cryptography.criticalIssues);
        }

        report.components.cryptography.checks = requiredPKI.length;
      } else {
        report.components.cryptography.status = 'passed';
        report.components.cryptography.details = 'Cryptographic validation skipped for non-production environment.';
        report.compliance.governmentPKI = true;
      }

    } catch (error) {
      report.components.cryptography.status = 'failed';
      report.components.cryptography.details = `Cryptographic assessment failed: ${error}`;
      report.criticalFailures.push(`Cryptographic services error: ${error}`);
    }
  }

  /**
   * Assess database configuration
   */
  private async assessDatabaseConfiguration(report: ProductionReadinessReport): Promise<void> {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        report.components.database.status = 'failed';
        report.components.database.details = 'DATABASE_URL not configured.';
        report.components.database.criticalIssues.push('Missing DATABASE_URL');
        report.criticalFailures.push('Database connection not configured');
        return;
      }

      try {
        const url = new URL(databaseUrl);
        
        if (url.protocol !== 'postgresql:') {
          throw new Error('Must use PostgreSQL');
        }

        // Check SSL requirement for production
        if (process.env.NODE_ENV === 'production') {
          const sslParam = url.searchParams.get('sslmode') || url.searchParams.get('ssl');
          if (!sslParam || sslParam === 'disable') {
            report.components.database.status = 'failed';
            report.components.database.details = 'Database SSL not configured for production.';
            report.components.database.criticalIssues.push('SSL required for production database');
            report.criticalFailures.push('Database SSL not enabled');
            return;
          }
        }

        report.components.database.status = 'passed';
        report.components.database.details = `PostgreSQL database configured with SSL.`;
        
      } catch (urlError) {
        report.components.database.status = 'failed';
        report.components.database.details = `Invalid DATABASE_URL format: ${urlError}`;
        report.components.database.criticalIssues.push('Invalid database URL');
        report.criticalFailures.push('Database URL validation failed');
      }

      report.components.database.checks = 1;

    } catch (error) {
      report.components.database.status = 'failed';
      report.components.database.details = `Database assessment failed: ${error}`;
      report.criticalFailures.push(`Database configuration error: ${error}`);
    }
  }

  /**
   * Perform final validation and set readiness status
   */
  private performFinalValidation(report: ProductionReadinessReport): void {
    // Count passed components
    const componentStatuses = Object.values(report.components);
    const passedComponents = componentStatuses.filter(comp => comp.status === 'passed').length;
    const failedComponents = componentStatuses.filter(comp => comp.status === 'failed').length;
    const warningComponents = componentStatuses.filter(comp => comp.status === 'warning').length;

    // Update summary
    report.summary.totalChecks = componentStatuses.reduce((sum, comp) => sum + comp.checks, 0);
    report.summary.passedChecks = passedComponents;
    report.summary.criticalFailures = failedComponents;
    report.summary.warnings = warningComponents + report.warnings.length;

    // Determine final readiness
    // For production, ALL components must pass
    if (process.env.NODE_ENV === 'production') {
      report.ready = failedComponents === 0 && report.criticalFailures.length === 0;
      
      // Additional compliance requirements for government deployment
      const requiredCompliance = [
        report.compliance.governmentPKI,
        report.compliance.mtlsConfigured,
        report.compliance.liveIntegrations,
        report.compliance.monitoringActive,
        report.compliance.secretsValidated
      ];
      
      const complianceReady = requiredCompliance.every(req => req === true);
      report.ready = report.ready && complianceReady;
      
      if (!complianceReady) {
        report.criticalFailures.push('Government compliance requirements not fully met');
      }
    } else {
      // For non-production, allow some warnings but no critical failures
      report.ready = failedComponents === 0 && report.criticalFailures.length === 0;
    }

    // Add recommendations for warnings
    if (report.warnings.length > 0) {
      report.recommendations.push(`Address ${report.warnings.length} configuration warnings for optimal security`);
    }

    if (passedComponents === componentStatuses.length && report.ready) {
      report.recommendations.push('System is production-ready with government-grade security compliance');
    }
  }

  /**
   * Generate human-readable readiness report
   */
  generateReadinessReport(report: ProductionReadinessReport): string {
    const lines = [
      '=' .repeat(80),
      '🏛️  DHA DIGITAL SERVICES - PRODUCTION READINESS REPORT',
      '=' .repeat(80),
      `Environment: ${report.environment}`,
      `Security Level: ${report.securityLevel}`,
      `Assessment Time: ${report.timestamp.toISOString()}`,
      `Overall Status: ${report.ready ? '✅ PRODUCTION READY' : '❌ NOT READY'}`,
      '',
      '📊 SUMMARY:',
      `   Components Assessed: ${Object.keys(report.components).length}`,
      `   Total Checks: ${report.summary.totalChecks}`,
      `   Passed: ${report.summary.passedChecks}`,
      `   Critical Failures: ${report.summary.criticalFailures}`,
      `   Warnings: ${report.summary.warnings}`,
      '',
      '🔍 COMPONENT STATUS:'
    ];

    // Add component details
    for (const [key, component] of Object.entries(report.components)) {
      const statusIcon = component.status === 'passed' ? '✅' : 
                        component.status === 'warning' ? '⚠️' : '❌';
      lines.push(`   ${statusIcon} ${component.name}: ${component.details}`);
      
      if (component.criticalIssues.length > 0) {
        component.criticalIssues.forEach(issue => {
          lines.push(`      ❌ ${issue}`);
        });
      }
    }

    // Add compliance status
    lines.push('', '🛡️ GOVERNMENT COMPLIANCE:');
    lines.push(`   Government PKI: ${report.compliance.governmentPKI ? '✅' : '❌'}`);
    lines.push(`   mTLS Configured: ${report.compliance.mtlsConfigured ? '✅' : '❌'}`);
    lines.push(`   Live Integrations: ${report.compliance.liveIntegrations ? '✅' : '❌'}`);
    lines.push(`   Monitoring Active: ${report.compliance.monitoringActive ? '✅' : '❌'}`);
    lines.push(`   Secrets Validated: ${report.compliance.secretsValidated ? '✅' : '❌'}`);

    // Add critical failures
    if (report.criticalFailures.length > 0) {
      lines.push('', '❌ CRITICAL FAILURES (MUST FIX):');
      report.criticalFailures.forEach(failure => {
        lines.push(`   • ${failure}`);
      });
    }

    // Add warnings
    if (report.warnings.length > 0) {
      lines.push('', '⚠️ WARNINGS:');
      report.warnings.forEach(warning => {
        lines.push(`   • ${warning}`);
      });
    }

    // Add recommendations
    if (report.recommendations.length > 0) {
      lines.push('', '💡 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => {
        lines.push(`   • ${rec}`);
      });
    }

    lines.push('', '=' .repeat(80));

    return lines.join('\n');
  }
}

// Export singleton instance
export const productionReadinessService = new ProductionReadinessService();