import { storage } from "../storage";
import { type InsertErrorLog, type ErrorLog } from "@shared/schema";
import os from "os";
import { EventEmitter } from "events";
import { privacyProtectionService } from "./privacy-protection";

interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestUrl?: string;
  requestMethod?: string;
  statusCode?: number;
  userAgent?: string;
  ipAddress?: string;
  additionalData?: any;
}

interface RateLimitEntry {
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
}

export class ErrorTrackingService extends EventEmitter {
  private static instance: ErrorTrackingService;
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private ipRateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly MAX_ERRORS_PER_WINDOW = 10;
  private readonly MAX_ERRORS_PER_IP = 20; // Max errors per IP per minute
  private isDebugMode = process.env.DEBUG_MODE === "true";
  private performanceMetrics: Map<string, number[]> = new Map();

  private constructor() {
    super();
    try {
      this.setupGlobalErrorHandlers();
      this.startMetricsCollection();
      this.startRateLimitCleanup();
    } catch (error) {
      console.error('Error tracking service initialization failed:', error);
    }
  }

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  private setupGlobalErrorHandlers(): void {
    process.on("uncaughtException", (error: Error) => {
      console.error("Uncaught Exception:", error?.message || "Unknown error");
      this.logError({
        error,
        errorType: "uncaught_exception",
        severity: "critical",
        context: {
          additionalData: {
            processInfo: {
              pid: process.pid,
              uptime: process.uptime(),
              memoryUsage: process.memoryUsage(),
              platform: process.platform,
              nodeVersion: process.version
            }
          }
        }
      });
    });

    process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
      console.error("Unhandled Rejection:", reason?.message || String(reason));
      this.logError({
        error: reason instanceof Error ? reason : new Error(String(reason)),
        errorType: "unhandled_rejection",
        severity: "high",
        context: {
          additionalData: {
            promise: String(promise),
            reason: String(reason)
          }
        }
      });
    });
  }

  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      const metrics = this.collectSystemMetrics();
      this.emit("metrics:update", metrics);
    }, 30000);
  }

  private startRateLimitCleanup(): void {
    // Clean up old rate limit entries every minute
    setInterval(() => {
      const now = Date.now();
      
      // Clean up error key rate limits
      for (const [key, entry] of Array.from(this.rateLimitMap.entries())) {
        if (now - entry.firstOccurrence.getTime() > this.RATE_LIMIT_WINDOW) {
          this.rateLimitMap.delete(key);
        }
      }
      
      // Clean up IP rate limits
      for (const [ip, data] of Array.from(this.ipRateLimitMap.entries())) {
        if (data.resetTime <= now) {
          this.ipRateLimitMap.delete(ip);
        }
      }
    }, 60000);
  }

  public shouldRateLimitIP(ipAddress: string): boolean {
    const now = Date.now();
    const ipData = this.ipRateLimitMap.get(ipAddress);
    
    if (ipData) {
      if (ipData.resetTime > now) {
        if (ipData.count >= this.MAX_ERRORS_PER_IP) {
          return true; // Rate limit exceeded
        }
        ipData.count++;
      } else {
        // Reset window
        ipData.count = 1;
        ipData.resetTime = now + this.RATE_LIMIT_WINDOW;
      }
    } else {
      // First error from this IP
      this.ipRateLimitMap.set(ipAddress, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
    }
    
    return false;
  }

  private collectSystemMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    return {
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        percentage: memoryUsagePercent,
        process: process.memoryUsage()
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: os.loadavg()
      },
      system: {
        platform: os.platform(),
        release: os.release(),
        uptime: uptime,
        nodeVersion: process.version
      },
      timestamp: new Date()
    };
  }

  private shouldRateLimit(errorKey: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(errorKey);

    if (!entry) {
      this.rateLimitMap.set(errorKey, {
        count: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date()
      });
      return false;
    }

    // Clean up old entries
    if (now - entry.firstOccurrence.getTime() > this.RATE_LIMIT_WINDOW) {
      this.rateLimitMap.set(errorKey, {
        count: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date()
      });
      return false;
    }

    entry.count++;
    entry.lastOccurrence = new Date();

    if (entry.count > this.MAX_ERRORS_PER_WINDOW) {
      return true;
    }

    return false;
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || "";

    if (message.includes("database") || message.includes("sql") || stack.includes("pg-core")) {
      return "database";
    }
    if (message.includes("validation") || message.includes("invalid") || message.includes("required")) {
      return "validation";
    }
    if (message.includes("auth") || message.includes("token") || message.includes("permission")) {
      return "authentication";
    }
    if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
      return "network";
    }
    if (message.includes("api") || stack.includes("/api/")) {
      return "api";
    }
    if (message.includes("websocket") || message.includes("socket")) {
      return "websocket";
    }
    
    return "general";
  }

  private determineSeverity(error: Error, explicitSeverity?: string): string {
    if (explicitSeverity) return explicitSeverity;

    const message = error.message.toLowerCase();
    
    if (message.includes("critical") || message.includes("fatal") || message.includes("crash")) {
      return "critical";
    }
    if (message.includes("error") || message.includes("fail")) {
      return "high";
    }
    if (message.includes("warning") || message.includes("deprecated")) {
      return "medium";
    }
    
    return "low";
  }

  async logError(params: {
    error: Error | string;
    errorType?: string;
    severity?: string;
    context?: ErrorContext;
  }): Promise<ErrorLog | null> {
    try {
      const error = typeof params.error === "string" 
        ? new Error(params.error) 
        : params.error;

      const errorType = params.errorType || this.categorizeError(error);
      const errorKey = `${errorType}:${error.message}`;

      // Check rate limiting
      if (this.shouldRateLimit(errorKey)) {
        if (this.isDebugMode) {
          console.log(`Rate limited error: ${errorKey}`);
        }
        return null;
      }

      const severity = this.determineSeverity(error, params.severity);
      const context = params.context || {};

      // Add environment details
      const enrichedContext = {
        ...context,
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
        systemMetrics: this.collectSystemMetrics()
      };

      // Truncate large data to prevent storage issues
      const MAX_STACK_LENGTH = 5000;
      const MAX_MESSAGE_LENGTH = 1000;
      const MAX_CONTEXT_SIZE = 50000; // 50KB for context
      
      let truncatedStack = error.stack;
      if (truncatedStack && truncatedStack.length > MAX_STACK_LENGTH) {
        truncatedStack = truncatedStack.substring(0, MAX_STACK_LENGTH) + '\n[Stack trace truncated]';
      }
      
      let truncatedMessage = error.message;
      if (truncatedMessage.length > MAX_MESSAGE_LENGTH) {
        truncatedMessage = truncatedMessage.substring(0, MAX_MESSAGE_LENGTH) + '...';
      }
      
      // Check context size and truncate if needed
      let finalContext = enrichedContext;
      const contextStr = JSON.stringify(enrichedContext);
      if (contextStr.length > MAX_CONTEXT_SIZE) {
        // Keep only essential fields when truncating
        finalContext = enrichedContext;
      }

      const errorLog: InsertErrorLog = {
        errorType,
        message: truncatedMessage,
        stack: truncatedStack,
        severity: severity as "low" | "medium" | "high" | "critical",
        userId: context.userId,
        requestUrl: context.requestUrl,
        requestMethod: context.requestMethod,
        statusCode: context.statusCode,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        sessionId: context.sessionId,
        context: finalContext,
        environment: process.env.NODE_ENV || "development",
        errorCount: this.rateLimitMap.get(errorKey)?.count || 1,
        isResolved: false
      };

      const savedError = await storage.createErrorLog(errorLog);

      // Emit event for real-time updates
      this.emit("error:new", savedError);

      // Log to console in debug mode
      if (this.isDebugMode) {
        console.error(`[ERROR_TRACKING] ${severity.toUpperCase()} - ${errorType}:`, error.message);
        if (error.stack) {
          console.error("Stack trace:", error.stack);
        }
      }

      return savedError;
    } catch (loggingError) {
      console.error("Failed to log error:", loggingError);
      return null;
    }
  }

  async markErrorResolved(errorId: string, resolvedBy: string): Promise<void> {
    await storage.markErrorResolved(errorId, resolvedBy);
    const error = await storage.getErrorLogById(errorId);
    if (error) {
      this.emit("error:resolved", error);
    }
  }

  async getErrorStats(hours = 24) {
    return storage.getErrorStats(hours);
  }

  async getRecentErrors(hours = 24, limit = 100) {
    return storage.getRecentErrors(hours, limit);
  }

  recordPerformanceMetric(endpoint: string, duration: number): void {
    if (!this.performanceMetrics.has(endpoint)) {
      this.performanceMetrics.set(endpoint, []);
    }
    
    const metrics = this.performanceMetrics.get(endpoint)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    // Log slow endpoints
    if (duration > 1000 && this.isDebugMode) {
      console.warn(`Slow endpoint detected: ${endpoint} took ${duration}ms`);
      this.logError({
        error: new Error(`Slow endpoint: ${endpoint}`),
        errorType: "performance",
        severity: "medium",
        context: {
          additionalData: {
            endpoint,
            duration,
            averageDuration: this.getAveragePerformance(endpoint)
          }
        }
      });
    }
  }

  getAveragePerformance(endpoint: string): number {
    const metrics = this.performanceMetrics.get(endpoint);
    if (!metrics || metrics.length === 0) return 0;
    
    const sum = metrics.reduce((a, b) => a + b, 0);
    return sum / metrics.length;
  }

  getPerformanceReport(): Record<string, { average: number; count: number; max: number; min: number }> {
    const report: Record<string, any> = {};
    
    this.performanceMetrics.forEach((metrics, endpoint) => {
      if (metrics.length > 0) {
        report[endpoint] = {
          average: this.getAveragePerformance(endpoint),
          count: metrics.length,
          max: Math.max(...metrics),
          min: Math.min(...metrics)
        };
      }
    });
    
    return report;
  }

  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
    console.log(`Debug mode ${enabled ? "enabled" : "disabled"}`);
  }

  isDebugEnabled(): boolean {
    return this.isDebugMode;
  }
}

export const errorTrackingService = ErrorTrackingService.getInstance();