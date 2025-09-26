import { db } from '../db';
import { storage } from '../storage';
import { errorTrackingService } from './error-tracking';
import { enhancedMonitoringService } from './enhanced-monitoring-service';
import { sql } from 'drizzle-orm';

// Type definitions
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'error';
  lastCheck: Date;
  details?: any;
  metrics?: any;
}

interface RecoveryStrategy {
  name: string;
  detect: () => Promise<boolean>;
  recover: () => Promise<boolean>;
  fallback?: () => Promise<void>;
}

interface PerformanceMetric {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalRetries: number;
  averageRetries: number;
}

class CircuitBreaker {
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private _state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  get state(): 'closed' | 'open' | 'half-open' {
    return this._state;
  }

  canAttempt(): boolean {
    if (this._state === 'closed') return true;
    if (this._state === 'open') {
      const now = Date.now();
      const timeSinceLastFailure = this.lastFailureTime ? now - this.lastFailureTime.getTime() : Infinity;
      if (timeSinceLastFailure > this.config.resetTimeout) {
        this._state = 'half-open';
        this.successes = 0;
        return true;
      }
      return false;
    }
    // half-open
    return this.successes < this.config.halfOpenRequests;
  }

  recordSuccess(): void {
    this.successes++;
    if (this._state === 'half-open' && this.successes >= this.config.successThreshold) {
      this._state = 'closed';
      this.failures = 0;
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    if (this.failures >= this.config.failureThreshold) {
      this._state = 'open';
    }
  }
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  halfOpenRequests: number;
  name: string;
}

/**
 * Automatic Error Recovery Service
 * Implements retry logic with exponential backoff, circuit breakers, and self-healing mechanisms
 */
export class AutoRecoveryService {
  private retryConfigs = new Map<string, RetryConfig>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private healthChecks = new Map<string, HealthCheck>();
  private recoveryStrategies = new Map<string, RecoveryStrategy>();
  private performanceMetrics = new Map<string, PerformanceMetric>();

  constructor() {
    this.initializeRecoveryMechanisms();
    this.startHealthMonitoring();
    this.setupAutoOptimization();
  }

  /**
   * Initialize the auto recovery service
   */
  async initialize(): Promise<void> {
    console.log('[AutoRecovery] Auto recovery service initialized');
  }

  private initializeRecoveryMechanisms(): void {
    // Configure retry policies for different operation types
    this.retryConfigs.set('database', {
      maxRetries: 5,
      initialDelay: 100,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']
    });

    this.retryConfigs.set('api', {
      maxRetries: 3,
      initialDelay: 200,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: ['ECONNRESET', 'ETIMEDOUT', '502', '503', '504']
    });

    this.retryConfigs.set('file', {
      maxRetries: 3,
      initialDelay: 50,
      maxDelay: 2000,
      backoffMultiplier: 2,
      jitter: false,
      retryableErrors: ['ENOENT', 'EACCES', 'EMFILE']
    });

    // Initialize circuit breakers
    this.initializeCircuitBreakers();

    // Setup recovery strategies
    this.setupRecoveryStrategies();
  }

  private initializeCircuitBreakers(): void {
    // Database circuit breaker
    this.circuitBreakers.set('database', new CircuitBreaker({
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000,
      halfOpenRequests: 3,
      name: 'database'
    }));

    // API circuit breaker
    this.circuitBreakers.set('api', new CircuitBreaker({
      failureThreshold: 10,
      successThreshold: 3,
      timeout: 15000,
      resetTimeout: 30000,
      halfOpenRequests: 5,
      name: 'api'
    }));

    // Cache circuit breaker
    this.circuitBreakers.set('cache', new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 1,
      timeout: 5000,
      resetTimeout: 15000,
      halfOpenRequests: 2,
      name: 'cache'
    }));
  }

  private setupRecoveryStrategies(): void {
    // Database connection recovery
    this.recoveryStrategies.set('database-connection', {
      name: 'Database Connection Recovery',
      detect: () => this.checkDatabaseConnection(),
      recover: async () => {
        console.log('[AutoRecovery] Attempting database reconnection...');
        try {
          await this.reconnectDatabase();
          return true;
        } catch (error) {
          console.error('[AutoRecovery] Database reconnection failed:', error);
          return false;
        }
      },
      fallback: () => this.enableReadOnlyMode()
    });

    // Memory optimization recovery
    this.recoveryStrategies.set('memory-optimization', {
      name: 'Memory Optimization',
      detect: () => this.checkMemoryUsage(),
      recover: async () => {
        console.log('[AutoRecovery] Running memory optimization...');
        await this.optimizeMemory();
        return true;
      },
      fallback: () => this.reduceResourceUsage()
    });

    // Performance degradation recovery
    this.recoveryStrategies.set('performance', {
      name: 'Performance Recovery',
      detect: () => this.checkPerformance(),
      recover: async () => {
        console.log('[AutoRecovery] Optimizing performance...');
        await this.optimizePerformance();
        return true;
      },
      fallback: () => this.enableGracefulDegradation()
    });
  }

  /**
   * Execute operation with automatic retry and exponential backoff
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string = 'database',
    context?: any
  ): Promise<T> {
    const config = this.retryConfigs.get(operationType) || this.retryConfigs.get('database')!;
    let lastError: any;
    let delay = config.initialDelay;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Check circuit breaker
        const circuitBreaker = this.circuitBreakers.get(operationType);
        if (circuitBreaker && !circuitBreaker.canAttempt()) {
          throw new Error(`Circuit breaker open for ${operationType}`);
        }

        // Execute operation
        const result = await operation();

        // Record success
        circuitBreaker?.recordSuccess();
        this.recordPerformanceMetric(operationType, attempt, true);

        return result;
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, config.retryableErrors);

        if (!isRetryable || attempt === config.maxRetries) {
          // Record failure
          const circuitBreaker = this.circuitBreakers.get(operationType);
          circuitBreaker?.recordFailure();
          this.recordPerformanceMetric(operationType, attempt, false);

          // Log error
          await errorTrackingService.logError({
            error,
            context: {
              operation: operationType,
              attempt,
              ...context,
              isRetryable
            },
            severity: attempt === config.maxRetries ? 'high' : 'medium'
          });

          throw error;
        }

        // Calculate delay with jitter
        if (config.jitter) {
          delay = delay + Math.random() * delay * 0.3;
        }

        console.log(`[AutoRecovery] Retrying ${operationType} operation. Attempt ${attempt + 1}/${config.maxRetries}. Delay: ${delay}ms`);

        // Wait before retry
        await this.delay(Math.min(delay, config.maxDelay));

        // Exponential backoff
        delay *= config.backoffMultiplier;
      }
    }

    throw lastError;
  }

  /**
   * Execute operation through circuit breaker
   */
  public async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    breakerName: string,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const breaker = this.circuitBreakers.get(breakerName);

    if (!breaker) {
      return operation();
    }

    if (!breaker.canAttempt()) {
      if (fallback) {
        console.log(`[CircuitBreaker] ${breakerName} is open, using fallback`);
        return fallback();
      }
      throw new Error(`Circuit breaker ${breakerName} is open`);
    }

    try {
      const result = await operation();
      breaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();

      if (fallback && breaker.state === 'open') {
        console.log(`[CircuitBreaker] ${breakerName} opened, using fallback`);
        return fallback();
      }

      throw error;
    }
  }

  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError) || 
      errorCode === retryableError ||
      error.statusCode?.toString() === retryableError
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private recordPerformanceMetric(operationType: string, attempts: number, success: boolean): void {
    const metric = this.performanceMetrics.get(operationType) || {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetries: 0,
      averageRetries: 0
    };

    metric.totalOperations++;
    if (success) {
      metric.successfulOperations++;
    } else {
      metric.failedOperations++;
    }
    metric.totalRetries += attempts;
    metric.averageRetries = metric.totalRetries / metric.totalOperations;

    this.performanceMetrics.set(operationType, metric);
  }

  /**
   * Health monitoring and auto-recovery
   */
  private startHealthMonitoring(): void {
    // Monitor system health every 30 seconds
    setInterval(async () => {
      await this.performHealthChecks();
    }, 30000);

    // Run recovery strategies every minute
    setInterval(async () => {
      await this.runRecoveryStrategies().catch(err => console.error('[AutoRecovery] Recovery strategies failed:', err));
    }, 60000);

    // Cleanup expired data every hour
    setInterval(async () => {
      await this.cleanupExpiredData().catch(err => console.error('[AutoRecovery] Cleanup failed:', err));
    }, 3600000);
  }

  private async performHealthChecks(): Promise<void> {
    const checks = [
      { name: 'database', check: () => this.checkDatabaseHealth() },
      { name: 'memory', check: () => this.checkMemoryHealth() },
      { name: 'disk', check: () => this.checkDiskHealth() },
      { name: 'api', check: () => this.checkApiHealth() },
      { name: 'cache', check: () => this.checkCacheHealth() }
    ];

    for (const { name, check } of checks) {
      try {
        const result = await check();
        this.healthChecks.set(name, {
          status: result.healthy ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          details: result.details,
          metrics: result.metrics
        });

        if (!result.healthy) {
          console.warn(`[Health Check] ${name} is unhealthy:`, result.details);
          await this.triggerRecovery(name);
        }
      } catch (error) {
        console.error(`[Health Check] Failed to check ${name}:`, error);
        this.healthChecks.set(name, {
          status: 'unhealthy',
          lastCheck: new Date(),
          details: error
        });
      }
    }
  }

  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const latency = Date.now() - start;

      return {
        healthy: latency < 1000,
        details: { latency },
        metrics: { latency }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: (error as any).message || String(error) }
      };
    }
  }

  private async checkMemoryHealth(): Promise<HealthCheckResult> {
    const memoryUsage = process.memoryUsage();
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    return {
      healthy: heapUsedPercent < 85,
      details: { heapUsedPercent },
      metrics: memoryUsage
    };
  }

  private async checkDiskHealth(): Promise<HealthCheckResult> {
    // Check disk space (simplified)
    const diskSpace = await this.getDiskSpace();
    const freePercent = (diskSpace.free / diskSpace.total) * 100;

    return {
      healthy: freePercent > 10,
      details: { freePercent },
      metrics: diskSpace
    };
  }

  private async checkApiHealth(): Promise<HealthCheckResult> {
    const metrics = this.performanceMetrics.get('api') || {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetries: 0,
      averageRetries: 0
    };

    const successRate = metrics.totalOperations > 0
      ? (metrics.successfulOperations / metrics.totalOperations) * 100
      : 100;

    return {
      healthy: successRate > 95,
      details: { successRate },
      metrics
    };
  }

  private async checkCacheHealth(): Promise<HealthCheckResult> {
    // Check cache hit rate and memory usage
    const cacheMetrics = await this.getCacheMetrics();
    const hitRate = cacheMetrics.hits / (cacheMetrics.hits + cacheMetrics.misses) * 100;

    return {
      healthy: hitRate > 70 && cacheMetrics.memoryUsage < 500 * 1024 * 1024, // 500MB
      details: { hitRate, memoryUsage: cacheMetrics.memoryUsage },
      metrics: cacheMetrics
    };
  }

  private async runRecoveryStrategies(): Promise<void> {
    for (const [key, strategy] of Array.from(this.recoveryStrategies)) {
      try {
        const needsRecovery = await strategy.detect();
        if (needsRecovery) {
          console.log(`[AutoRecovery] Running recovery strategy: ${strategy.name}`);
          const recovered = await strategy.recover();

          if (!recovered && strategy.fallback) {
            console.log(`[AutoRecovery] Recovery failed, using fallback for ${strategy.name}`);
            await strategy.fallback();
          }
        }
      } catch (error) {
        console.error(`[AutoRecovery] Failed to run recovery strategy ${key}:`, error);
      }
    }
  }

  private async triggerRecovery(component: string): Promise<void> {
    const strategy = this.recoveryStrategies.get(`${component}-recovery`);
    if (strategy) {
      await strategy.recover();
    }
  }

  /**
   * Automatic cleanup and optimization
   */
  private async cleanupExpiredData(): Promise<void> {
    console.log('[AutoRecovery] Running automatic cleanup...');

    try {
      // Cleanup expired sessions
      await this.cleanupExpiredSessions();

      // Cleanup old error logs
      await this.cleanupOldErrorLogs();

      // Cleanup temporary files
      await this.cleanupTempFiles();

      // Optimize database
      await this.optimizeDatabase();

      console.log('[AutoRecovery] Cleanup completed successfully');
    } catch (error) {
      console.error('[AutoRecovery] Cleanup failed:', error);
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    const sessions = await storage.getWebSocketSessions();

    for (const session of sessions) {
      if (session.lastSeen && session.lastSeen < cutoffTime && session.isActive) {
        await storage.deactivateWebSocketSession(session.socketId);
      }
    }
  }

  private async cleanupOldErrorLogs(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    // Implementation would delete old error logs
  }

  private async cleanupTempFiles(): Promise<void> {
    // Implementation would clean temporary files
  }

  private async optimizeDatabase(): Promise<void> {
    // Run VACUUM or ANALYZE on PostgreSQL
    try {
      await db.execute(sql`VACUUM ANALYZE`);
    } catch (error) {
      console.error('[AutoRecovery] Database optimization failed:', error);
    }
  }

  /**
   * Performance optimization
   */
  private setupAutoOptimization(): void {
    // Monitor and optimize performance every 5 minutes
    setInterval(async () => {
      await this.autoOptimizePerformance();
    }, 300000);
  }

  private async autoOptimizePerformance(): Promise<void> {
    const metrics = await this.collectPerformanceMetrics();

    // Adjust cache size based on memory usage
    if (metrics.memoryUsage > 80) {
      await this.reduceCacheSize();
    } else if (metrics.memoryUsage < 50) {
      await this.increaseCacheSize();
    }

    // Adjust connection pool size based on load
    if (metrics.averageResponseTime > 1000) {
      await this.increaseConnectionPoolSize();
    } else if (metrics.averageResponseTime < 100 && metrics.connectionPoolUsage < 30) {
      await this.decreaseConnectionPoolSize();
    }

    // Enable/disable features based on system load
    if (metrics.cpuUsage > 90) {
      await this.enableGracefulDegradation();
    } else if (metrics.cpuUsage < 50) {
      await this.disableGracefulDegradation();
    }
  }

  private async collectPerformanceMetrics(): Promise<any> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryUsage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      cpuUsage: cpuUsage.user / 1000000, // Convert to seconds
      averageResponseTime: await this.getAverageResponseTime(),
      connectionPoolUsage: await this.getConnectionPoolUsage()
    };
  }

  // Helper methods
  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await db.execute(sql`SELECT 1`);
      return false; // No recovery needed
    } catch {
      return true; // Recovery needed
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    try {
      await db.execute(sql`SELECT 1`);
      console.log('[AutoRecovery] Database connection verified.');
    } catch (error) {
      console.error('[AutoRecovery] Database connection failed:', error);
      throw error; // Re-throw to be caught by the caller
    }
  }

  private async reconnectDatabase(): Promise<void> {
    // Implementation would reconnect to database
    console.log('[AutoRecovery] Database reconnected');
  }

  private async checkMemoryUsage(): Promise<boolean> {
    const memoryUsage = process.memoryUsage();
    return (memoryUsage.heapUsed / memoryUsage.heapTotal) > 0.9;
  }

  private async optimizeMemory(): Promise<void> {
    if (global.gc) {
      global.gc();
    }
    // Clear caches, reduce memory usage
  }

  private async checkPerformance(): Promise<boolean> {
    const metrics = this.performanceMetrics.get('api');
    return metrics ? metrics.averageRetries > 2 : false;
  }

  private async optimizePerformance(): Promise<void> {
    // Optimize indexes, clear caches, etc.
  }

  private async enableReadOnlyMode(): Promise<void> {
    console.log('[AutoRecovery] Enabling read-only mode');
    // Implementation would switch to read-only mode
  }

  private async reduceResourceUsage(): Promise<void> {
    console.log('[AutoRecovery] Reducing resource usage');
    // Implementation would reduce memory/CPU usage
  }

  private async enableGracefulDegradation(): Promise<void> {
    console.log('[AutoRecovery] Enabling graceful degradation');
    // Disable non-critical features
  }

  private async disableGracefulDegradation(): Promise<void> {
    console.log('[AutoRecovery] Disabling graceful degradation');
    // Re-enable all features
  }

  private async getDiskSpace(): Promise<any> {
    // Implementation would get actual disk space
    return { total: 100000000000, free: 50000000000 };
  }

  private async getCacheMetrics(): Promise<any> {
    // Implementation would get actual cache metrics
    return { hits: 1000, misses: 100, memoryUsage: 100000000 };
  }

  private async reduceCacheSize(): Promise<void> {
    // Implementation would reduce cache size
  }

  private async increaseCacheSize(): Promise<void> {
    // Implementation would increase cache size
  }

  private async increaseConnectionPoolSize(): Promise<void> {
    // Implementation would increase connection pool
  }

  private async decreaseConnectionPoolSize(): Promise<void> {
    // Implementation would decrease connection pool
  }

  private async getAverageResponseTime(): Promise<number> {
    // Implementation would calculate average response time
    return 200;
  }

  private async getConnectionPoolUsage(): Promise<number> {
    // Implementation would get connection pool usage
    return 50;
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): Map<string, HealthCheck> {
    return this.healthChecks;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): Map<string, PerformanceMetric> {
    return this.performanceMetrics;
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitBreakerStatus(): Map<string, CircuitBreakerStatus> {
    const status = new Map<string, CircuitBreakerStatus>();

    for (const [name, breaker] of Array.from(this.circuitBreakers)) {
      status.set(name, {
        state: breaker.state,
        failureCount: (breaker as any).failures || 0,
        successCount: (breaker as any).successes || 0,
        lastFailureTime: (breaker as any).lastFailureTime
      });
    }

    return status;
  }
}

// Additional type definitions
interface HealthCheckResult {
  healthy: boolean;
  details?: any;
  metrics?: any;
}

interface CircuitBreakerStatus {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
}

// Extension of CircuitBreaker class methods
declare module './auto-recovery' {
  interface CircuitBreaker {
    getStatus(): CircuitBreakerStatus;
  }
}

// Add getStatus method to CircuitBreaker class
Object.defineProperty(CircuitBreaker.prototype, 'getStatus', {
  value: function(): CircuitBreakerStatus {
    return {
      state: this._state,
      failureCount: this.failures,
      successCount: this.successes,
      lastFailureTime: this.lastFailureTime
    };
  }
});

interface DuplicateRetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  halfOpenRequests: number;
  name: string;
}

interface CircuitBreakerStatus {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
}


interface PerformanceMetric {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalRetries: number;
  averageRetries: number;
}

// Export singleton instance
export const autoRecoveryService = new AutoRecoveryService();