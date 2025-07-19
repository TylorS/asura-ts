import { ParserContext, RecoveryPoint, RecoveryEvent, ParsingContext } from "./Parser.ts";

/**
 * Performance optimization configuration for error recovery
 */
export interface RecoveryPerformanceConfig {
  /** Maximum number of tokens to skip during recovery */
  maxTokensToSkip: number;
  /** Maximum number of recovery attempts per parsing operation */
  maxRecoveryAttempts: number;
  /** Maximum size of recovery history to keep in memory */
  maxRecoveryHistorySize: number;
  /** Maximum depth of context stack */
  maxContextStackDepth: number;
  /** Enable recovery point caching */
  enableRecoveryPointCaching: boolean;
  /** Cache size for recovery points */
  recoveryPointCacheSize: number;
}

/**
 * Default performance configuration
 */
export const DEFAULT_RECOVERY_PERFORMANCE_CONFIG: RecoveryPerformanceConfig = {
  maxTokensToSkip: 50,
  maxRecoveryAttempts: 10,
  maxRecoveryHistorySize: 100,
  maxContextStackDepth: 50,
  enableRecoveryPointCaching: true,
  recoveryPointCacheSize: 20,
};

/**
 * Cached recovery point with metadata
 */
interface CachedRecoveryPoint {
  point: RecoveryPoint;
  contextHash: string;
  hitCount: number;
  lastUsed: number;
}

/**
 * Performance-optimized recovery manager
 * Implements lazy activation, caching, and bounded recovery
 */
export class RecoveryPerformanceManager {
  private config: RecoveryPerformanceConfig;
  private recoveryPointCache = new Map<string, CachedRecoveryPoint>();
  private isRecoveryActive = false;
  private recoveryAttemptCount = 0;

  constructor(config: RecoveryPerformanceConfig = DEFAULT_RECOVERY_PERFORMANCE_CONFIG) {
    this.config = config;
  }

  /**
   * Lazy activation of recovery mechanisms
   * Only activates when first error occurs
   */
  activateRecovery(): void {
    if (!this.isRecoveryActive) {
      this.isRecoveryActive = true;
      this.recoveryAttemptCount = 0;
    }
  }

  /**
   * Check if recovery is active
   */
  isRecoveryActivated(): boolean {
    return this.isRecoveryActive;
  }

  /**
   * Reset recovery state for new parsing operation
   */
  resetRecovery(): void {
    this.isRecoveryActive = false;
    this.recoveryAttemptCount = 0;
  }

  /**
   * Check if recovery attempt limit has been reached
   */
  canAttemptRecovery(): boolean {
    return this.recoveryAttemptCount < this.config.maxRecoveryAttempts;
  }

  /**
   * Increment recovery attempt counter
   */
  incrementRecoveryAttempts(): void {
    this.recoveryAttemptCount++;
  }

  /**
   * Get cached recovery point if available
   */
  getCachedRecoveryPoint(context: ParserContext): RecoveryPoint | null {
    if (!this.config.enableRecoveryPointCaching) {
      return null;
    }

    const contextHash = this.generateContextHash(context);
    const cached = this.recoveryPointCache.get(contextHash);

    if (cached) {
      cached.hitCount++;
      cached.lastUsed = Date.now();
      return cached.point;
    }

    return null;
  }

  /**
   * Cache a recovery point
   */
  cacheRecoveryPoint(context: ParserContext, point: RecoveryPoint): void {
    if (!this.config.enableRecoveryPointCaching) {
      return;
    }

    const contextHash = this.generateContextHash(context);
    
    // Evict old entries if cache will be full after adding new entry
    if (this.recoveryPointCache.size >= this.config.recoveryPointCacheSize) {
      this.evictOldestCacheEntry();
    }

    this.recoveryPointCache.set(contextHash, {
      point,
      contextHash,
      hitCount: 1,
      lastUsed: Date.now(),
    });
  }

  /**
   * Apply bounded recovery with token skip limits
   */
  boundedTokenSkip(context: ParserContext, maxSkip?: number): number {
    const limit = Math.min(
      maxSkip ?? this.config.maxTokensToSkip,
      this.config.maxTokensToSkip
    );

    let tokensSkipped = 0;
    const startPosition = context.getPosition();

    while (!context.isAtEnd() && tokensSkipped < limit) {
      context.consume();
      tokensSkipped++;
    }

    return tokensSkipped;
  }

  /**
   * Manage recovery history size to prevent memory bloat
   */
  manageRecoveryHistory(context: ParserContext): void {
    const history = context.getRecoveryHistory();
    
    if (history.length > this.config.maxRecoveryHistorySize) {
      // Remove oldest entries, keeping the most recent ones
      const excessCount = history.length - this.config.maxRecoveryHistorySize;
      history.splice(0, excessCount);
    }
  }

  /**
   * Manage context stack depth to prevent stack overflow
   */
  manageContextStack(context: ParserContext): boolean {
    const stack = context.getContextStack();
    
    if (stack.length >= this.config.maxContextStackDepth) {
      // Prevent further context pushes
      return false;
    }
    
    return true;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    isRecoveryActive: boolean;
    recoveryAttempts: number;
    cacheSize: number;
    cacheHitRate: number;
  } {
    const totalHits = Array.from(this.recoveryPointCache.values())
      .reduce((sum, cached) => sum + cached.hitCount, 0);
    
    const cacheHitRate = this.recoveryPointCache.size > 0 
      ? totalHits / this.recoveryPointCache.size 
      : 0;

    return {
      isRecoveryActive: this.isRecoveryActive,
      recoveryAttempts: this.recoveryAttemptCount,
      cacheSize: this.recoveryPointCache.size,
      cacheHitRate,
    };
  }

  /**
   * Clear all caches and reset state
   */
  clearCaches(): void {
    this.recoveryPointCache.clear();
    this.resetRecovery();
  }

  /**
   * Generate a hash for the current parsing context
   */
  private generateContextHash(context: ParserContext): string {
    const position = context.getPosition();
    const contextStack = context.getContextStack();
    const contextNames = contextStack.map(ctx => ctx.name).join('|');
    const fileName = context.fileName;
    const tokenCount = context.tokens.length;
    
    // More unique hash based on position, context stack, filename, and token count
    return `${fileName}:${position}:${tokenCount}:${contextNames}`;
  }

  /**
   * Evict the oldest cache entry based on last used time
   */
  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, cached] of this.recoveryPointCache) {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.recoveryPointCache.delete(oldestKey);
    }
  }
}

/**
 * Fast path checker for error-free parsing
 * Provides optimizations when no errors are encountered
 */
export class FastPathOptimizer {
  private errorCount = 0;
  private fastPathEnabled = true;

  /**
   * Check if fast path is enabled
   */
  isFastPathEnabled(): boolean {
    return this.fastPathEnabled && this.errorCount === 0;
  }

  /**
   * Record an error, potentially disabling fast path
   */
  recordError(): void {
    this.errorCount++;
    if (this.errorCount > 0) {
      this.fastPathEnabled = false;
    }
  }

  /**
   * Reset for new parsing operation
   */
  reset(): void {
    this.errorCount = 0;
    this.fastPathEnabled = true;
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errorCount;
  }
}

/**
 * Memory-efficient recovery event with circular buffer
 */
export class BoundedRecoveryHistory {
  private events: RecoveryEvent[];
  private maxSize: number;
  private currentIndex = 0;
  private isFull = false;

  constructor(maxSize: number = DEFAULT_RECOVERY_PERFORMANCE_CONFIG.maxRecoveryHistorySize) {
    this.maxSize = maxSize;
    this.events = new Array(maxSize);
  }

  /**
   * Add a recovery event
   */
  addEvent(event: RecoveryEvent): void {
    this.events[this.currentIndex] = event;
    this.currentIndex = (this.currentIndex + 1) % this.maxSize;
    
    if (this.currentIndex === 0) {
      this.isFull = true;
    }
  }

  /**
   * Get all events in chronological order
   */
  getEvents(): RecoveryEvent[] {
    if (!this.isFull) {
      return this.events.slice(0, this.currentIndex);
    }

    // Return events in chronological order when buffer is full
    return [
      ...this.events.slice(this.currentIndex),
      ...this.events.slice(0, this.currentIndex)
    ];
  }

  /**
   * Get the most recent N events
   */
  getRecentEvents(count: number): RecoveryEvent[] {
    const allEvents = this.getEvents();
    return allEvents.slice(-count);
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.currentIndex = 0;
    this.isFull = false;
  }

  /**
   * Get current size
   */
  size(): number {
    return this.isFull ? this.maxSize : this.currentIndex;
  }
}

/**
 * Optimized context stack with depth limits
 */
export class BoundedContextStack {
  private stack: ParsingContext[];
  private maxDepth: number;

  constructor(maxDepth: number = DEFAULT_RECOVERY_PERFORMANCE_CONFIG.maxContextStackDepth) {
    this.maxDepth = maxDepth;
    this.stack = [];
  }

  /**
   * Push a context if within depth limits
   */
  push(context: ParsingContext): boolean {
    if (this.stack.length >= this.maxDepth) {
      return false; // Reject push to prevent stack overflow
    }

    this.stack.push(context);
    return true;
  }

  /**
   * Pop the top context
   */
  pop(): ParsingContext | null {
    return this.stack.pop() || null;
  }

  /**
   * Get the current (top) context
   */
  getCurrent(): ParsingContext | null {
    return this.stack[this.stack.length - 1] || null;
  }

  /**
   * Get a copy of the entire stack
   */
  getStack(): ParsingContext[] {
    return [...this.stack];
  }

  /**
   * Get current depth
   */
  depth(): number {
    return this.stack.length;
  }

  /**
   * Check if at maximum depth
   */
  isAtMaxDepth(): boolean {
    return this.stack.length >= this.maxDepth;
  }

  /**
   * Clear the stack
   */
  clear(): void {
    this.stack.length = 0;
  }
}