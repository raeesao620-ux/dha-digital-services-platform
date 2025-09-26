/**
 * Latency Budget Enforcer
 * 
 * Implements strict latency budgets with real-time enforcement and measurement.
 * Ensures operations complete within specified time limits or are terminated
 * to maintain system responsiveness.
 * 
 * Features:
 * - <100ms threat detection with hard enforcement
 * - Real-time latency monitoring and violation detection
 * - Automatic operation termination when budgets exceeded
 * - Adaptive budget adjustment based on system performance
 * - Comprehensive latency reporting and analysis
 * - Graceful degradation with guaranteed minimum performance
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface LatencyBudget {
  operation: string;
  budgetMs: number;           // Hard budget in milliseconds
  softLimitMs: number;        // Soft warning limit
  priority: 'low' | 'medium' | 'high' | 'critical';
  adaptable: boolean;         // Can budget be adjusted automatically
  fallbackStrategy: 'timeout' | 'degrade' | 'queue' | 'abort';
}

interface BudgetedOperation {
  id: string;
  operation: string;
  startTime: bigint;
  budget: LatencyBudget;
  promise: Promise<any>;
  timeoutHandle?: NodeJS.Timeout;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  abortController?: AbortController;
}

interface LatencyViolation {
  operationId: string;
  operation: string;
  budgetMs: number;
  actualMs: number;
  overrunMs: number;
  overrunPercent: number;
  timestamp: bigint;
  action: 'timeout' | 'degrade' | 'continue';
  systemLoad: number;
}

interface LatencyStatistics {
  operation: string;
  totalExecutions: number;
  violationsCount: number;
  violationRate: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
  budgetUtilization: number;  // Average % of budget used
  adaptationCount: number;
}

interface SystemPerformanceMetrics {
  cpuLoad: number;
  memoryLoad: number;
  eventLoopDelay: number;
  activeOperations: number;
  queuedOperations: number;
  overallSystemStress: number; // 0-1 scale
}

/**
 * Latency Budget Enforcer with Real-time Monitoring
 */
export class LatencyBudgetEnforcer extends EventEmitter {
  private static instance: LatencyBudgetEnforcer;
  
  private budgets = new Map<string, LatencyBudget>();
  private activeOperations = new Map<string, BudgetedOperation>();
  private operationQueue: BudgetedOperation[] = [];
  private violations: LatencyViolation[] = [];
  private statistics = new Map<string, LatencyStatistics>();
  
  private isRunning = false;
  private maxConcurrentOperations = 10;
  private violationThreshold = 0.1; // 10% violation rate triggers adaptation
  private emergencyMode = false;
  
  // Performance tracking
  private totalOperations = 0;
  private totalViolations = 0;
  private lastSystemCheck = process.hrtime.bigint();
  private systemMetrics: SystemPerformanceMetrics;
  
  // Default budgets for common operations
  private readonly defaultBudgets: LatencyBudget[] = [
    {
      operation: 'threat_detection',
      budgetMs: 100,
      softLimitMs: 80,
      priority: 'critical',
      adaptable: false,
      fallbackStrategy: 'timeout'
    },
    {
      operation: 'metrics_collection',
      budgetMs: 50,
      softLimitMs: 40,
      priority: 'high',
      adaptable: true,
      fallbackStrategy: 'degrade'
    },
    {
      operation: 'data_processing',
      budgetMs: 200,
      softLimitMs: 150,
      priority: 'medium',
      adaptable: true,
      fallbackStrategy: 'queue'
    },
    {
      operation: 'database_query',
      budgetMs: 300,
      softLimitMs: 250,
      priority: 'medium',
      adaptable: true,
      fallbackStrategy: 'timeout'
    },
    {
      operation: 'api_request',
      budgetMs: 500,
      softLimitMs: 400,
      priority: 'low',
      adaptable: true,
      fallbackStrategy: 'timeout'
    }
  ];
  
  private constructor() {
    super();
    
    this.systemMetrics = {
      cpuLoad: 0,
      memoryLoad: 0,
      eventLoopDelay: 0,
      activeOperations: 0,
      queuedOperations: 0,
      overallSystemStress: 0
    };
    
    this.initializeDefaultBudgets();
    console.log('[LatencyBudgetEnforcer] Initialized with strict enforcement');
  }
  
  static getInstance(): LatencyBudgetEnforcer {
    if (!LatencyBudgetEnforcer.instance) {
      LatencyBudgetEnforcer.instance = new LatencyBudgetEnforcer();
    }
    return LatencyBudgetEnforcer.instance;
  }
  
  /**
   * Start latency budget enforcement
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log('[LatencyBudgetEnforcer] Starting strict latency enforcement...');
    console.log('[LatencyBudgetEnforcer] Threat detection budget: 100ms HARD LIMIT');
    
    this.isRunning = true;
    
    // Start system monitoring
    this.startSystemMonitoring();
    
    // Start operation processing
    this.startOperationProcessing();
    
    // Start budget adaptation
    this.startBudgetAdaptation();
    
    console.log('[LatencyBudgetEnforcer] ✅ Latency enforcement active');
  }
  
  /**
   * Stop latency enforcement
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log('[LatencyBudgetEnforcer] Stopping latency enforcement...');
    this.isRunning = false;
    
    // Cancel all active operations
    for (const [operationId, operation] of this.activeOperations) {
      this.cancelOperation(operationId, 'System shutdown');
    }
    
    this.activeOperations.clear();
    this.operationQueue.length = 0;
    
    console.log('[LatencyBudgetEnforcer] ✅ Latency enforcement stopped');
  }
  
  /**
   * Execute operation with strict latency budget enforcement
   */
  async executeWithBudget<T>(
    operation: string,
    operationFunction: (abortSignal?: AbortSignal) => Promise<T>,
    customBudget?: Partial<LatencyBudget>
  ): Promise<T> {
    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const budget = this.getBudgetForOperation(operation, customBudget);
    
    return new Promise<T>((resolve, reject) => {
      const startTime = process.hrtime.bigint();
      const abortController = new AbortController();
      
      // Create budgeted operation
      const budgetedOp: BudgetedOperation = {
        id: operationId,
        operation,
        startTime,
        budget,
        promise: operationFunction(abortController.signal),
        resolve,
        reject,
        abortController
      };
      
      // Check if we can execute immediately or need to queue
      if (this.activeOperations.size < this.maxConcurrentOperations) {
        this.startBudgetedOperation(budgetedOp);
      } else {
        // Queue operation based on priority
        this.queueOperation(budgetedOp);
      }
    });
  }
  
  /**
   * Start a budgeted operation with timeout enforcement
   */
  private startBudgetedOperation(operation: BudgetedOperation): void {
    this.activeOperations.set(operation.id, operation);
    this.totalOperations++;
    
    // Set hard timeout
    operation.timeoutHandle = setTimeout(() => {
      this.handleTimeout(operation);
    }, operation.budget.budgetMs);
    
    // Set soft limit warning
    const softTimeoutHandle = setTimeout(() => {
      this.handleSoftLimit(operation);
    }, operation.budget.softLimitMs);
    
    // Execute operation
    operation.promise
      .then((result) => {
        this.completeOperation(operation, result, false);
      })
      .catch((error) => {
        this.completeOperation(operation, null, true, error);
      });
    
    console.log(`[LatencyBudgetEnforcer] Started ${operation.operation} (${operation.id}) with ${operation.budget.budgetMs}ms budget`);
  }
  
  /**
   * Handle operation timeout (hard budget exceeded)
   */
  private handleTimeout(operation: BudgetedOperation): void {
    const currentTime = process.hrtime.bigint();
    const elapsedMs = Number(currentTime - operation.startTime) / 1_000_000;
    
    console.error(`[LatencyBudgetEnforcer] BUDGET VIOLATION: ${operation.operation} exceeded ${operation.budget.budgetMs}ms (actual: ${elapsedMs.toFixed(2)}ms)`);
    
    // Record violation
    const violation: LatencyViolation = {
      operationId: operation.id,
      operation: operation.operation,
      budgetMs: operation.budget.budgetMs,
      actualMs: elapsedMs,
      overrunMs: elapsedMs - operation.budget.budgetMs,
      overrunPercent: ((elapsedMs - operation.budget.budgetMs) / operation.budget.budgetMs) * 100,
      timestamp: currentTime,
      action: operation.budget.fallbackStrategy as any,
      systemLoad: this.systemMetrics.overallSystemStress
    };
    
    this.recordViolation(violation);
    
    // Apply fallback strategy
    this.applyFallbackStrategy(operation, violation);
  }
  
  /**
   * Handle soft limit warning
   */
  private handleSoftLimit(operation: BudgetedOperation): void {
    const currentTime = process.hrtime.bigint();
    const elapsedMs = Number(currentTime - operation.startTime) / 1_000_000;
    
    console.warn(`[LatencyBudgetEnforcer] Soft limit warning: ${operation.operation} at ${elapsedMs.toFixed(2)}ms (limit: ${operation.budget.softLimitMs}ms)`);
    
    // Emit warning for monitoring
    this.emit('soft_limit_warning', {
      operationId: operation.id,
      operation: operation.operation,
      elapsedMs,
      softLimitMs: operation.budget.softLimitMs,
      budgetMs: operation.budget.budgetMs
    });
  }
  
  /**
   * Apply fallback strategy when budget is exceeded
   */
  private applyFallbackStrategy(operation: BudgetedOperation, violation: LatencyViolation): void {
    switch (operation.budget.fallbackStrategy) {
      case 'timeout':
        this.cancelOperation(operation.id, `Budget exceeded: ${violation.overrunMs.toFixed(2)}ms overrun`);
        break;
        
      case 'degrade':
        // Allow operation to continue but mark as degraded
        console.warn(`[LatencyBudgetEnforcer] Allowing degraded operation ${operation.id} to continue`);
        this.emit('operation_degraded', { operation, violation });
        break;
        
      case 'queue':
        // Move to lower priority queue (not implemented in this timeout scenario)
        console.warn(`[LatencyBudgetEnforcer] Operation ${operation.id} should be queued but already running`);
        break;
        
      case 'abort':
        this.cancelOperation(operation.id, 'Hard abort due to budget violation');
        break;
    }
  }
  
  /**
   * Cancel an operation
   */
  private cancelOperation(operationId: string, reason: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    
    // Abort the operation
    if (operation.abortController) {
      operation.abortController.abort();
    }
    
    // Clear timeout
    if (operation.timeoutHandle) {
      clearTimeout(operation.timeoutHandle);
    }
    
    // Reject the promise
    operation.reject(new Error(`Operation cancelled: ${reason}`));
    
    // Remove from active operations
    this.activeOperations.delete(operationId);
    
    console.log(`[LatencyBudgetEnforcer] Cancelled ${operation.operation} (${operationId}): ${reason}`);
    
    // Process next queued operation
    this.processNextQueuedOperation();
  }
  
  /**
   * Complete an operation successfully or with error
   */
  private completeOperation(operation: BudgetedOperation, result: any, isError: boolean, error?: Error): void {
    const endTime = process.hrtime.bigint();
    const elapsedMs = Number(endTime - operation.startTime) / 1_000_000;
    
    // Clear timeout
    if (operation.timeoutHandle) {
      clearTimeout(operation.timeoutHandle);
    }
    
    // Update statistics
    this.updateOperationStatistics(operation.operation, elapsedMs, operation.budget.budgetMs);
    
    // Remove from active operations
    this.activeOperations.delete(operation.id);
    
    if (isError) {
      operation.reject(error || new Error('Operation failed'));
      console.error(`[LatencyBudgetEnforcer] ${operation.operation} failed after ${elapsedMs.toFixed(2)}ms:`, error?.message);
    } else {
      operation.resolve(result);
      console.log(`[LatencyBudgetEnforcer] ${operation.operation} completed in ${elapsedMs.toFixed(2)}ms (budget: ${operation.budget.budgetMs}ms)`);
    }
    
    // Process next queued operation
    this.processNextQueuedOperation();
  }
  
  /**
   * Queue an operation based on priority
   */
  private queueOperation(operation: BudgetedOperation): void {
    // Insert based on priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const insertIndex = this.operationQueue.findIndex(
      op => priorityOrder[op.budget.priority] > priorityOrder[operation.budget.priority]
    );
    
    if (insertIndex === -1) {
      this.operationQueue.push(operation);
    } else {
      this.operationQueue.splice(insertIndex, 0, operation);
    }
    
    console.log(`[LatencyBudgetEnforcer] Queued ${operation.operation} (priority: ${operation.budget.priority}, queue size: ${this.operationQueue.length})`);
  }
  
  /**
   * Process next queued operation
   */
  private processNextQueuedOperation(): void {
    if (this.operationQueue.length > 0 && this.activeOperations.size < this.maxConcurrentOperations) {
      const nextOperation = this.operationQueue.shift();
      if (nextOperation) {
        this.startBudgetedOperation(nextOperation);
      }
    }
  }
  
  /**
   * Record latency violation
   */
  private recordViolation(violation: LatencyViolation): void {
    this.violations.push(violation);
    this.totalViolations++;
    
    // Keep only recent violations
    if (this.violations.length > 1000) {
      this.violations.splice(0, this.violations.length - 1000);
    }
    
    // Emit violation event
    this.emit('latency_violation', violation);
    
    // Check if emergency mode should be triggered
    this.checkEmergencyMode();
  }
  
  /**
   * Update operation statistics
   */
  private updateOperationStatistics(operation: string, elapsedMs: number, budgetMs: number): void {
    let stats = this.statistics.get(operation);
    if (!stats) {
      stats = {
        operation,
        totalExecutions: 0,
        violationsCount: 0,
        violationRate: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        maxLatency: 0,
        budgetUtilization: 0,
        adaptationCount: 0
      };
      this.statistics.set(operation, stats);
    }
    
    stats.totalExecutions++;
    stats.averageLatency = (stats.averageLatency * (stats.totalExecutions - 1) + elapsedMs) / stats.totalExecutions;
    stats.maxLatency = Math.max(stats.maxLatency, elapsedMs);
    stats.budgetUtilization = (stats.budgetUtilization * (stats.totalExecutions - 1) + (elapsedMs / budgetMs)) / stats.totalExecutions;
    
    if (elapsedMs > budgetMs) {
      stats.violationsCount++;
      stats.violationRate = stats.violationsCount / stats.totalExecutions;
    }
    
    // Update percentiles (simplified calculation)
    if (stats.totalExecutions % 100 === 0) {
      // Recalculate percentiles every 100 operations
      this.recalculatePercentiles(operation);
    }
  }
  
  /**
   * Recalculate percentiles for an operation
   */
  private recalculatePercentiles(operation: string): void {
    // This is a simplified implementation
    // In production, you'd want to maintain a proper histogram
    const stats = this.statistics.get(operation);
    if (!stats) return;
    
    // Use average latency as approximation for percentiles
    stats.p95Latency = stats.averageLatency * 1.5;
    stats.p99Latency = stats.averageLatency * 2.0;
  }
  
  /**
   * Start system monitoring for adaptive control
   */
  private startSystemMonitoring(): void {
    const monitoringInterval = 1000; // 1 second
    
    const monitor = () => {
      if (!this.isRunning) return;
      
      try {
        this.updateSystemMetrics();
        this.adjustSystemLoadBasedLimits();
      } catch (error) {
        console.error('[LatencyBudgetEnforcer] System monitoring error:', error);
      }
      
      setTimeout(monitor, monitoringInterval);
    };
    
    monitor();
  }
  
  /**
   * Update system performance metrics
   */
  private updateSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    
    this.systemMetrics = {
      cpuLoad: process.cpuUsage().user / 1000000, // Simplified CPU load
      memoryLoad: memoryUsage.heapUsed / memoryUsage.heapTotal,
      eventLoopDelay: 0, // Would need async_hooks for real measurement
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      overallSystemStress: Math.min(1, (
        this.systemMetrics.cpuLoad * 0.4 +
        this.systemMetrics.memoryLoad * 0.3 +
        (this.activeOperations.size / this.maxConcurrentOperations) * 0.3
      ))
    };
  }
  
  /**
   * Adjust system limits based on current load
   */
  private adjustSystemLoadBasedLimits(): void {
    if (this.systemMetrics.overallSystemStress > 0.8) {
      // Reduce concurrent operations under high stress
      this.maxConcurrentOperations = Math.max(2, Math.floor(this.maxConcurrentOperations * 0.8));
    } else if (this.systemMetrics.overallSystemStress < 0.3) {
      // Increase concurrent operations under low stress
      this.maxConcurrentOperations = Math.min(20, Math.floor(this.maxConcurrentOperations * 1.1));
    }
  }
  
  /**
   * Start operation processing queue
   */
  private startOperationProcessing(): void {
    const processingInterval = 10; // 10ms
    
    const process = () => {
      if (!this.isRunning) return;
      
      this.processNextQueuedOperation();
      setTimeout(process, processingInterval);
    };
    
    process();
  }
  
  /**
   * Start budget adaptation based on performance
   */
  private startBudgetAdaptation(): void {
    const adaptationInterval = 30000; // 30 seconds
    
    const adapt = () => {
      if (!this.isRunning) return;
      
      try {
        this.adaptBudgetsBasedOnPerformance();
      } catch (error) {
        console.error('[LatencyBudgetEnforcer] Budget adaptation error:', error);
      }
      
      setTimeout(adapt, adaptationInterval);
    };
    
    setTimeout(adapt, adaptationInterval);
  }
  
  /**
   * Adapt budgets based on actual performance
   */
  private adaptBudgetsBasedOnPerformance(): void {
    for (const [operation, stats] of this.statistics) {
      const budget = this.budgets.get(operation);
      if (!budget || !budget.adaptable) continue;
      
      // Adapt budget if violation rate is too high
      if (stats.violationRate > this.violationThreshold) {
        const newBudget = Math.min(budget.budgetMs * 1.2, budget.budgetMs + 100);
        console.log(`[LatencyBudgetEnforcer] Adapting ${operation} budget: ${budget.budgetMs}ms → ${newBudget}ms (violation rate: ${(stats.violationRate * 100).toFixed(1)}%)`);
        
        budget.budgetMs = newBudget;
        budget.softLimitMs = newBudget * 0.8;
        stats.adaptationCount++;
      }
    }
  }
  
  /**
   * Check if emergency mode should be triggered
   */
  private checkEmergencyMode(): void {
    const recentViolations = this.violations.slice(-100); // Last 100 violations
    const criticalViolations = recentViolations.filter(v => v.operation === 'threat_detection').length;
    
    if (criticalViolations > 10 && !this.emergencyMode) {
      this.activateEmergencyMode();
    } else if (criticalViolations < 2 && this.emergencyMode) {
      this.deactivateEmergencyMode();
    }
  }
  
  /**
   * Activate emergency mode
   */
  private activateEmergencyMode(): void {
    this.emergencyMode = true;
    this.maxConcurrentOperations = Math.max(1, this.maxConcurrentOperations / 2);
    
    console.error('[LatencyBudgetEnforcer] 🚨 EMERGENCY MODE ACTIVATED - Too many threat detection violations');
    this.emit('emergency_mode_activated');
  }
  
  /**
   * Deactivate emergency mode
   */
  private deactivateEmergencyMode(): void {
    this.emergencyMode = false;
    this.maxConcurrentOperations *= 2;
    
    console.log('[LatencyBudgetEnforcer] Emergency mode deactivated');
    this.emit('emergency_mode_deactivated');
  }
  
  /**
   * Initialize default budgets
   */
  private initializeDefaultBudgets(): void {
    for (const budget of this.defaultBudgets) {
      this.budgets.set(budget.operation, { ...budget });
    }
    
    console.log(`[LatencyBudgetEnforcer] Initialized ${this.defaultBudgets.length} default budgets`);
  }
  
  /**
   * Get budget for operation
   */
  private getBudgetForOperation(operation: string, customBudget?: Partial<LatencyBudget>): LatencyBudget {
    const defaultBudget = this.budgets.get(operation) || this.budgets.get('data_processing')!;
    
    return {
      ...defaultBudget,
      operation,
      ...customBudget
    };
  }
  
  /**
   * Get comprehensive latency report
   */
  getLatencyReport() {
    return {
      timestamp: process.hrtime.bigint(),
      totalOperations: this.totalOperations,
      totalViolations: this.totalViolations,
      overallViolationRate: this.totalViolations / this.totalOperations,
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      emergencyMode: this.emergencyMode,
      systemMetrics: this.systemMetrics,
      budgets: Array.from(this.budgets.entries()),
      statistics: Array.from(this.statistics.entries()),
      recentViolations: this.violations.slice(-20) // Last 20 violations
    };
  }
  
  /**
   * Get threat detection specific metrics
   */
  getThreatDetectionMetrics() {
    const threatStats = this.statistics.get('threat_detection');
    const threatViolations = this.violations.filter(v => v.operation === 'threat_detection');
    
    return {
      budget: this.budgets.get('threat_detection'),
      statistics: threatStats,
      recentViolations: threatViolations.slice(-10),
      status: threatStats && threatStats.violationRate < 0.05 ? 'COMPLIANT' : 'NON_COMPLIANT'
    };
  }
}

export { LatencyBudget, LatencyViolation, LatencyStatistics };