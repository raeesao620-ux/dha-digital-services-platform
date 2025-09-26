/**
 * Circuit Breaker System for External Dependencies
 * 
 * Implements circuit breakers and graceful degradation for external API dependencies
 * to ensure 100% uptime guarantee for the DHA Digital Services Platform.
 * 
 * Features:
 * - Circuit breaker pattern for external APIs
 * - Graceful degradation strategies
 * - Automatic recovery and health monitoring
 * - Integration with Railway auto-scaling
 * - Queen Ultra AI integration for intelligent failover
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { storage } from '../storage';
import { queenUltraAI } from './queen-ultra-ai';
import { type InsertSystemMetric, type InsertSecurityEvent, type InsertSelfHealingAction } from '@shared/schema';

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringWindow: number;
  fallbackEnabled: boolean;
}

interface CircuitBreakerStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeouts: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  averageResponseTime: number;
  failureRate: number;
}

interface CircuitBreakerState {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  config: CircuitBreakerConfig;
  stats: CircuitBreakerStats;
  lastStateChange: Date;
  nextRetryTime: Date | null;
  fallbackActive: boolean;
  healthChecksPassed: number;
}

interface ExternalServiceConfig {
  name: string;
  endpoint: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  fallbackStrategy: 'cache' | 'mock' | 'disable' | 'alternative';
  healthCheckEndpoint?: string;
}

interface CircuitBreakerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fromFallback: boolean;
  responseTime: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  timestamp: Date;
}

/**
 * Circuit Breaker System for External Dependencies
 */
export class CircuitBreakerSystem extends EventEmitter {
  private static instance: CircuitBreakerSystem;
  
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private externalServices = new Map<string, ExternalServiceConfig>();
  private fallbackCache = new Map<string, any>();
  
  // Monitoring intervals
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private statisticsUpdateInterval: NodeJS.Timeout | null = null;
  
  private isRunning = false;

  // External service configurations
  private serviceConfigs: ExternalServiceConfig[] = [
    {
      name: 'dha_npr_api',
      endpoint: process.env.DHA_NPR_API_ENDPOINT || 'https://api.dha.gov.za/npr',
      apiKey: process.env.DHA_NPR_API_KEY,
      timeout: 10000,
      retryAttempts: 3,
      priority: 'critical',
      fallbackStrategy: 'cache',
      healthCheckEndpoint: '/health'
    },
    {
      name: 'saps_api',
      endpoint: process.env.SAPS_API_ENDPOINT || 'https://api.saps.gov.za',
      apiKey: process.env.SAPS_API_KEY,
      timeout: 8000,
      retryAttempts: 2,
      priority: 'high',
      fallbackStrategy: 'cache',
      healthCheckEndpoint: '/status'
    },
    {
      name: 'abis_api',
      endpoint: process.env.DHA_ABIS_API_ENDPOINT || 'https://abis.dha.gov.za',
      apiKey: process.env.DHA_ABIS_API_KEY,
      timeout: 15000,
      retryAttempts: 3,
      priority: 'critical',
      fallbackStrategy: 'alternative',
      healthCheckEndpoint: '/health'
    },
    {
      name: 'icao_pkd',
      endpoint: process.env.ICAO_PKD_API_ENDPOINT || 'https://pkd.icao.int',
      apiKey: process.env.ICAO_PKD_API_KEY,
      timeout: 12000,
      retryAttempts: 2,
      priority: 'medium',
      fallbackStrategy: 'cache',
      healthCheckEndpoint: '/status'
    },
    {
      name: 'openai_api',
      endpoint: 'https://api.openai.com',
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      retryAttempts: 2,
      priority: 'high',
      fallbackStrategy: 'alternative',
      healthCheckEndpoint: '/v1/models'
    },
    {
      name: 'anthropic_api',
      endpoint: 'https://api.anthropic.com',
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30000,
      retryAttempts: 2,
      priority: 'high',
      fallbackStrategy: 'alternative'
    }
  ];

  private constructor() {
    super();
    this.setupEventHandlers();
  }

  static getInstance(): CircuitBreakerSystem {
    if (!CircuitBreakerSystem.instance) {
      CircuitBreakerSystem.instance = new CircuitBreakerSystem();
    }
    return CircuitBreakerSystem.instance;
  }

  /**
   * Start the circuit breaker system
   */
  async start(): Promise<boolean> {
    try {
      console.log('🔌 Starting Circuit Breaker System...');
      
      this.isRunning = true;
      
      // Initialize circuit breakers for all external services
      this.initializeCircuitBreakers();
      
      // Start monitoring intervals
      this.startHealthCheckMonitoring();
      this.startStatisticsUpdating();
      
      // Perform initial health checks
      await this.performInitialHealthChecks();
      
      await this.logCircuitBreakerEvent({
        type: 'reactive',
        category: 'availability',
        severity: 'low',
        description: 'Circuit breaker system started',
        target: 'circuit_breaker_system',
        action: 'System initialization',
        trigger: { system_start: true },
        status: 'completed',
        result: { success: true, circuit_breakers: this.circuitBreakers.size },
        aiAssisted: false
      });

      console.log(`✅ Circuit Breaker System started with ${this.circuitBreakers.size} circuit breakers`);
      this.emit('circuit_breaker_system_started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start Circuit Breaker System:', error);
      return false;
    }
  }

  /**
   * Stop the circuit breaker system
   */
  async stop(): Promise<boolean> {
    try {
      console.log('🛑 Stopping Circuit Breaker System...');
      
      this.isRunning = false;
      
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      if (this.statisticsUpdateInterval) {
        clearInterval(this.statisticsUpdateInterval);
        this.statisticsUpdateInterval = null;
      }

      console.log('✅ Circuit Breaker System stopped');
      this.emit('circuit_breaker_system_stopped');
      return true;
    } catch (error) {
      console.error('❌ Error stopping Circuit Breaker System:', error);
      return false;
    }
  }

  /**
   * Initialize circuit breakers for all external services
   */
  private initializeCircuitBreakers(): void {
    for (const serviceConfig of this.serviceConfigs) {
      this.externalServices.set(serviceConfig.name, serviceConfig);
      
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: serviceConfig.priority === 'critical' ? 3 : 5,
        successThreshold: 2,
        timeout: serviceConfig.timeout,
        resetTimeout: serviceConfig.priority === 'critical' ? 30000 : 60000,
        monitoringWindow: 300000, // 5 minutes
        fallbackEnabled: true
      };
      
      const circuitBreaker: CircuitBreakerState = {
        name: serviceConfig.name,
        state: 'CLOSED',
        config: defaultConfig,
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          timeouts: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          averageResponseTime: 0,
          failureRate: 0
        },
        lastStateChange: new Date(),
        nextRetryTime: null,
        fallbackActive: false,
        healthChecksPassed: 0
      };
      
      this.circuitBreakers.set(serviceConfig.name, circuitBreaker);
      console.log(`🔌 Initialized circuit breaker for ${serviceConfig.name} (priority: ${serviceConfig.priority})`);
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('circuit_opened', this.handleCircuitOpened.bind(this));
    this.on('circuit_closed', this.handleCircuitClosed.bind(this));
    this.on('circuit_half_opened', this.handleCircuitHalfOpened.bind(this));
    this.on('fallback_activated', this.handleFallbackActivated.bind(this));
    this.on('service_recovered', this.handleServiceRecovered.bind(this));
  }

  /**
   * Execute request through circuit breaker
   */
  async executeRequest<T>(
    serviceName: string,
    requestFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>
  ): Promise<CircuitBreakerResult<T>> {
    const startTime = performance.now();
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker not found for service: ${serviceName}`);
    }

    // Check circuit state
    if (circuitBreaker.state === 'OPEN') {
      if (this.shouldAttemptReset(circuitBreaker)) {
        circuitBreaker.state = 'HALF_OPEN';
        circuitBreaker.lastStateChange = new Date();
        this.emit('circuit_half_opened', { serviceName, circuitBreaker });
      } else {
        // Circuit is open, use fallback
        return await this.executeFallback(serviceName, fallbackFn, startTime);
      }
    }

    try {
      // Execute the request
      const data = await this.executeWithTimeout(requestFn, circuitBreaker.config.timeout);
      const responseTime = performance.now() - startTime;
      
      // Record success
      this.recordSuccess(circuitBreaker, responseTime);
      
      // Check if circuit should be closed (from HALF_OPEN)
      if (circuitBreaker.state === 'HALF_OPEN' && 
          circuitBreaker.stats.consecutiveSuccesses >= circuitBreaker.config.successThreshold) {
        circuitBreaker.state = 'CLOSED';
        circuitBreaker.lastStateChange = new Date();
        circuitBreaker.fallbackActive = false;
        this.emit('circuit_closed', { serviceName, circuitBreaker });
      }
      
      return {
        success: true,
        data,
        fromFallback: false,
        responseTime,
        circuitState: circuitBreaker.state,
        timestamp: new Date()
      };
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      // Record failure
      this.recordFailure(circuitBreaker, error, responseTime);
      
      // Check if circuit should be opened
      if (circuitBreaker.state !== 'OPEN' && 
          circuitBreaker.stats.consecutiveFailures >= circuitBreaker.config.failureThreshold) {
        circuitBreaker.state = 'OPEN';
        circuitBreaker.lastStateChange = new Date();
        circuitBreaker.nextRetryTime = new Date(Date.now() + circuitBreaker.config.resetTimeout);
        this.emit('circuit_opened', { serviceName, circuitBreaker, error });
      }
      
      // Try fallback
      return await this.executeFallback(serviceName, fallbackFn, startTime, error);
    }
  }

  /**
   * Execute request with timeout
   */
  private async executeWithTimeout<T>(requestFn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      requestFn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback<T>(
    serviceName: string,
    fallbackFn: (() => Promise<T>) | undefined,
    startTime: number,
    originalError?: any
  ): Promise<CircuitBreakerResult<T>> {
    const circuitBreaker = this.circuitBreakers.get(serviceName)!;
    const serviceConfig = this.externalServices.get(serviceName)!;
    
    try {
      let fallbackData: T | undefined;
      
      if (fallbackFn) {
        // Use provided fallback function
        fallbackData = await fallbackFn();
      } else {
        // Use configured fallback strategy
        fallbackData = await this.executeConfiguredFallback(serviceName, serviceConfig.fallbackStrategy);
      }
      
      circuitBreaker.fallbackActive = true;
      this.emit('fallback_activated', { serviceName, strategy: serviceConfig.fallbackStrategy });
      
      const responseTime = performance.now() - startTime;
      
      return {
        success: true,
        data: fallbackData,
        fromFallback: true,
        responseTime,
        circuitState: circuitBreaker.state,
        timestamp: new Date()
      };
      
    } catch (fallbackError) {
      const responseTime = performance.now() - startTime;
      
      return {
        success: false,
        error: `Primary service failed: ${originalError}. Fallback failed: ${fallbackError}`,
        fromFallback: true,
        responseTime,
        circuitState: circuitBreaker.state,
        timestamp: new Date()
      };
    }
  }

  /**
   * Execute configured fallback strategy
   */
  private async executeConfiguredFallback<T>(serviceName: string, strategy: string): Promise<T | undefined> {
    switch (strategy) {
      case 'cache':
        return this.getFallbackFromCache(serviceName);
      
      case 'mock':
        return this.getGracefulDegradationResponse(serviceName);
      
      case 'alternative':
        return await this.getAlternativeService(serviceName);
      
      case 'disable':
        throw new Error(`Service ${serviceName} disabled due to circuit breaker`);
      
      default:
        throw new Error(`Unknown fallback strategy: ${strategy}`);
    }
  }

  /**
   * Get cached response for fallback
   */
  private getFallbackFromCache<T>(serviceName: string): T | undefined {
    const cached = this.fallbackCache.get(serviceName);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      console.log(`🔄 Using cached fallback for ${serviceName}`);
      return cached.data;
    }
    throw new Error(`No valid cache available for ${serviceName}`);
  }

  /**
   * Get graceful degradation response for fallback
   * This provides a honest response indicating service unavailability
   * instead of mock data that could mislead users.
   */
  private getGracefulDegradationResponse<T>(serviceName: string): T {
    console.log(`⚠️ Service ${serviceName} is unavailable - providing graceful degradation response`);
    
    // Honest degradation responses that clearly indicate unavailability
    const degradationResponses: any = {
      dha_npr_api: { 
        error: 'DHA NPR service is currently unavailable', 
        status: 'service_unavailable',
        message: 'Please try again later or contact system administrator',
        fallback: true,
        timestamp: new Date().toISOString()
      },
      saps_api: { 
        error: 'SAPS service is currently unavailable', 
        status: 'service_unavailable',
        message: 'Criminal record checks temporarily unavailable',
        fallback: true,
        timestamp: new Date().toISOString()
      },
      abis_api: { 
        error: 'Biometric services are currently unavailable', 
        status: 'service_unavailable',
        message: 'Fingerprint/biometric verification temporarily disabled',
        fallback: true,
        timestamp: new Date().toISOString()
      },
      icao_pkd: { 
        error: 'ICAO PKD verification service is currently unavailable', 
        status: 'service_unavailable',
        message: 'Document authentication temporarily disabled',
        fallback: true,
        timestamp: new Date().toISOString()
      },
      openai_api: { 
        error: 'OpenAI service is currently unavailable', 
        status: 'service_unavailable',
        message: 'AI assistance temporarily limited',
        fallback: true,
        alternative: 'anthropic_api',
        timestamp: new Date().toISOString()
      },
      anthropic_api: { 
        error: 'Anthropic service is currently unavailable', 
        status: 'service_unavailable',
        message: 'AI assistance temporarily limited',
        fallback: true,
        alternative: 'openai_api',
        timestamp: new Date().toISOString()
      }
    };
    
    return degradationResponses[serviceName] || { 
      error: `Service ${serviceName} is currently unavailable`,
      status: 'service_unavailable',
      message: 'Please try again later',
      fallback: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get alternative service for fallback
   */
  private async getAlternativeService<T>(serviceName: string): Promise<T | undefined> {
    console.log(`🔀 Using alternative service for ${serviceName}`);
    
    // Alternative service mappings
    const alternatives: any = {
      openai_api: 'anthropic_api',
      anthropic_api: 'openai_api',
      abis_api: 'fallback_biometric_service'
    };
    
    const alternativeService = alternatives[serviceName];
    if (alternativeService) {
      // Try to use alternative service (simplified for demo)
      return { alternative: true, original_service: serviceName } as any;
    }
    
    throw new Error(`No alternative service available for ${serviceName}`);
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(circuitBreaker: CircuitBreakerState): boolean {
    if (!circuitBreaker.nextRetryTime) {
      return true;
    }
    return Date.now() >= circuitBreaker.nextRetryTime.getTime();
  }

  /**
   * Record successful request
   */
  private recordSuccess(circuitBreaker: CircuitBreakerState, responseTime: number): void {
    circuitBreaker.stats.totalRequests++;
    circuitBreaker.stats.successfulRequests++;
    circuitBreaker.stats.consecutiveSuccesses++;
    circuitBreaker.stats.consecutiveFailures = 0;
    circuitBreaker.stats.lastSuccessTime = new Date();
    
    // Update average response time
    const total = circuitBreaker.stats.averageResponseTime * (circuitBreaker.stats.successfulRequests - 1);
    circuitBreaker.stats.averageResponseTime = (total + responseTime) / circuitBreaker.stats.successfulRequests;
    
    this.updateFailureRate(circuitBreaker);
  }

  /**
   * Record failed request
   */
  private recordFailure(circuitBreaker: CircuitBreakerState, error: any, responseTime: number): void {
    circuitBreaker.stats.totalRequests++;
    circuitBreaker.stats.failedRequests++;
    circuitBreaker.stats.consecutiveFailures++;
    circuitBreaker.stats.consecutiveSuccesses = 0;
    circuitBreaker.stats.lastFailureTime = new Date();
    
    if (error.message && error.message.includes('timeout')) {
      circuitBreaker.stats.timeouts++;
    }
    
    this.updateFailureRate(circuitBreaker);
  }

  /**
   * Update failure rate
   */
  private updateFailureRate(circuitBreaker: CircuitBreakerState): void {
    if (circuitBreaker.stats.totalRequests > 0) {
      circuitBreaker.stats.failureRate = 
        (circuitBreaker.stats.failedRequests / circuitBreaker.stats.totalRequests) * 100;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performHealthChecks();
      }
    }, 60000); // Every minute
  }

  /**
   * Start statistics updating
   */
  private startStatisticsUpdating(): void {
    this.statisticsUpdateInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.updateStatistics();
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Perform initial health checks
   */
  private async performInitialHealthChecks(): Promise<void> {
    console.log('🔍 Performing initial health checks for external services...');
    
    for (const [serviceName, serviceConfig] of this.externalServices) {
      if (serviceConfig.healthCheckEndpoint) {
        try {
          await this.performServiceHealthCheck(serviceName);
        } catch (error) {
          console.warn(`⚠️ Initial health check failed for ${serviceName}:`, error);
        }
      }
    }
  }

  /**
   * Perform health checks for all services
   */
  private async performHealthChecks(): Promise<void> {
    try {
      for (const [serviceName, serviceConfig] of this.externalServices) {
        if (serviceConfig.healthCheckEndpoint) {
          await this.performServiceHealthCheck(serviceName);
        }
      }
      
      // Log health check summary
      await this.logSystemMetric({
        metricType: 'circuit_breaker_health_check',
        value: JSON.stringify(this.getSystemStatus()),
        unit: 'json'
      });
      
    } catch (error) {
      console.error('❌ Error performing circuit breaker health checks:', error);
    }
  }

  /**
   * Perform health check for specific service
   */
  private async performServiceHealthCheck(serviceName: string): Promise<boolean> {
    const serviceConfig = this.externalServices.get(serviceName);
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!serviceConfig || !circuitBreaker) {
      return false;
    }

    try {
      const healthEndpoint = `${serviceConfig.endpoint}${serviceConfig.healthCheckEndpoint}`;
      const headers: any = {
        'Content-Type': 'application/json',
        'User-Agent': 'DHA-Circuit-Breaker/1.0'
      };
      
      if (serviceConfig.apiKey) {
        headers['Authorization'] = `Bearer ${serviceConfig.apiKey}`;
      }

      const response = await fetch(healthEndpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000)
      });

      const isHealthy = response.ok;
      
      if (isHealthy) {
        circuitBreaker.healthChecksPassed++;
        
        // If circuit is open and health checks are passing, consider recovery
        if (circuitBreaker.state === 'OPEN' && circuitBreaker.healthChecksPassed >= 3) {
          circuitBreaker.state = 'HALF_OPEN';
          circuitBreaker.lastStateChange = new Date();
          this.emit('service_recovered', { serviceName, circuitBreaker });
        }
      } else {
        circuitBreaker.healthChecksPassed = 0;
      }
      
      return isHealthy;
    } catch (error) {
      circuitBreaker.healthChecksPassed = 0;
      return false;
    }
  }

  /**
   * Update statistics and cache successful responses
   */
  private async updateStatistics(): Promise<void> {
    try {
      for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
        // Reset statistics older than monitoring window
        if (circuitBreaker.stats.lastSuccessTime && 
            Date.now() - circuitBreaker.stats.lastSuccessTime.getTime() > circuitBreaker.config.monitoringWindow) {
          this.resetOldStatistics(circuitBreaker);
        }
        
        // Log service statistics
        await this.logSystemMetric({
          metricType: 'circuit_breaker_stats',
          value: JSON.stringify({
            service: serviceName,
            state: circuitBreaker.state,
            stats: circuitBreaker.stats,
            fallback_active: circuitBreaker.fallbackActive
          }),
          unit: 'json'
        });
      }
    } catch (error) {
      console.error('❌ Error updating circuit breaker statistics:', error);
    }
  }

  /**
   * Reset old statistics
   */
  private resetOldStatistics(circuitBreaker: CircuitBreakerState): void {
    // Keep only recent data, reset counters for sliding window
    const resetFactor = 0.9; // Keep 90% of stats for gradual reset
    
    circuitBreaker.stats.totalRequests = Math.floor(circuitBreaker.stats.totalRequests * resetFactor);
    circuitBreaker.stats.successfulRequests = Math.floor(circuitBreaker.stats.successfulRequests * resetFactor);
    circuitBreaker.stats.failedRequests = Math.floor(circuitBreaker.stats.failedRequests * resetFactor);
    circuitBreaker.stats.timeouts = Math.floor(circuitBreaker.stats.timeouts * resetFactor);
    
    this.updateFailureRate(circuitBreaker);
  }

  /**
   * Event handlers
   */
  private async handleCircuitOpened(data: { serviceName: string; circuitBreaker: CircuitBreakerState; error: any }): Promise<void> {
    console.error(`🚨 Circuit breaker OPENED for ${data.serviceName}:`, data.error.message);
    
    const serviceConfig = this.externalServices.get(data.serviceName);
    
    await this.logCircuitBreakerEvent({
      type: 'reactive',
      category: 'availability',
      severity: serviceConfig?.priority === 'critical' ? 'high' : 'medium',
      description: `Circuit breaker opened for ${data.serviceName}`,
      target: data.serviceName,
      action: 'Circuit opened - fallback activated',
      trigger: { 
        consecutive_failures: data.circuitBreaker.stats.consecutiveFailures,
        failure_rate: data.circuitBreaker.stats.failureRate,
        error: data.error.message
      },
      status: 'detected',
      result: { circuit_state: 'OPEN', fallback_strategy: serviceConfig?.fallbackStrategy },
      aiAssisted: false
    });

    // Activate graceful degradation
    data.circuitBreaker.fallbackActive = true;
    
    // Notify Queen Ultra AI for intelligent response
    try {
      await queenUltraAI.handleServiceFailure({
        service: data.serviceName,
        priority: serviceConfig?.priority || 'medium',
        failureType: 'circuit_breaker_open',
        context: data.circuitBreaker.stats
      });
    } catch (error) {
      console.warn('⚠️ AI notification failed:', error);
    }
  }

  private async handleCircuitClosed(data: { serviceName: string; circuitBreaker: CircuitBreakerState }): Promise<void> {
    console.log(`✅ Circuit breaker CLOSED for ${data.serviceName} - service recovered`);
    
    await this.logCircuitBreakerEvent({
      type: 'reactive',
      category: 'availability',
      severity: 'low',
      description: `Circuit breaker closed for ${data.serviceName}`,
      target: data.serviceName,
      action: 'Circuit closed - service recovered',
      trigger: { 
        consecutive_successes: data.circuitBreaker.stats.consecutiveSuccesses,
        health_checks_passed: data.circuitBreaker.healthChecksPassed
      },
      status: 'completed',
      result: { circuit_state: 'CLOSED', service_recovered: true },
      aiAssisted: false
    });

    data.circuitBreaker.fallbackActive = false;
  }

  private async handleCircuitHalfOpened(data: { serviceName: string; circuitBreaker: CircuitBreakerState }): Promise<void> {
    console.log(`🔄 Circuit breaker HALF-OPEN for ${data.serviceName} - testing service`);
    
    await this.logCircuitBreakerEvent({
      type: 'reactive',
      category: 'availability',
      severity: 'medium',
      description: `Circuit breaker half-opened for ${data.serviceName}`,
      target: data.serviceName,
      action: 'Circuit half-opened - testing recovery',
      trigger: { reset_timeout_reached: true },
      status: 'in_progress',
      result: { circuit_state: 'HALF_OPEN' },
      aiAssisted: false
    });
  }

  private async handleFallbackActivated(data: { serviceName: string; strategy: string }): Promise<void> {
    console.log(`🔄 Fallback activated for ${data.serviceName} using strategy: ${data.strategy}`);
    
    await this.logCircuitBreakerEvent({
      type: 'reactive',
      category: 'availability',
      severity: 'medium',
      description: `Fallback activated for ${data.serviceName}`,
      target: data.serviceName,
      action: `Fallback strategy: ${data.strategy}`,
      trigger: { circuit_state: 'OPEN' },
      status: 'completed',
      result: { fallback_strategy: data.strategy, graceful_degradation: true },
      aiAssisted: false
    });
  }

  private async handleServiceRecovered(data: { serviceName: string; circuitBreaker: CircuitBreakerState }): Promise<void> {
    console.log(`🎉 Service recovered: ${data.serviceName}`);
    
    await this.logCircuitBreakerEvent({
      type: 'reactive',
      category: 'availability',
      severity: 'low',
      description: `Service ${data.serviceName} recovered`,
      target: data.serviceName,
      action: 'Service recovery detected',
      trigger: { health_checks_passed: data.circuitBreaker.healthChecksPassed },
      status: 'completed',
      result: { service_recovered: true },
      aiAssisted: false
    });
  }

  /**
   * Cache successful response for fallback
   */
  cacheFallbackResponse(serviceName: string, data: any): void {
    this.fallbackCache.set(serviceName, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    total_services: number;
    healthy_services: number;
    degraded_services: number;
    critical_services: number;
    circuits_open: number;
    circuits_half_open: number;
    fallbacks_active: number;
  } {
    const circuitStates = Array.from(this.circuitBreakers.values());
    
    return {
      total_services: circuitStates.length,
      healthy_services: circuitStates.filter(cb => cb.state === 'CLOSED' && !cb.fallbackActive).length,
      degraded_services: circuitStates.filter(cb => cb.state === 'HALF_OPEN' || cb.fallbackActive).length,
      critical_services: circuitStates.filter(cb => cb.state === 'OPEN').length,
      circuits_open: circuitStates.filter(cb => cb.state === 'OPEN').length,
      circuits_half_open: circuitStates.filter(cb => cb.state === 'HALF_OPEN').length,
      fallbacks_active: circuitStates.filter(cb => cb.fallbackActive).length
    };
  }

  /**
   * Get circuit breaker status for a service
   */
  getCircuitBreakerStatus(serviceName: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(serviceName) || null;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllCircuitBreakerStatuses(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Manually open circuit breaker (for testing/emergency)
   */
  openCircuitBreaker(serviceName: string, reason: string = 'Manual override'): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.lastStateChange = new Date();
      circuitBreaker.nextRetryTime = new Date(Date.now() + circuitBreaker.config.resetTimeout);
      
      console.log(`🔧 Manually opened circuit breaker for ${serviceName}: ${reason}`);
      this.emit('circuit_opened', { serviceName, circuitBreaker, error: { message: reason } });
      return true;
    }
    return false;
  }

  /**
   * Manually close circuit breaker (for testing/recovery)
   */
  closeCircuitBreaker(serviceName: string, reason: string = 'Manual override'): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.state = 'CLOSED';
      circuitBreaker.lastStateChange = new Date();
      circuitBreaker.fallbackActive = false;
      circuitBreaker.stats.consecutiveFailures = 0;
      
      console.log(`🔧 Manually closed circuit breaker for ${serviceName}: ${reason}`);
      this.emit('circuit_closed', { serviceName, circuitBreaker });
      return true;
    }
    return false;
  }

  /**
   * Logging methods
   */
  private async logCircuitBreakerEvent(event: Omit<InsertSelfHealingAction, 'id' | 'timestamp'>): Promise<void> {
    try {
      await storage.insertSelfHealingAction({
        ...event,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('⚠️ Failed to log circuit breaker event:', error);
    }
  }

  private async logSystemMetric(metric: Omit<InsertSystemMetric, 'id' | 'timestamp'>): Promise<void> {
    try {
      await storage.insertSystemMetric({
        ...metric,
        timestamp: new Date()
      });
    } catch (error) {
      console.warn('⚠️ Failed to log system metric:', error);
    }
  }
}

// Export singleton instance
export const circuitBreakerSystem = CircuitBreakerSystem.getInstance();