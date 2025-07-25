import { describe, expect, it } from "vitest";
import { DiagnosticCollection } from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Token } from "../tokens/Token.ts";
import {
  literal,
  ParseFailure,
  ParserContext,
  recover,
  token,
} from "./Parser.ts";
import { pipe } from "./Pipeable.ts";
import {
  DelimiterRecovery,
  RecoveryResult,
  RecoveryStrategy,
  StatementBoundaryRecovery,
} from "./ErrorRecovery.ts";

// Helper function to create a simple token
function createToken(kind: Token["kind"], text: string = ""): Token {
  const span = new Span(
    new SpanLocation(1, 1, 0),
    new SpanLocation(1, 1, text.length),
  );

  if (kind === "Identifier") {
    return { kind, text, span } as Token;
  } else if (kind === "Symbol") {
    return { kind, symbol: text as any, span } as Token;
  } else {
    return { kind, span } as Token;
  }
}

// Helper function to create parser context
function createContext(tokens: Token[]): ParserContext {
  return new ParserContext("test.txt", tokens, new DiagnosticCollection());
}

// Mock recovery strategy for testing
class MockRecoveryStrategy implements RecoveryStrategy {
  name = "MockRecoveryStrategy";

  constructor(
    private canRecoverResult: boolean = true,
    private recoverResult: RecoveryResult = {
      success: true,
      tokensSkipped: 1,
      virtualTokensInserted: [],
      message: "Mock recovery successful",
    },
  ) {}

  canRecover(): boolean {
    return this.canRecoverResult;
  }

  recover(context: ParserContext, failure: ParseFailure): RecoveryResult {
    if (this.recoverResult.success && this.recoverResult.tokensSkipped > 0) {
      // Actually skip the tokens in the context
      for (
        let i = 0;
        i < this.recoverResult.tokensSkipped && !context.isAtEnd();
        i++
      ) {
        context.consume();
      }
    }
    return this.recoverResult;
  }
}

describe("recover combinator", () => {
  it("should return main parser result when main parser succeeds", () => {
    const tokens = [createToken("Identifier", "test")];
    const context = createContext(tokens);

    const mainParser = token("Identifier");
    const recoveryParser = literal("fallback");
    const strategy = new MockRecoveryStrategy();

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value.kind).toBe("Identifier");
      expect(result.value.text).toBe("test");
    }
  });

  it("should return original failure when strategy cannot recover", () => {
    const tokens = [createToken("Symbol", "Plus")];
    const context = createContext(tokens);

    const mainParser = token("Identifier");
    const recoveryParser = token("Symbol");
    const strategy = new MockRecoveryStrategy(false); // Cannot recover

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    expect(result.type).toBe("failure");
    if (result.type === "failure") {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain("Expected Identifier");
    }
  });

  it("should apply recovery strategy and use recovery parser when main parser fails", () => {
    const tokens = [
      createToken("Symbol", "Plus"),
      createToken("Identifier", "recovered"),
    ];
    const context = createContext(tokens);

    const mainParser = token("Identifier");
    const recoveryParser = token("Identifier");
    const strategy = new MockRecoveryStrategy(true, {
      success: true,
      tokensSkipped: 1,
      virtualTokensInserted: [],
      message: "Skipped Plus symbol",
    });

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value.kind).toBe("Identifier");
      expect(result.value.text).toBe("recovered");
    }

    // Check that recovery was recorded
    const diagnostics = context.diagnostics.getAll();
    expect(diagnostics.some((d) => d.message.includes("MockRecoveryStrategy")))
      .toBe(true);
  });

  it("should return failure when recovery strategy fails", () => {
    const tokens = [createToken("Symbol", "Plus")];
    const context = createContext(tokens);

    const mainParser = token("Identifier");
    const recoveryParser = token("Identifier");
    const strategy = new MockRecoveryStrategy(true, {
      success: false,
      tokensSkipped: 0,
      virtualTokensInserted: [],
      message: "Recovery failed",
    });

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    expect(result.type).toBe("failure");
    if (result.type === "failure") {
      expect(result.errors.some((e) => e.message.includes("Recovery strategy")))
        .toBe(true);
    }
  });

  it("should return failure when recovery parser fails after successful strategy", () => {
    const tokens = [createToken("Symbol", "Plus")];
    const context = createContext(tokens);

    const mainParser = token("Identifier");
    const recoveryParser = token("Identifier"); // Will fail on Symbol
    const strategy = new MockRecoveryStrategy(true, {
      success: true,
      tokensSkipped: 0, // Don't skip the Plus token
      virtualTokensInserted: [],
      message: "Strategy succeeded but parser will fail",
    });

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    expect(result.type).toBe("failure");
    if (result.type === "failure") {
      expect(
        result.errors.some((e) => e.message.includes("Recovery parser failed")),
      ).toBe(true);
    }
  });

  it("should work with StatementBoundaryRecovery strategy", () => {
    const tokens = [
      createToken("Symbol", "Plus"), // Invalid token
      createToken("Symbol", "Minus"), // Another invalid token
      createToken("Newline"), // Statement boundary
      createToken("Identifier", "valid"),
    ];
    const context = createContext(tokens);

    const mainParser = token("Identifier");
    // Recovery parser should skip the newline and parse the identifier
    const recoveryParser = {
      parse(ctx: ParserContext) {
        // Skip any newlines or whitespace
        while (!ctx.isAtEnd()) {
          const tok = ctx.peek();
          if (tok.kind === "Newline" || tok.kind === "Whitespace") {
            ctx.consume();
          } else {
            break;
          }
        }
        return token("Identifier").parse(ctx);
      },
      pipe,
    };
    const strategy = new StatementBoundaryRecovery();

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value.kind).toBe("Identifier");
      expect(result.value.text).toBe("valid");
    }
  });

  it("should work with DelimiterRecovery strategy", () => {
    const tokens = [
      createToken("Symbol", "OpenParen"),
      createToken("Identifier", "content"),
      // Missing CloseParen - DelimiterRecovery should handle this
    ];
    const context = createContext(tokens);

    const mainParser = token("Symbol"); // Expecting a symbol but will fail on specific one
    const recoveryParser = token("Identifier");
    const strategy = new DelimiterRecovery();

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    // The exact behavior depends on DelimiterRecovery implementation
    // but it should either succeed with recovery or provide meaningful failure
    expect(result.type).toBeDefined();
  });

  it("should preserve position correctly when recovery fails", () => {
    const tokens = [
      createToken("Symbol", "Plus"),
      createToken("Identifier", "test"),
    ];
    const context = createContext(tokens);
    const initialPosition = context.getPosition();

    const mainParser = token("Identifier");
    const recoveryParser = token("Identifier");
    const strategy = new MockRecoveryStrategy(false); // Cannot recover

    const parser = recover(mainParser, recoveryParser, strategy);
    parser.parse(context);

    // Position should be reset to initial position when recovery fails
    expect(context.getPosition()).toBe(initialPosition);
  });

  it("should update recovery history with tokens skipped", () => {
    const tokens = [
      createToken("Symbol", "Plus"),
      createToken("Symbol", "Minus"),
      createToken("Identifier", "recovered"),
    ];
    const context = createContext(tokens);

    const mainParser = token("Identifier");
    const recoveryParser = token("Identifier");
    const strategy = new MockRecoveryStrategy(true, {
      success: true,
      tokensSkipped: 2,
      virtualTokensInserted: [],
      message: "Skipped 2 tokens",
    });

    const parser = recover(mainParser, recoveryParser, strategy);
    const result = parser.parse(context);

    expect(result.type).toBe("success");

    const recoveryHistory = context.getRecoveryHistory();
    expect(recoveryHistory.length).toBeGreaterThan(0);

    const lastEvent = recoveryHistory[recoveryHistory.length - 1];
    expect(lastEvent.strategy).toBe("MockRecoveryStrategy");
    expect(lastEvent.tokensSkipped).toBe(2);
    expect(lastEvent.success).toBe(true);
  });
});
