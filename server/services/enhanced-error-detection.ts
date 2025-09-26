import { EventEmitter } from "events";
import { storage } from "../storage";
import { errorTrackingService } from "./error-tracking";
import { auditTrailService } from "./audit-trail-service";
import { type InsertErrorLog, type InsertSecurityEvent, type InsertIncident } from "@shared/schema";

// Import fraud detection with fallback
let fraudDetectionService: any;
try {
  fraudDetectionService = require("./fraud-detection").fraudDetectionService;
} catch (error) {
  console.warn('Fraud detection service not available, using mock');
  fraudDetectionService = { on: () => {} };
}

export interface ErrorPattern {
  id: string;
  pattern: RegExp | string;
  category: 'security' | 'performance' | 'database' | 'integration' | 'user_experience' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  actionRequired: boolean;
  escalationRules: {
    frequency: number; // errors per minute
    timeWindow: number; // minutes
    autoEscalate: boolean;
  };
  learningEnabled: boolean;
  confidence: number; // 0-1 confidence in pattern detection
  lastUpdated: Date;
}

export interface ErrorClassification {
  id: string;
  category: string;
  subcategory: string;
  severity: string;
  confidence: number;
  patterns: string[];
  userImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
  businessImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
  requiredResponse: string[];
  estimatedResolutionTime: number; // minutes
  preventiveMeasures: string[];
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyType: 'spike' | 'trend' | 'pattern' | 'statistical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  baseline: number;
  currentValue: number;
  deviationScore: number;
  timeWindow: string;
  context: any;
}

export interface ErrorCorrelation {
  primaryError: string;
  relatedErrors: string[];
  timeWindow: number;
  correlation: number; // 0-1 correlation strength
  potentialRootCause: string;
  cascadePattern: string[];
  impactRadius: string[];
}

/**
 * Enhanced Error Detection and Classification System
 * Provides intelligent error analysis, pattern recognition, and anomaly detection
 */
export class EnhancedErrorDetectionService extends EventEmitter {
  private static instance: EnhancedErrorDetectionService;
  private isActive = false;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private errorClassifications: Map<string, ErrorClassification> = new Map();
  private anomalyBaselines: Map<string, any> = new Map();
  private recentErrors: Map<string, any[]> = new Map();
  private errorCorrelations: Map<string, ErrorCorrelation> = new Map();
  private patternLearning: Map<string, any> = new Map();
  
  private readonly ANALYSIS_INTERVAL = 10000; // 10 seconds
  private readonly PATTERN_WINDOW = 300000; // 5 minutes
  private readonly ANOMALY_THRESHOLD = 2.5; // standard deviations
  private readonly CORRELATION_THRESHOLD = 0.7;
  private readonly MAX_RECENT_ERRORS = 1000;
  
  private analysisInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.initializePatterns();
    this.initializeClassifications();
  }

  static getInstance(): EnhancedErrorDetectionService {
    if (!EnhancedErrorDetectionService.instance) {
      EnhancedErrorDetectionService.instance = new EnhancedErrorDetectionService();
    }
    return EnhancedErrorDetectionService.instance;
  }

  /**
   * Start the enhanced error detection service
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      console.log('[ErrorDetection] Service already active');
      return;
    }

    console.log('[ErrorDetection] Starting enhanced error detection service...');
    
    try {
      // Load historical patterns and baselines
      await this.loadHistoricalData();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Start real-time analysis
      await this.startRealtimeAnalysis();
      
      this.isActive = true;
      console.log('[ErrorDetection] Enhanced error detection service started');
      this.emit('started', { timestamp: new Date() });
      
    } catch (error) {
      console.error('[ErrorDetection] Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Stop the service
   */
  public async stop(): Promise<void> {
    console.log('[ErrorDetection] Stopping enhanced error detection service...');
    
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    this.isActive = false;
    console.log('[ErrorDetection] Enhanced error detection service stopped');
    this.emit('stopped', { timestamp: new Date() });
  }

  /**
   * Initialize default error patterns
   */
  private initializePatterns(): void {
    const patterns: ErrorPattern[] = [
      {
        id: 'sql_injection_attempt',
        pattern: /(union\s+select|drop\s+table|delete\s+from|insert\s+into.*values|update.*set)/i,
        category: 'security',
        severity: 'critical',
        description: 'Potential SQL injection attack detected',
        actionRequired: true,
        escalationRules: { frequency: 1, timeWindow: 1, autoEscalate: true },
        learningEnabled: false,
        confidence: 0.95,
        lastUpdated: new Date()
      },
      {
        id: 'xss_attempt',
        pattern: /(<script|javascript:|onload=|onerror=|eval\(|alert\()/i,
        category: 'security',
        severity: 'high',
        description: 'Cross-site scripting (XSS) attempt detected',
        actionRequired: true,
        escalationRules: { frequency: 2, timeWindow: 5, autoEscalate: true },
        learningEnabled: false,
        confidence: 0.90,
        lastUpdated: new Date()
      },
      {
        id: 'database_connection_failure',
        pattern: /(connection\s+refused|timeout|connection\s+reset|pool\s+exhausted)/i,
        category: 'database',
        severity: 'high',
        description: 'Database connectivity issues detected',
        actionRequired: true,
        escalationRules: { frequency: 3, timeWindow: 2, autoEscalate: true },
        learningEnabled: true,
        confidence: 0.85,
        lastUpdated: new Date()
      },
      {
        id: 'memory_exhaustion',
        pattern: /(out\s+of\s+memory|heap\s+exhausted|memory\s+allocation|gc\s+overhead)/i,
        category: 'performance',
        severity: 'critical',
        description: 'Memory exhaustion detected',
        actionRequired: true,
        escalationRules: { frequency: 1, timeWindow: 1, autoEscalate: true },
        learningEnabled: true,
        confidence: 0.92,
        lastUpdated: new Date()
      },
      {
        id: 'api_rate_limit_exceeded',
        pattern: /(rate\s+limit|too\s+many\s+requests|quota\s+exceeded|throttled)/i,
        category: 'integration',
        severity: 'medium',
        description: 'API rate limiting triggered',
        actionRequired: false,
        escalationRules: { frequency: 10, timeWindow: 5, autoEscalate: false },
        learningEnabled: true,
        confidence: 0.88,
        lastUpdated: new Date()
      },
      {
        id: 'slow_query_performance',
        pattern: /(slow\s+query|query\s+timeout|execution\s+time\s+exceeded)/i,
        category: 'performance',
        severity: 'medium',
        description: 'Database query performance degradation',
        actionRequired: false,
        escalationRules: { frequency: 5, timeWindow: 10, autoEscalate: false },
        learningEnabled: true,
        confidence: 0.80,
        lastUpdated: new Date()
      },
      {
        id: 'authentication_failure_burst',
        pattern: /(authentication\s+failed|invalid\s+credentials|login\s+denied)/i,
        category: 'security',
        severity: 'high',
        description: 'Multiple authentication failures indicating potential brute force',
        actionRequired: true,
        escalationRules: { frequency: 10, timeWindow: 2, autoEscalate: true },
        learningEnabled: true,
        confidence: 0.87,
        lastUpdated: new Date()
      },
      {
        id: 'file_system_errors',
        pattern: /(disk\s+full|no\s+space|permission\s+denied|file\s+not\s+found|io\s+error)/i,
        category: 'system',
        severity: 'high',
        description: 'File system or disk related issues',
        actionRequired: true,
        escalationRules: { frequency: 3, timeWindow: 5, autoEscalate: true },
        learningEnabled: true,
        confidence: 0.90,
        lastUpdated: new Date()
      },
      {
        id: 'payment_processing_failure',
        pattern: /(payment\s+failed|transaction\s+declined|gateway\s+error|card\s+declined)/i,
        category: 'user_experience',
        severity: 'high',
        description: 'Payment processing failures affecting user experience',
        actionRequired: true,
        escalationRules: { frequency: 2, timeWindow: 3, autoEscalate: false },
        learningEnabled: true,
        confidence: 0.85,
        lastUpdated: new Date()
      },
      {
        id: 'certificate_expiration',
        pattern: /(certificate\s+expired|ssl\s+error|tls\s+handshake|certificate\s+invalid)/i,
        category: 'security',
        severity: 'critical',
        description: 'SSL/TLS certificate issues affecting security',
        actionRequired: true,
        escalationRules: { frequency: 1, timeWindow: 1, autoEscalate: true },
        learningEnabled: false,
        confidence: 0.93,
        lastUpdated: new Date()
      }
    ];

    patterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });
    
    console.log(`[ErrorDetection] Initialized ${patterns.length} error patterns`);
  }

  /**
   * Initialize error classifications
   */
  private initializeClassifications(): void {
    const classifications: ErrorClassification[] = [
      {
        id: 'security_breach',
        category: 'security',
        subcategory: 'unauthorized_access',
        severity: 'critical',
        confidence: 0.95,
        patterns: ['sql_injection_attempt', 'xss_attempt', 'authentication_failure_burst'],
        userImpact: 'critical',
        businessImpact: 'critical',
        requiredResponse: ['immediate_investigation', 'security_team_notification', 'incident_creation'],
        estimatedResolutionTime: 30,
        preventiveMeasures: ['input_validation', 'rate_limiting', 'security_monitoring']
      },
      {
        id: 'system_instability',
        category: 'system',
        subcategory: 'resource_exhaustion',
        severity: 'high',
        confidence: 0.88,
        patterns: ['memory_exhaustion', 'database_connection_failure', 'file_system_errors'],
        userImpact: 'high',
        businessImpact: 'medium',
        requiredResponse: ['resource_cleanup', 'service_restart', 'capacity_review'],
        estimatedResolutionTime: 15,
        preventiveMeasures: ['resource_monitoring', 'capacity_planning', 'automated_cleanup']
      },
      {
        id: 'performance_degradation',
        category: 'performance',
        subcategory: 'response_time',
        severity: 'medium',
        confidence: 0.80,
        patterns: ['slow_query_performance', 'api_rate_limit_exceeded'],
        userImpact: 'medium',
        businessImpact: 'low',
        requiredResponse: ['performance_analysis', 'optimization_review'],
        estimatedResolutionTime: 60,
        preventiveMeasures: ['query_optimization', 'caching', 'load_balancing']
      },
      {
        id: 'user_experience_impact',
        category: 'user_experience',
        subcategory: 'service_failure',
        severity: 'high',
        confidence: 0.85,
        patterns: ['payment_processing_failure'],
        userImpact: 'high',
        businessImpact: 'high',
        requiredResponse: ['immediate_fix', 'user_communication', 'business_notification'],
        estimatedResolutionTime: 30,
        preventiveMeasures: ['failover_systems', 'payment_monitoring', 'user_feedback']
      },
      {
        id: 'infrastructure_failure',
        category: 'system',
        subcategory: 'external_dependency',
        severity: 'high',
        confidence: 0.90,
        patterns: ['certificate_expiration'],
        userImpact: 'critical',
        businessImpact: 'critical',
        requiredResponse: ['immediate_fix', 'certificate_renewal', 'infrastructure_review'],
        estimatedResolutionTime: 20,
        preventiveMeasures: ['certificate_monitoring', 'automated_renewal', 'backup_certificates']
      }
    ];

    classifications.forEach(classification => {
      this.errorClassifications.set(classification.id, classification);
    });
    
    console.log(`[ErrorDetection] Initialized ${classifications.length} error classifications`);
  }

  /**
   * Load historical data for baselines and learning
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load recent error logs for analysis
      const recentErrors = await storage.getErrorLogs({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        limit: 5000
      });
      
      // Group errors by type for baseline calculation
      const errorsByType = new Map<string, any[]>();
      
      for (const error of recentErrors) {
        const classification = this.classifyError(error);
        const key = `${classification.category}_${classification.subcategory}`;
        
        if (!errorsByType.has(key)) {
          errorsByType.set(key, []);
        }
        errorsByType.get(key)!.push(error);
      }
      
      // Calculate baselines for anomaly detection
      for (const [errorType, errors] of errorsByType) {
        const baseline = this.calculateBaseline(errors);
        this.anomalyBaselines.set(errorType, baseline);
      }
      
      // Initialize recent errors tracking
      this.recentErrors.clear();
      const timeWindow = Date.now() - this.PATTERN_WINDOW;
      
      for (const error of recentErrors) {
        const errorTimestamp = error.timestamp || new Date();
        if (errorTimestamp.getTime() > timeWindow) {
          const key = error.errorType || 'unknown';
          if (!this.recentErrors.has(key)) {
            this.recentErrors.set(key, []);
          }
          this.recentErrors.get(key)!.push(error);
        }
      }
      
      console.log(`[ErrorDetection] Loaded ${recentErrors.length} historical errors for analysis`);
      console.log(`[ErrorDetection] Calculated baselines for ${this.anomalyBaselines.size} error types`);
      
    } catch (error) {
      console.error('[ErrorDetection] Error loading historical data:', error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to error tracking service
    errorTrackingService.on('errorLogged', (error) => {
      this.handleNewError(error);
    });

    // Listen to fraud detection
    fraudDetectionService.on('fraudDetected', (alert) => {
      this.handleSecurityAlert(alert);
    });

    // Listen to audit trail for suspicious patterns
    auditTrailService.on('auditLogged', (audit) => {
      this.analyzeAuditForPatterns(audit);
    });
  }

  /**
   * Start real-time analysis
   */
  private async startRealtimeAnalysis(): Promise<void> {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    this.analysisInterval = setInterval(async () => {
      try {
        await this.performRealtimeAnalysis();
      } catch (error) {
        console.error('[ErrorDetection] Real-time analysis failed:', error);
      }
    }, this.ANALYSIS_INTERVAL);

    // Perform initial analysis
    await this.performRealtimeAnalysis();
    
    console.log(`[ErrorDetection] Real-time analysis started (interval: ${this.ANALYSIS_INTERVAL}ms)`);
  }

  /**
   * Perform real-time analysis
   */
  private async performRealtimeAnalysis(): Promise<void> {
    const analysisStart = Date.now();
    
    try {
      // Get recent errors from the last analysis window
      const recentErrors = await storage.getErrorLogs({
        startDate: new Date(Date.now() - this.ANALYSIS_INTERVAL * 2),
        limit: 500
      });

      if (recentErrors.length === 0) {
        return;
      }

      // Perform various analysis types
      const [
        patternMatches,
        anomalies,
        correlations,
        userImpactAnalysis
      ] = await Promise.all([
        this.detectPatterns(recentErrors),
        this.detectAnomalies(recentErrors),
        this.detectErrorCorrelations(recentErrors),
        this.analyzeUserImpact(recentErrors)
      ]);

      // Process results
      await this.processAnalysisResults({
        patterns: patternMatches,
        anomalies: anomalies,
        correlations: correlations,
        userImpact: userImpactAnalysis,
        analysisTime: Date.now() - analysisStart,
        errorCount: recentErrors.length
      });

    } catch (error) {
      console.error('[ErrorDetection] Real-time analysis error:', error);
    }
  }

  /**
   * Handle new error detection
   */
  private async handleNewError(error: any): Promise<void> {
    try {
      // Classify the error immediately
      const classification = this.classifyError(error);
      
      // Add to recent errors tracking
      const key = classification.category + '_' + classification.subcategory;
      if (!this.recentErrors.has(key)) {
        this.recentErrors.set(key, []);
      }
      
      const recentList = this.recentErrors.get(key)!;
      recentList.push(error);
      
      // Maintain size limit
      if (recentList.length > this.MAX_RECENT_ERRORS) {
        recentList.shift();
      }

      // Check for immediate pattern matches
      const patternMatches = await this.checkErrorAgainstPatterns(error);
      
      if (patternMatches.length > 0) {
        for (const match of patternMatches) {
          await this.handlePatternMatch(error, match);
        }
      }

      // Emit classified error event
      this.emit('errorClassified', {
        error,
        classification,
        patternMatches,
        timestamp: new Date()
      });

    } catch (err) {
      console.error('[ErrorDetection] Error handling new error:', err);
    }
  }

  /**
   * Classify error based on content and context
   */
  private classifyError(error: any): ErrorClassification {
    let bestMatch: ErrorClassification | null = null;
    let highestConfidence = 0;

    for (const classification of this.errorClassifications.values()) {
      let confidence = 0;
      
      // Check if error matches any patterns associated with this classification
      for (const patternId of classification.patterns) {
        const pattern = this.errorPatterns.get(patternId);
        if (pattern && this.testPattern(error, pattern)) {
          confidence += pattern.confidence * 0.8;
        }
      }
      
      // Additional context-based classification
      confidence += this.calculateContextualConfidence(error, classification);
      
      if (confidence > highestConfidence && confidence > 0.5) {
        highestConfidence = confidence;
        bestMatch = classification;
      }
    }

    // Return best match or default classification
    return bestMatch || {
      id: 'unknown_error',
      category: 'system',
      subcategory: 'unknown',
      severity: 'medium',
      confidence: 0.3,
      patterns: [],
      userImpact: 'low',
      businessImpact: 'low',
      requiredResponse: ['investigation'],
      estimatedResolutionTime: 120,
      preventiveMeasures: ['monitoring']
    };
  }

  /**
   * Test error against a specific pattern
   */
  private testPattern(error: any, pattern: ErrorPattern): boolean {
    const errorText = `${error.message || ''} ${error.stack || ''} ${JSON.stringify(error.context || {})}`.toLowerCase();
    
    if (pattern.pattern instanceof RegExp) {
      return pattern.pattern.test(errorText);
    } else {
      return errorText.includes(pattern.pattern.toLowerCase());
    }
  }

  /**
   * Calculate contextual confidence for classification
   */
  private calculateContextualConfidence(error: any, classification: ErrorClassification): number {
    let confidence = 0;
    
    // Check error severity alignment
    if (error.severity === classification.severity) {
      confidence += 0.2;
    }
    
    // Check category hints from error context
    const context = error.context || {};
    if (context.component && classification.category === 'database' && context.component.includes('database')) {
      confidence += 0.3;
    }
    
    if (context.component && classification.category === 'security' && context.component.includes('auth')) {
      confidence += 0.3;
    }
    
    // Check error type patterns
    if (error.errorType) {
      if (classification.category === 'performance' && error.errorType.includes('timeout')) {
        confidence += 0.2;
      }
      if (classification.category === 'database' && error.errorType.includes('connection')) {
        confidence += 0.2;
      }
    }
    
    return Math.min(confidence, 0.5); // Cap contextual confidence
  }

  /**
   * Check error against all patterns
   */
  private async checkErrorAgainstPatterns(error: any): Promise<ErrorPattern[]> {
    const matches: ErrorPattern[] = [];
    
    for (const pattern of this.errorPatterns.values()) {
      if (this.testPattern(error, pattern)) {
        matches.push(pattern);
        
        // Update pattern statistics if learning is enabled
        if (pattern.learningEnabled) {
          await this.updatePatternLearning(pattern.id, true);
        }
      }
    }
    
    return matches;
  }

  /**
   * Handle pattern match
   */
  private async handlePatternMatch(error: any, pattern: ErrorPattern): Promise<void> {
    console.log(`[ErrorDetection] Pattern matched: ${pattern.id} - ${pattern.description}`);
    
    // Check escalation rules
    const shouldEscalate = await this.checkEscalationRules(pattern, error);
    
    if (shouldEscalate) {
      await this.escalateError(error, pattern);
    }
    
    // Create security event for critical security patterns
    if (pattern.category === 'security' && pattern.severity === 'critical') {
      await this.createSecurityEvent(error, pattern);
    }
    
    // Emit pattern match event
    this.emit('patternMatched', {
      error,
      pattern,
      shouldEscalate,
      timestamp: new Date()
    });
  }

  /**
   * Check if error should be escalated based on pattern rules
   */
  private async checkEscalationRules(pattern: ErrorPattern, error: any): Promise<boolean> {
    if (!pattern.escalationRules.autoEscalate) {
      return false;
    }

    // Count recent occurrences of this pattern
    const recentErrors = await storage.getErrorLogs({
      startDate: new Date(Date.now() - pattern.escalationRules.timeWindow * 60 * 1000),
      limit: 100
    });

    let matchCount = 0;
    for (const recentError of recentErrors) {
      if (this.testPattern(recentError, pattern)) {
        matchCount++;
      }
    }

    return matchCount >= pattern.escalationRules.frequency;
  }

  /**
   * Escalate error
   */
  private async escalateError(error: any, pattern: ErrorPattern): Promise<void> {
    console.log(`[ErrorDetection] Escalating error due to pattern: ${pattern.id}`);
    
    try {
      // Create incident
      const incident = await storage.createIncident({
        incidentNumber: `ERR-${Date.now()}`,
        title: `Automated Escalation: ${pattern.description}`,
        description: `Error pattern "${pattern.id}" triggered escalation rules. ${pattern.escalationRules.frequency} occurrences in ${pattern.escalationRules.timeWindow} minutes.`,
        severity: this.mapSeverityToIncident(pattern.severity),
        status: 'open',
        category: pattern.category,
        impactLevel: this.determineImpactLevel(pattern),
        triggerAlertRuleId: null, // This is from error detection, not alert rule
        automaticResolution: false,
        governmentNotificationRequired: pattern.category === 'security' && pattern.severity === 'critical'
      });
      
      this.emit('errorEscalated', {
        error,
        pattern,
        incident,
        timestamp: new Date()
      });
      
    } catch (escalationError) {
      console.error('[ErrorDetection] Error during escalation:', escalationError);
    }
  }

  /**
   * Create security event
   */
  private async createSecurityEvent(error: any, pattern: ErrorPattern): Promise<void> {
    try {
      await storage.createSecurityEvent({
        eventType: `pattern_detection_${pattern.id}`,
        severity: pattern.severity as any,
        details: {
          patternId: pattern.id,
          patternDescription: pattern.description,
          errorDetails: error,
          detectionTime: new Date(),
          confidence: pattern.confidence
        },
        userId: error.context?.userId,
        ipAddress: error.context?.ipAddress,
        userAgent: error.context?.userAgent
      });
      
      console.log(`[ErrorDetection] Created security event for pattern: ${pattern.id}`);
      
    } catch (securityError) {
      console.error('[ErrorDetection] Error creating security event:', securityError);
    }
  }

  /**
   * Detect patterns in a batch of errors
   */
  private async detectPatterns(errors: any[]): Promise<any[]> {
    const patternMatches = [];
    
    for (const error of errors) {
      const matches = await this.checkErrorAgainstPatterns(error);
      if (matches.length > 0) {
        patternMatches.push({
          error,
          patterns: matches,
          timestamp: error.createdAt
        });
      }
    }
    
    return patternMatches;
  }

  /**
   * Detect anomalies in error patterns
   */
  private async detectAnomalies(errors: any[]): Promise<AnomalyDetectionResult[]> {
    const anomalies: AnomalyDetectionResult[] = [];
    
    // Group errors by type and time buckets
    const errorBuckets = new Map<string, Map<number, number>>();
    const timeWindow = 60000; // 1 minute buckets
    
    for (const error of errors) {
      const classification = this.classifyError(error);
      const key = `${classification.category}_${classification.subcategory}`;
      const timeBucket = Math.floor(error.createdAt.getTime() / timeWindow) * timeWindow;
      
      if (!errorBuckets.has(key)) {
        errorBuckets.set(key, new Map());
      }
      
      const buckets = errorBuckets.get(key)!;
      buckets.set(timeBucket, (buckets.get(timeBucket) || 0) + 1);
    }
    
    // Detect anomalies in each error type
    for (const [errorType, buckets] of errorBuckets) {
      const baseline = this.anomalyBaselines.get(errorType);
      if (!baseline) continue;
      
      for (const [timeBucket, count] of buckets) {
        const anomaly = this.detectStatisticalAnomaly(count, baseline);
        if (anomaly.isAnomaly) {
          anomalies.push({
            ...anomaly,
            anomalyType: 'spike',
            timeWindow: new Date(timeBucket).toISOString(),
            context: {
              errorType,
              timeBucket: new Date(timeBucket),
              errorCount: count
            }
          });
        }
      }
    }
    
    return anomalies;
  }

  /**
   * Detect statistical anomaly
   */
  private detectStatisticalAnomaly(value: number, baseline: any): AnomalyDetectionResult {
    const zScore = Math.abs((value - baseline.mean) / baseline.standardDeviation);
    const isAnomaly = zScore > this.ANOMALY_THRESHOLD;
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (zScore > 4) severity = 'critical';
    else if (zScore > 3) severity = 'high';
    else if (zScore > 2.5) severity = 'medium';
    else severity = 'low';
    
    return {
      isAnomaly,
      anomalyType: 'statistical',
      severity,
      confidence: Math.min(zScore / 4, 1), // Normalize confidence
      baseline: baseline.mean,
      currentValue: value,
      deviationScore: zScore,
      timeWindow: '',
      context: {}
    };
  }

  /**
   * Detect error correlations
   */
  private async detectErrorCorrelations(errors: any[]): Promise<ErrorCorrelation[]> {
    const correlations: ErrorCorrelation[] = [];
    const errorTypes = new Map<string, any[]>();
    
    // Group errors by classification
    for (const error of errors) {
      const classification = this.classifyError(error);
      const key = `${classification.category}_${classification.subcategory}`;
      
      if (!errorTypes.has(key)) {
        errorTypes.set(key, []);
      }
      errorTypes.get(key)!.push(error);
    }
    
    // Find correlations between error types
    const errorTypeArray = Array.from(errorTypes.entries());
    for (let i = 0; i < errorTypeArray.length; i++) {
      for (let j = i + 1; j < errorTypeArray.length; j++) {
        const [type1, errors1] = errorTypeArray[i];
        const [type2, errors2] = errorTypeArray[j];
        
        const correlation = this.calculateTemporalCorrelation(errors1, errors2);
        
        if (correlation > this.CORRELATION_THRESHOLD) {
          correlations.push({
            primaryError: type1,
            relatedErrors: [type2],
            timeWindow: this.PATTERN_WINDOW,
            correlation,
            potentialRootCause: this.identifyRootCause(type1, type2),
            cascadePattern: [type1, type2],
            impactRadius: this.calculateImpactRadius([type1, type2])
          });
        }
      }
    }
    
    return correlations;
  }

  /**
   * Calculate temporal correlation between error types
   */
  private calculateTemporalCorrelation(errors1: any[], errors2: any[]): number {
    if (errors1.length === 0 || errors2.length === 0) return 0;
    
    // Simplified correlation calculation based on timing proximity
    let correlatedPairs = 0;
    const timeThreshold = 60000; // 1 minute
    
    for (const error1 of errors1) {
      for (const error2 of errors2) {
        const timeDiff = Math.abs(error1.createdAt.getTime() - error2.createdAt.getTime());
        if (timeDiff <= timeThreshold) {
          correlatedPairs++;
          break; // One match per error1 is enough
        }
      }
    }
    
    return correlatedPairs / Math.min(errors1.length, errors2.length);
  }

  /**
   * Analyze user impact
   */
  private async analyzeUserImpact(errors: any[]): Promise<any> {
    const userImpactLevels = new Map<string, number>();
    
    for (const error of errors) {
      const classification = this.classifyError(error);
      const impactKey = classification.userImpact;
      userImpactLevels.set(impactKey, (userImpactLevels.get(impactKey) || 0) + 1);
    }
    
    return {
      totalErrors: errors.length,
      impactDistribution: Array.from(userImpactLevels.entries()),
      criticalImpactErrors: userImpactLevels.get('critical') || 0,
      highImpactErrors: userImpactLevels.get('high') || 0,
      usersAffected: this.estimateAffectedUsers(errors),
      businessImpact: this.calculateBusinessImpact(errors)
    };
  }

  /**
   * Process analysis results
   */
  private async processAnalysisResults(results: any): Promise<void> {
    console.log(`[ErrorDetection] Analysis complete: ${results.errorCount} errors, ${results.patterns.length} patterns, ${results.anomalies.length} anomalies`);
    
    // Handle critical anomalies
    for (const anomaly of results.anomalies) {
      if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
        await this.handleCriticalAnomaly(anomaly);
      }
    }
    
    // Handle error correlations
    for (const correlation of results.correlations) {
      if (correlation.correlation > 0.8) {
        await this.handleHighCorrelation(correlation);
      }
    }
    
    // Update learning models
    if (results.patterns.length > 0) {
      await this.updatePatternLearning('batch_analysis', true, results.patterns);
    }
    
    // Emit analysis results
    this.emit('analysisCompleted', {
      results,
      timestamp: new Date()
    });
  }

  // Helper methods
  private calculateBaseline(errors: any[]): any {
    if (errors.length === 0) {
      return { mean: 0, standardDeviation: 1, min: 0, max: 0 };
    }
    
    // Group errors by time buckets (hourly)
    const buckets = new Map<number, number>();
    const hourMs = 60 * 60 * 1000;
    
    for (const error of errors) {
      const bucket = Math.floor(error.createdAt.getTime() / hourMs);
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
    
    const values = Array.from(buckets.values());
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      mean,
      standardDeviation: Math.max(standardDeviation, 1), // Avoid division by zero
      min: Math.min(...values),
      max: Math.max(...values),
      sampleSize: values.length
    };
  }

  private mapSeverityToIncident(severity: string): 'low' | 'medium' | 'high' | 'critical' | 'emergency' {
    switch (severity) {
      case 'critical': return 'emergency';
      case 'high': return 'critical';
      case 'medium': return 'high';
      case 'low': return 'medium';
      default: return 'medium';
    }
  }

  private determineImpactLevel(pattern: ErrorPattern): 'low' | 'medium' | 'high' | 'critical' {
    if (pattern.category === 'security' && pattern.severity === 'critical') return 'critical';
    if (pattern.category === 'user_experience' && pattern.severity === 'high') return 'high';
    if (pattern.severity === 'critical') return 'high';
    if (pattern.severity === 'high') return 'medium';
    return 'low';
  }

  private identifyRootCause(type1: string, type2: string): string {
    // Simplified root cause identification
    if (type1.includes('database') && type2.includes('performance')) {
      return 'database_performance_bottleneck';
    }
    if (type1.includes('memory') && type2.includes('performance')) {
      return 'memory_pressure';
    }
    return 'unknown_correlation';
  }

  private calculateImpactRadius(errorTypes: string[]): string[] {
    // Simplified impact radius calculation
    const radius: string[] = [];
    
    for (const errorType of errorTypes) {
      if (errorType.includes('database')) {
        radius.push('all_database_operations', 'user_data_access');
      }
      if (errorType.includes('security')) {
        radius.push('user_authentication', 'data_protection');
      }
      if (errorType.includes('performance')) {
        radius.push('user_experience', 'system_responsiveness');
      }
    }
    
    return Array.from(new Set(radius));
  }

  private estimateAffectedUsers(errors: any[]): number {
    const uniqueUsers = new Set<string>();
    
    for (const error of errors) {
      if (error.context?.userId) {
        uniqueUsers.add(error.context.userId);
      }
    }
    
    return uniqueUsers.size;
  }

  private calculateBusinessImpact(errors: any[]): string {
    let criticalCount = 0;
    let highCount = 0;
    
    for (const error of errors) {
      const classification = this.classifyError(error);
      if (classification.businessImpact === 'critical') criticalCount++;
      else if (classification.businessImpact === 'high') highCount++;
    }
    
    if (criticalCount > 0) return 'critical';
    if (highCount > 5) return 'high';
    if (highCount > 0) return 'medium';
    return 'low';
  }

  private async updatePatternLearning(patternId: string, successful: boolean, context?: any): Promise<void> {
    // Update pattern learning statistics
    const learning = this.patternLearning.get(patternId) || {
      totalMatches: 0,
      successfulMatches: 0,
      lastUpdated: new Date()
    };
    
    learning.totalMatches++;
    if (successful) learning.successfulMatches++;
    learning.lastUpdated = new Date();
    
    this.patternLearning.set(patternId, learning);
  }

  private async handleCriticalAnomaly(anomaly: AnomalyDetectionResult): Promise<void> {
    console.log(`[ErrorDetection] Handling critical anomaly: ${anomaly.anomalyType} - ${anomaly.severity}`);
    
    // Create incident for critical anomaly
    await storage.createIncident({
      incidentNumber: `ANO-${Date.now()}`,
      title: `Critical Error Anomaly Detected`,
      description: `Anomaly detected: ${anomaly.anomalyType} with ${anomaly.confidence * 100}% confidence. Current value: ${anomaly.currentValue}, Baseline: ${anomaly.baseline}`,
      severity: 'critical',
      status: 'open',
      category: 'system',
      impactLevel: anomaly.severity as any,
      automaticResolution: false
    });
  }

  private async handleHighCorrelation(correlation: ErrorCorrelation): Promise<void> {
    console.log(`[ErrorDetection] High correlation detected: ${correlation.primaryError} -> ${correlation.relatedErrors.join(', ')}`);
    
    // Store correlation for future analysis
    this.errorCorrelations.set(correlation.primaryError, correlation);
    
    this.emit('correlationDetected', {
      correlation,
      timestamp: new Date()
    });
  }

  private async handleSecurityAlert(alert: any): Promise<void> {
    // Additional security-specific error detection
    console.log(`[ErrorDetection] Security alert received: ${alert.type}`);
    
    // Check for patterns in security events
    const securityPattern = this.errorPatterns.get('authentication_failure_burst');
    if (securityPattern && alert.type === 'authentication_failure') {
      await this.handlePatternMatch(alert, securityPattern);
    }
  }

  private async analyzeAuditForPatterns(audit: any): Promise<void> {
    // Analyze audit logs for suspicious patterns
    const suspiciousPatterns = [
      'multiple_failed_logins',
      'unusual_data_access',
      'privilege_escalation',
      'bulk_operations'
    ];
    
    // Simple pattern detection in audit logs
    // In production, this would be more sophisticated
    if (audit.action.includes('login') && audit.metadata?.success === false) {
      // Could trigger authentication failure pattern
    }
  }

  /**
   * Public interface methods
   */
  public async getErrorStatistics(timeWindow: number = 24): Promise<any> {
    const startTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
    const errors = await storage.getErrorLogs({ startDate: startTime, limit: 5000 });
    
    const statistics = {
      totalErrors: errors.length,
      errorsByCategory: new Map<string, number>(),
      errorsBySeverity: new Map<string, number>(),
      topPatterns: new Map<string, number>(),
      anomalyDetectionResults: await this.detectAnomalies(errors),
      correlationResults: await this.detectErrorCorrelations(errors),
      userImpactAnalysis: await this.analyzeUserImpact(errors),
      timeWindow: `${timeWindow} hours`
    };
    
    // Categorize errors
    for (const error of errors) {
      const classification = this.classifyError(error);
      
      statistics.errorsByCategory.set(
        classification.category,
        (statistics.errorsByCategory.get(classification.category) || 0) + 1
      );
      
      statistics.errorsBySeverity.set(
        classification.severity,
        (statistics.errorsBySeverity.get(classification.severity) || 0) + 1
      );
    }
    
    return statistics;
  }

  public getActivePatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values());
  }

  public getClassifications(): ErrorClassification[] {
    return Array.from(this.errorClassifications.values());
  }

  public async addCustomPattern(pattern: Omit<ErrorPattern, 'lastUpdated'>): Promise<void> {
    const fullPattern: ErrorPattern = {
      ...pattern,
      lastUpdated: new Date()
    };
    
    this.errorPatterns.set(pattern.id, fullPattern);
    console.log(`[ErrorDetection] Added custom pattern: ${pattern.id}`);
  }

  public async updatePatternConfidence(patternId: string, confidence: number): Promise<void> {
    const pattern = this.errorPatterns.get(patternId);
    if (pattern) {
      pattern.confidence = Math.max(0, Math.min(1, confidence));
      pattern.lastUpdated = new Date();
      console.log(`[ErrorDetection] Updated confidence for pattern ${patternId}: ${confidence}`);
    }
  }

  public getServiceStatus(): any {
    return {
      isActive: this.isActive,
      patternsLoaded: this.errorPatterns.size,
      classificationsLoaded: this.errorClassifications.size,
      baselinesCalculated: this.anomalyBaselines.size,
      recentErrorsTracked: Array.from(this.recentErrors.values()).reduce((sum, arr) => sum + arr.length, 0),
      analysisInterval: this.ANALYSIS_INTERVAL,
      patternWindow: this.PATTERN_WINDOW,
      lastAnalysis: new Date()
    };
  }
}

// Export singleton instance
export const enhancedErrorDetectionService = EnhancedErrorDetectionService.getInstance();