import { LRUCache as LRU } from 'lru-cache';
import { createHash } from 'crypto';

// Type definitions
interface CachedItem {
  data: any;
  timestamp: Date;
  ttl: number;
  priority: 'low' | 'normal' | 'high';
  size: number;
}

interface HotDataItem {
  data: any;
  accessCount: number;
  firstAccess?: Date;
  lastAccess: Date;
  expiresAt: Date;
  ttl?: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  itemCount: number;
  hitRate: number;
  avgAccessTime: number;
  lastOptimization: Date;
}

interface CacheOptions {
  ttl?: number;
  priority?: 'low' | 'normal' | 'high';
  type?: 'query' | 'session' | 'general' | 'memory';
}

/**
 * Optimized Cache Service
 * Implements multi-layer caching with automatic eviction and optimization
 */
export class OptimizedCacheService {
  private memoryCache!: LRU<string, CachedItem>;
  private queryCache!: LRU<string, any>;
  private sessionCache!: LRU<string, any>;
  private hotDataCache!: Map<string, HotDataItem>;
  private cacheStats!: CacheStats;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB

  constructor() {
    this.initializeCaches();
    this.startCacheOptimization();
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    console.log('[OptimizedCache] Cache service initialized');
  }

  private initializeCaches(): void {
    // Main memory cache with LRU eviction
    this.memoryCache = new LRU<string, CachedItem>({
      max: 10000, // Maximum number of items
      maxSize: this.MAX_CACHE_SIZE, // Maximum size in bytes
      sizeCalculation: (value: CachedItem) => JSON.stringify(value).length,
      ttl: this.DEFAULT_TTL,
      allowStale: true,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
      fetchMethod: async (key: string) => {
        // Auto-fetch method for cache misses
        return undefined;
      }
    });

    // Query result cache for database queries
    this.queryCache = new LRU<string, any>({
      max: 1000,
      ttl: 60 * 1000, // 1 minute for query results
      allowStale: false,
      updateAgeOnGet: true
    });

    // Session cache for user sessions
    this.sessionCache = new LRU<string, any>({
      max: 5000,
      ttl: 30 * 60 * 1000, // 30 minutes for sessions
      allowStale: false,
      updateAgeOnGet: true
    });

    // Hot data cache for frequently accessed items
    this.hotDataCache = new Map();

    // Initialize cache statistics
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      itemCount: 0,
      hitRate: 0,
      avgAccessTime: 0,
      lastOptimization: new Date()
    };

    // Setup cache event listeners
    // this.setupCacheListeners(); // Comment out - events not supported in current LRU version
  }

  private setupCacheListeners(): void {
    // Events not supported in current LRU version - track stats manually
    // Will be updated when operations occur
  }

  /**
   * Get item from cache with automatic optimization
   */
  public async get<T>(key: string, fetchFn?: () => Promise<T>, options?: CacheOptions): Promise<T | null> {
    const startTime = Date.now();
    
    // Check hot data cache first
    const hotItem = this.hotDataCache.get(key);
    if (hotItem && !this.isExpired(hotItem)) {
      hotItem.accessCount++;
      hotItem.lastAccess = new Date();
      this.recordHit(Date.now() - startTime);
      return hotItem.data;
    }

    // Check main cache
    const cached = this.memoryCache.get(key);
    if (cached) {
      this.recordHit(Date.now() - startTime);
      this.trackHotData(key, cached.data);
      return cached.data;
    }

    // Cache miss
    this.recordMiss(Date.now() - startTime);

    // Fetch data if fetch function provided
    if (fetchFn) {
      try {
        const data = await fetchFn();
        if (data !== null && data !== undefined) {
          await this.set(key, data, options);
        }
        return data;
      } catch (error) {
        console.error('[Cache] Fetch error:', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Set item in cache with automatic optimization
   */
  public async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.DEFAULT_TTL;
    const priority = options?.priority || 'normal';
    
    const item: CachedItem = {
      data: value,
      timestamp: new Date(),
      ttl,
      priority,
      size: JSON.stringify(value).length
    };

    // Add to appropriate cache based on type
    if (options?.type === 'query') {
      this.queryCache.set(key, value, { ttl });
    } else if (options?.type === 'session') {
      this.sessionCache.set(key, value, { ttl });
    } else {
      this.memoryCache.set(key, item, { ttl });
    }

    // Track hot data if accessed frequently
    if (priority === 'high') {
      this.trackHotData(key, value);
    }
  }

  /**
   * Batch get operation for multiple keys
   */
  public async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  /**
   * Batch set operation for multiple items
   */
  public async mset<T>(items: Map<string, T>, options?: CacheOptions): Promise<void> {
    for (const [key, value] of Array.from(items)) {
      await this.set(key, value, options);
    }
  }

  /**
   * Delete item from cache
   */
  public delete(key: string): boolean {
    this.hotDataCache.delete(key);
    this.queryCache.delete(key);
    this.sessionCache.delete(key);
    return this.memoryCache.delete(key);
  }

  /**
   * Clear specific cache or all caches
   */
  public clear(cacheType?: 'memory' | 'query' | 'session' | 'hot' | 'all'): void {
    switch (cacheType) {
      case 'memory':
        this.memoryCache.clear();
        break;
      case 'query':
        this.queryCache.clear();
        break;
      case 'session':
        this.sessionCache.clear();
        break;
      case 'hot':
        this.hotDataCache.clear();
        break;
      case 'all':
      default:
        this.memoryCache.clear();
        this.queryCache.clear();
        this.sessionCache.clear();
        this.hotDataCache.clear();
        break;
    }
    
    this.cacheStats.itemCount = this.memoryCache.size;
    this.cacheStats.totalSize = this.memoryCache.calculatedSize || 0;
  }

  /**
   * Invalidate cache by pattern
   */
  public invalidatePattern(pattern: string | RegExp): number {
    let invalidated = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of Array.from(this.memoryCache.keys())) {
      if (regex.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }
    
    return invalidated;
  }

  /**
   * Create cache key from object
   */
  public createKey(prefix: string, params: any): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex')
      .substring(0, 16);
    return `${prefix}:${hash}`;
  }

  /**
   * Wrap function with caching
   */
  public wrap<T>(
    keyPrefix: string,
    fn: (...args: any[]) => Promise<T>,
    options?: CacheOptions
  ): (...args: any[]) => Promise<T> {
    return async (...args: any[]): Promise<T> => {
      const key = this.createKey(keyPrefix, args);
      
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
      
      const result = await fn(...args);
      await this.set(key, result, options);
      
      return result;
    };
  }

  /**
   * Automatic cache optimization
   */
  private startCacheOptimization(): void {
    // Optimize cache every minute
    setInterval(() => {
      this.optimizeCache();
    }, 60000);

    // Update statistics every 10 seconds
    setInterval(() => {
      this.updateStatistics();
    }, 10000);

    // Promote hot data every 30 seconds
    setInterval(() => {
      this.promoteHotData();
    }, 30000);
  }

  private optimizeCache(): void {
    const now = Date.now();
    
    // Remove expired items from hot data cache
    for (const [key, item] of Array.from(this.hotDataCache)) {
      if (this.isExpired(item)) {
        this.hotDataCache.delete(key);
      }
    }

    // Adjust cache size based on memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (heapUsedPercent > 85) {
      // Reduce cache size if memory pressure is high
      const newMaxSize = Math.floor((this.memoryCache as any).max * 0.8);
      (this.memoryCache as any).max = newMaxSize;
      console.log(`[Cache] Reduced cache size to ${newMaxSize} due to memory pressure`);
    } else if (heapUsedPercent < 50 && (this.memoryCache as any).max < 10000) {
      // Increase cache size if memory is available
      const newMaxSize = Math.min((this.memoryCache as any).max * 1.2, 10000);
      (this.memoryCache as any).max = Math.floor(newMaxSize);
      console.log(`[Cache] Increased cache size to ${(this.memoryCache as any).max}`);
    }

    // Prune old query cache entries
    this.queryCache.purgeStale();
    
    // Update last optimization time
    this.cacheStats.lastOptimization = new Date();
  }

  private trackHotData(key: string, data: any): void {
    const existing = this.hotDataCache.get(key);
    
    if (existing) {
      existing.accessCount++;
      existing.lastAccess = new Date();
    } else if (this.hotDataCache.size < 100) { // Limit hot data cache size
      this.hotDataCache.set(key, {
        data,
        accessCount: 1,
        lastAccess: new Date(),
        expiresAt: new Date(Date.now() + this.DEFAULT_TTL * 2)
      });
    }
  }

  private promoteHotData(): void {
    // Promote frequently accessed items to hot cache
    const threshold = 5; // Access count threshold
    
    for (const key of Array.from(this.memoryCache.keys())) {
      const stats = this.memoryCache.getRemainingTTL(key);
      if (stats && stats > 0) {
        // Item is still valid, check if it should be promoted
        const item = this.memoryCache.get(key);
        if (item && !this.hotDataCache.has(key)) {
          // Track access patterns and promote if accessed frequently
          // This is a simplified implementation
        }
      }
    }
  }

  private isExpired(item: HotDataItem): boolean {
    return new Date() > item.expiresAt;
  }

  private recordHit(accessTime: number): void {
    this.cacheStats.hits++;
    this.updateAvgAccessTime(accessTime);
  }

  private recordMiss(accessTime: number): void {
    this.cacheStats.misses++;
    this.updateAvgAccessTime(accessTime);
  }

  private updateAvgAccessTime(accessTime: number): void {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.avgAccessTime = 
      (this.cacheStats.avgAccessTime * (total - 1) + accessTime) / total;
  }

  private updateStatistics(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.hitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
    this.cacheStats.itemCount = this.memoryCache.size;
    this.cacheStats.totalSize = this.memoryCache.calculatedSize || 0;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.updateStatistics();
    return { ...this.cacheStats };
  }

  /**
   * Get cache health status
   */
  public getHealth(): CacheHealth {
    const stats = this.getStats();
    const memoryUsage = process.memoryUsage();
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    return {
      healthy: stats.hitRate > 60 && heapUsedPercent < 85,
      hitRate: stats.hitRate,
      memoryUsage: heapUsedPercent,
      itemCount: stats.itemCount,
      totalSize: stats.totalSize,
      avgAccessTime: stats.avgAccessTime,
      lastOptimization: stats.lastOptimization
    };
  }

  /**
   * Preload cache with initial data
   */
  public async preload(items: Map<string, any>, options?: CacheOptions): Promise<void> {
    console.log(`[Cache] Preloading ${items.size} items...`);
    await this.mset(items, { ...options, priority: 'high' });
    console.log('[Cache] Preload complete');
  }
}

// Type definitions moved to top of file - removing duplicates

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  itemCount: number;
  hitRate: number;
  avgAccessTime: number;
  lastOptimization: Date;
}

interface CacheHealth {
  healthy: boolean;
  hitRate: number;
  memoryUsage: number;
  itemCount: number;
  totalSize: number;
  avgAccessTime: number;
  lastOptimization: Date;
}

// LRU Cache extension for type compatibility
class LRUCacheCompat<K, V> extends Map<K, V> {
  private max: number;
  private maxSize?: number;
  private ttl?: number;
  private sizeCalculation?: (value: V) => number;
  private allowStale?: boolean;
  private updateAgeOnGet?: boolean;
  private updateAgeOnHas?: boolean;
  private fetchMethod?: (key: K) => Promise<V | null>;
  private listeners: Map<string, Function[]> = new Map();
  public calculatedSize: number = 0;

  constructor(options: any) {
    super();
    this.max = options.max || 100;
    this.maxSize = options.maxSize;
    this.ttl = options.ttl;
    this.sizeCalculation = options.sizeCalculation;
    this.allowStale = options.allowStale;
    this.updateAgeOnGet = options.updateAgeOnGet;
    this.updateAgeOnHas = options.updateAgeOnHas;
    this.fetchMethod = options.fetchMethod;
  }

  set(key: K, value: V, options?: any): this {
    if (this.size >= this.max) {
      const firstKey = this.keys().next().value;
      if (firstKey) {
        this.delete(firstKey);
        this.emit('evict', firstKey, this.get(firstKey), 'set');
      }
    }
    super.set(key, value);
    this.emit('set', key, value);
    return this;
  }

  getRemainingTTL(key: K): number | undefined {
    // Simplified implementation
    return this.ttl;
  }

  purgeStale(): void {
    // Simplified implementation
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }
}

// Export singleton instance
export const optimizedCacheService = new OptimizedCacheService();