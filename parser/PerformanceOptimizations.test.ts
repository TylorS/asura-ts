import { beforeEach, describe, expect, it } from "vitest";
import { DiagnosticCollection } from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Token } from "../tokens/Token.ts";
import { ParseError, ParserContext } from "./Parser.ts";
import { DiagnosticCode } from "../diagnostics/mod.ts";
import {
  BoundedContextStack,
  BoundedRecoveryHistory,
  DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
  FastPathOptimizer,
  type RecoveryPerformanceConfig,
  RecoveryPerformanceManager,
} from "./PerformanceOptimizations.ts";

// Helper function to create a simple token
function createToken(
  kind: Token["kind"],
  text: string = "",
  line: number = 1,
  column: number = 1,
): Token {
  const span = new Span(
    new SpanLocation(line, column, 0),
    new SpanLocation(line, column + text.length, text.length),
  );

  if (kind === "Identifier") {
    return { kind, text, span } as Token;
  }

  return { kind, span } as Token;
}

// Helper function to create parser context
function createContext(
  tokens: Token[],
  config?: RecoveryPerformanceConfig,
): ParserContext {
  return new ParserContext(
    "test.ts",
    tokens,
    new DiagnosticCollection(),
    config,
  );
}

describe("RecoveryPerformanceManager", () => {
  let manager: RecoveryPerformanceManager;

  beforeEach(() => {
    manager = new RecoveryPerformanceManager();
  });

  describe("Lazy recovery activation", () => {
    it("should not be active initially", () => {
      expect(manager.isRecoveryActivated()).toBe(false);
    });

    it("should activate recovery when requested", () => {
      manager.activateRecovery();
      expect(manager.isRecoveryActivated()).toBe(true);
    });

    it("should reset recovery state", () => {
      manager.activateRecovery();
      expect(manager.isRecoveryActivated()).toBe(true);

      manager.resetRecovery();
      expect(manager.isRecoveryActivated()).toBe(false);
    });
  });

  describe("Recovery attempt limits", () => {
    it("should allow recovery attempts within limit", () => {
      expect(manager.canAttemptRecovery()).toBe(true);
    });

    it("should track recovery attempts", () => {
      for (let i = 0; i < 5; i++) {
        manager.incrementRecoveryAttempts();
      }

      const stats = manager.getPerformanceStats();
      expect(stats.recoveryAttempts).toBe(5);
    });

    it("should prevent recovery when limit is reached", () => {
      const config = {
        ...DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
        maxRecoveryAttempts: 3,
      };
      const limitedManager = new RecoveryPerformanceManager(config);

      // Reach the limit
      for (let i = 0; i < 3; i++) {
        limitedManager.incrementRecoveryAttempts();
      }

      expect(limitedManager.canAttemptRecovery()).toBe(false);
    });
  });

  describe("Recovery point caching", () => {
    it("should cache recovery points", () => {
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);

      const point = {
        position: 0,
        diagnosticCount: 0,
        timestamp: Date.now(),
      };

      manager.cacheRecoveryPoint(context, point);
      const cached = manager.getCachedRecoveryPoint(context);

      expect(cached).toEqual(point);
    });

    it("should return null when caching is disabled", () => {
      const config = {
        ...DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
        enableRecoveryPointCaching: false,
      };
      const noCacheManager = new RecoveryPerformanceManager(config);

      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);

      const point = {
        position: 0,
        diagnosticCount: 0,
        timestamp: Date.now(),
      };

      noCacheManager.cacheRecoveryPoint(context, point);
      const cached = noCacheManager.getCachedRecoveryPoint(context);

      expect(cached).toBeNull();
    });
  });
  

  describe("Bounded token skipping", () => {
    it("should skip tokens within limit", () => {
      const tokens = [
        createToken("Identifier", "test1"),
        createToken("Identifier", "test2"),
        createToken("Identifier", "test3"),
      ];
      const context = createContext(tokens);

      const tokensSkipped = manager.boundedTokenSkip(context, 2);

      expect(tokensSkipped).toBe(2);
      expect(context.getPosition()).toBe(2);
    });

    it("should respect global token skip limit", () => {
      const config = {
        ...DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
        maxTokensToSkip: 2,
      };
      const limitedManager = new RecoveryPerformanceManager(config);

      const tokens = Array.from(
        { length: 10 },
        (_, i) => createToken("Identifier", `test${i}`),
      );
      const context = createContext(tokens);

      const tokensSkipped = limitedManager.boundedTokenSkip(context, 5); // Request 5, but limit is 2

      expect(tokensSkipped).toBe(2);
      expect(context.getPosition()).toBe(2);
    });

    it("should handle end of input gracefully", () => {
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);

      const tokensSkipped = manager.boundedTokenSkip(context, 5);

      expect(tokensSkipped).toBe(1);
      expect(context.isAtEnd()).toBe(true);
    });
  });

  describe("Performance statistics", () => {
    it("should provide accurate performance stats", () => {
      manager.activateRecovery();
      manager.incrementRecoveryAttempts();
      manager.incrementRecoveryAttempts();

      const stats = manager.getPerformanceStats();

      expect(stats.isRecoveryActive).toBe(true);
      expect(stats.recoveryAttempts).toBe(2);
      expect(stats.cacheSize).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
    });

    it("should calculate cache hit rate correctly", () => {
      const tokens1 = [createToken("Identifier", "test1")];
      const tokens2 = [createToken("Identifier", "test2")];

      // Create contexts with different filenames to ensure different context hashes
      const context1 = new ParserContext(
        "file1.ts",
        tokens1,
        new DiagnosticCollection(),
      );
      const context2 = new ParserContext(
        "file2.ts",
        tokens2,
        new DiagnosticCollection(),
      );

      const point1 = { position: 0, diagnosticCount: 0, timestamp: Date.now() };
      const point2 = { position: 0, diagnosticCount: 0, timestamp: Date.now() };

      manager.cacheRecoveryPoint(context1, point1);
      manager.cacheRecoveryPoint(context2, point2);

      // Access cached points to increase hit count
      manager.getCachedRecoveryPoint(context1); // Hit count becomes 2
      manager.getCachedRecoveryPoint(context1); // Hit count becomes 3
      manager.getCachedRecoveryPoint(context2); // Hit count becomes 2

      const stats = manager.getPerformanceStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.cacheHitRate).toBe(2.5); // (3 + 2) / 2 = 2.5 average hits per entry
    });
  });

  describe("Cache management", () => {
    it("should clear all caches", () => {
      manager.activateRecovery();
      manager.incrementRecoveryAttempts();

      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);
      const point = { position: 0, diagnosticCount: 0, timestamp: Date.now() };
      manager.cacheRecoveryPoint(context, point);

      manager.clearCaches();

      const stats = manager.getPerformanceStats();
      expect(stats.isRecoveryActive).toBe(false);
      expect(stats.recoveryAttempts).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });
  });
});

describe("FastPathOptimizer", () => {
  let optimizer: FastPathOptimizer;

  beforeEach(() => {
    optimizer = new FastPathOptimizer();
  });

  describe("Fast path detection", () => {
    it("should be enabled initially", () => {
      expect(optimizer.isFastPathEnabled()).toBe(true);
      expect(optimizer.getErrorCount()).toBe(0);
    });

    it("should disable fast path when error is recorded", () => {
      optimizer.recordError();

      expect(optimizer.isFastPathEnabled()).toBe(false);
      expect(optimizer.getErrorCount()).toBe(1);
    });

    it("should track multiple errors", () => {
      optimizer.recordError();
      optimizer.recordError();
      optimizer.recordError();

      expect(optimizer.getErrorCount()).toBe(3);
      expect(optimizer.isFastPathEnabled()).toBe(false);
    });

    it("should reset correctly", () => {
      optimizer.recordError();
      expect(optimizer.isFastPathEnabled()).toBe(false);

      optimizer.reset();
      expect(optimizer.isFastPathEnabled()).toBe(true);
      expect(optimizer.getErrorCount()).toBe(0);
    });
  });
});

describe("BoundedRecoveryHistory", () => {
  let history: BoundedRecoveryHistory;

  beforeEach(() => {
    history = new BoundedRecoveryHistory(3); // Small size for testing
  });

  describe("Event management", () => {
    it("should add events correctly", () => {
      const event1 = {
        strategy: "test1",
        position: 0,
        tokensSkipped: 1,
        success: true,
        message: "test message 1",
      };

      history.addEvent(event1);

      expect(history.size()).toBe(1);
      expect(history.getEvents()).toEqual([event1]);
    });

    it("should handle circular buffer correctly", () => {
      const events = [
        {
          strategy: "test1",
          position: 0,
          tokensSkipped: 1,
          success: true,
          message: "msg1",
        },
        {
          strategy: "test2",
          position: 1,
          tokensSkipped: 2,
          success: true,
          message: "msg2",
        },
        {
          strategy: "test3",
          position: 2,
          tokensSkipped: 3,
          success: true,
          message: "msg3",
        },
        {
          strategy: "test4",
          position: 3,
          tokensSkipped: 4,
          success: true,
          message: "msg4",
        }, // Should overwrite first
      ];

      events.forEach((event) => history.addEvent(event));

      expect(history.size()).toBe(3);
      const retrievedEvents = history.getEvents();
      expect(retrievedEvents).toEqual([events[1], events[2], events[3]]); // First event should be overwritten
    });

    it("should get recent events correctly", () => {
      const events = [
        {
          strategy: "test1",
          position: 0,
          tokensSkipped: 1,
          success: true,
          message: "msg1",
        },
        {
          strategy: "test2",
          position: 1,
          tokensSkipped: 2,
          success: true,
          message: "msg2",
        },
        {
          strategy: "test3",
          position: 2,
          tokensSkipped: 3,
          success: true,
          message: "msg3",
        },
      ];

      events.forEach((event) => history.addEvent(event));

      const recent = history.getRecentEvents(2);
      expect(recent).toEqual([events[1], events[2]]);
    });

    it("should clear events correctly", () => {
      const event = {
        strategy: "test",
        position: 0,
        tokensSkipped: 1,
        success: true,
        message: "test message",
      };

      history.addEvent(event);
      expect(history.size()).toBe(1);

      history.clear();
      expect(history.size()).toBe(0);
      expect(history.getEvents()).toEqual([]);
    });
  });
});

describe("BoundedContextStack", () => {
  let stack: BoundedContextStack;

  beforeEach(() => {
    stack = new BoundedContextStack(3); // Small size for testing
  });

  describe("Stack operations", () => {
    it("should push and pop contexts correctly", () => {
      const context1 = {
        name: "test1",
        expectedElements: ["element1"],
        recoveryStrategies: ["strategy1"],
        metadata: {},
      };

      expect(stack.push(context1)).toBe(true);
      expect(stack.depth()).toBe(1);
      expect(stack.getCurrent()).toBe(context1);

      const popped = stack.pop();
      expect(popped).toBe(context1);
      expect(stack.depth()).toBe(0);
      expect(stack.getCurrent()).toBeNull();
    });

    it("should reject pushes when at maximum depth", () => {
      const contexts = [
        {
          name: "test1",
          expectedElements: [],
          recoveryStrategies: [],
          metadata: {},
        },
        {
          name: "test2",
          expectedElements: [],
          recoveryStrategies: [],
          metadata: {},
        },
        {
          name: "test3",
          expectedElements: [],
          recoveryStrategies: [],
          metadata: {},
        },
        {
          name: "test4",
          expectedElements: [],
          recoveryStrategies: [],
          metadata: {},
        }, // Should be rejected
      ];

      expect(stack.push(contexts[0])).toBe(true);
      expect(stack.push(contexts[1])).toBe(true);
      expect(stack.push(contexts[2])).toBe(true);
      expect(stack.isAtMaxDepth()).toBe(true);
      expect(stack.push(contexts[3])).toBe(false); // Should be rejected

      expect(stack.depth()).toBe(3);
    });

    it("should provide correct stack copy", () => {
      const contexts = [
        {
          name: "test1",
          expectedElements: [],
          recoveryStrategies: [],
          metadata: {},
        },
        {
          name: "test2",
          expectedElements: [],
          recoveryStrategies: [],
          metadata: {},
        },
      ];

      stack.push(contexts[0]);
      stack.push(contexts[1]);

      const stackCopy = stack.getStack();
      expect(stackCopy).toEqual(contexts);
      expect(stackCopy).not.toBe(contexts); // Should be a copy
    });

    it("should clear stack correctly", () => {
      const context = {
        name: "test",
        expectedElements: [],
        recoveryStrategies: [],
        metadata: {},
      };

      stack.push(context);
      expect(stack.depth()).toBe(1);

      stack.clear();
      expect(stack.depth()).toBe(0);
      expect(stack.getCurrent()).toBeNull();
    });
  });
});

describe("ParserContext Performance Integration", () => {
  describe("Fast path optimization", () => {
    it("should enable fast path initially", () => {
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);

      expect(context.isFastPathEnabled()).toBe(true);
      expect(context.isRecoveryActive()).toBe(false);
    });

    it("should disable fast path when error occurs", () => {
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);

      const error = ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Test error",
        tokens[0].span,
      );

      context.addRecoveryError(error, "TestStrategy");

      expect(context.isFastPathEnabled()).toBe(false);
      expect(context.isRecoveryActive()).toBe(true);
    });
  });

  describe("Recovery attempt limits", () => {
    it("should respect recovery attempt limits", () => {
      const config = {
        ...DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
        maxRecoveryAttempts: 2,
      };
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens, config);

      expect(context.canAttemptRecovery()).toBe(true);

      // Simulate recovery attempts by adding recovery errors
      const error = ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Test",
        tokens[0].span,
      );
      context.addRecoveryError(error, "TestStrategy1");
      context.addRecoveryError(error, "TestStrategy2");

      // After 2 attempts, should not be able to attempt more
      expect(context.canAttemptRecovery()).toBe(false);
    });
  });

  describe("Context stack limits", () => {
    it("should respect context stack depth limits", () => {
      const config = {
        ...DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
        maxContextStackDepth: 2,
      };
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens, config);

      const context1 = {
        name: "test1",
        expectedElements: [],
        recoveryStrategies: [],
        metadata: {},
      };
      const context2 = {
        name: "test2",
        expectedElements: [],
        recoveryStrategies: [],
        metadata: {},
      };
      const context3 = {
        name: "test3",
        expectedElements: [],
        recoveryStrategies: [],
        metadata: {},
      };

      context.pushParsingContext(context1);
      context.pushParsingContext(context2);
      context.pushParsingContext(context3); // Should be rejected and generate warning

      expect(context.getContextStack()).toHaveLength(2);

      // Should have generated a warning diagnostic
      const diagnostics = context.diagnostics.getAll();
      const warnings = diagnostics.filter((d) =>
        d.code === DiagnosticCode.PARSER_LIMIT_EXCEEDED
      );
      expect(warnings).toHaveLength(1);
    });
  });

  describe("Recovery history management", () => {
    it("should manage recovery history size", () => {
      const config = {
        ...DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
        maxRecoveryHistorySize: 3,
      };
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens, config);

      // Add more recovery events than the limit
      for (let i = 0; i < 5; i++) {
        const error = ParseError.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Test error ${i}`,
          tokens[0].span,
        );
        context.addRecoveryError(error, `TestStrategy${i}`);
      }

      const history = context.getRecoveryHistory();
      expect(history.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Performance statistics", () => {
    it("should provide comprehensive performance statistics", () => {
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);

      // Add some recovery activity
      const error = ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Test",
        tokens[0].span,
      );
      context.addRecoveryError(error, "TestStrategy");

      const stats = context.getPerformanceStats();

      expect(stats.isRecoveryActive).toBe(true);
      expect(stats.errorCount).toBe(1);
      expect(stats.isFastPathEnabled).toBe(false);
      expect(stats.recoveryAttempts).toBeGreaterThan(0);
    });
  });

  describe("Performance optimizer reset", () => {
    it("should reset performance optimizers correctly", () => {
      const tokens = [createToken("Identifier", "test")];
      const context = createContext(tokens);

      // Add some activity
      const error = ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Test",
        tokens[0].span,
      );
      context.addRecoveryError(error, "TestStrategy");

      expect(context.isFastPathEnabled()).toBe(false);
      expect(context.isRecoveryActive()).toBe(true);

      context.resetPerformanceOptimizers();

      expect(context.isFastPathEnabled()).toBe(true);
      expect(context.isRecoveryActive()).toBe(false);
    });
  });
});
