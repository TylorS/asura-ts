import { describe, expect, it } from "vitest";
import { DiagnosticCode, DiagnosticCollection } from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Identifier, Newline, Symbol, Token } from "../tokens/Token.ts";
import { ParseError, ParseFailure, ParserContext } from "./Parser.ts";
import {
  DelimiterRecovery,
  ExpressionRecovery,
  KeywordRecovery,
  RecoveryStrategy,
  StatementBoundaryRecovery,
} from "./ErrorRecovery.ts";

// Helper function to create a test span
function createSpan(line: number = 1, col: number = 1): Span {
  const location = new SpanLocation(line, col, 0);
  return new Span(location, location);
}

// Helper function to create test tokens
function createTokens(): Token[] {
  return [
    new Identifier("test", createSpan(1, 1)),
    new Symbol("OpenParen", "(", createSpan(1, 5)),
    new Identifier("param", createSpan(1, 6)),
    new Symbol("Comma", ",", createSpan(1, 11)),
    new Identifier("param2", createSpan(1, 13)),
    // Missing CloseParen here
    new Symbol("OpenBrace", "{", createSpan(1, 20)),
    new Identifier("body", createSpan(1, 22)),
    new Symbol("CloseBrace", "}", createSpan(1, 27)),
    new Newline(createSpan(1, 28)),
    new Identifier("nextStatement", createSpan(2, 1)),
  ];
}

// Helper function to create test context
function createTestContext(tokens: Token[] = createTokens()): ParserContext {
  return new ParserContext("test.ts", tokens, new DiagnosticCollection());
}

// Helper function to create test failure
function createTestFailure(
  code: DiagnosticCode = DiagnosticCode.UNEXPECTED_TOKEN,
): ParseFailure {
  const error = ParseError.error(
    code,
    "Test error",
    createSpan(),
  );
  return new ParseFailure([error]);
}

describe("StatementBoundaryRecovery", () => {
  const strategy = new StatementBoundaryRecovery();

  it("should identify when recovery is possible", () => {
    const context = createTestContext();
    const failure = createTestFailure();

    expect(strategy.canRecover(context, failure)).toBe(true);
  });

  it("should skip tokens to newline boundary", () => {
    const context = createTestContext();
    const failure = createTestFailure();

    // Position at start of tokens
    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.tokensSkipped > 0).toBe(true);
    expect(result.virtualTokensInserted.length).toBe(0);
    expect(result.message).toBeDefined();
  });

  it("should skip tokens to semicolon boundary", () => {
    const tokens = [
      new Identifier("test", createSpan()),
      new Identifier("invalid", createSpan()),
      new Symbol("Semicolon", ";", createSpan()),
      new Identifier("next", createSpan()),
    ];
    const context = createTestContext(tokens);
    const failure = createTestFailure();

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.tokensSkipped).toBe(2); // "test" and "invalid"
  });

  it("should skip tokens to brace boundary", () => {
    const tokens = [
      new Identifier("test", createSpan()),
      new Identifier("invalid", createSpan()),
      new Symbol("OpenBrace", "{", createSpan()),
      new Identifier("next", createSpan()),
    ];
    const context = createTestContext(tokens);
    const failure = createTestFailure();

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.tokensSkipped).toBe(2); // "test" and "invalid"
  });

  it("should handle end of input gracefully", () => {
    const tokens: Token[] = [];
    const context = createTestContext(tokens);
    const failure = createTestFailure();

    expect(strategy.canRecover(context, failure)).toBe(false);
  });
});

describe("DelimiterRecovery", () => {
  const strategy = new DelimiterRecovery();

  it("should identify delimiter-related failures", () => {
    const error = ParseError.error(
      DiagnosticCode.UNCLOSED_DELIMITER,
      "Unclosed parenthesis",
      createSpan(),
    );
    const failure = new ParseFailure([error]);
    const context = createTestContext();

    expect(strategy.canRecover(context, failure)).toBe(true);
  });

  it("should identify failures with delimiter keywords in message", () => {
    const error = ParseError.error(
      DiagnosticCode.UNEXPECTED_TOKEN,
      "Expected closing brace",
      createSpan(),
    );
    const failure = new ParseFailure([error]);
    const context = createTestContext();

    expect(strategy.canRecover(context, failure)).toBe(true);
  });

  it("should suggest missing delimiter insertion", () => {
    const tokens = [
      new Identifier("func", createSpan()),
      new Symbol("OpenParen", "(", createSpan()),
      new Identifier("param", createSpan()),
      // Missing CloseParen
      new Symbol("OpenBrace", "{", createSpan()),
    ];
    const context = createTestContext(tokens);
    const failure = createTestFailure(DiagnosticCode.UNCLOSED_DELIMITER);

    // Position after the opening paren
    context.setPosition(2);

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
  });

  it("should skip to next delimiter when no match found", () => {
    const tokens = [
      new Identifier("broken", createSpan()),
      new Identifier("syntax", createSpan()),
      new Symbol("Comma", ",", createSpan()),
      new Identifier("next", createSpan()),
    ];
    const context = createTestContext(tokens);
    const failure = createTestFailure(DiagnosticCode.UNCLOSED_DELIMITER);

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.tokensSkipped).toBe(2); // "broken" and "syntax"
  });
});

describe("ExpressionRecovery", () => {
  const strategy = new ExpressionRecovery();

  it("should identify expression context failures", () => {
    const context = createTestContext();
    context.pushParsingContext({
      name: "binary-expression",
      expectedElements: ["operator"],
      recoveryStrategies: [],
      metadata: {},
    });

    const failure = createTestFailure();

    expect(strategy.canRecover(context, failure)).toBe(true);
  });

  it("should identify expression-related error messages", () => {
    const error = ParseError.error(
      DiagnosticCode.UNEXPECTED_TOKEN,
      "Expected operator in expression",
      createSpan(),
    );
    const failure = new ParseFailure([error]);
    const context = createTestContext();

    expect(strategy.canRecover(context, failure)).toBe(true);
  });

  it("should skip to operator boundary", () => {
    const tokens = [
      new Identifier("broken", createSpan()),
      new Identifier("expr", createSpan()),
      new Symbol("Plus", "+", createSpan()),
      new Identifier("next", createSpan()),
    ];
    const context = createTestContext(tokens);
    const failure = createTestFailure();

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.tokensSkipped).toBe(2); // "broken" and "expr"
  });

  it("should skip to comma boundary", () => {
    const tokens = [
      new Identifier("broken", createSpan()),
      new Identifier("expr", createSpan()),
      new Symbol("Comma", ",", createSpan()),
      new Identifier("next", createSpan()),
    ];
    const context = createTestContext(tokens);
    const failure = createTestFailure();

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.tokensSkipped).toBe(2); // "broken" and "expr"
  });
});

describe("KeywordRecovery", () => {
  const strategy = new KeywordRecovery();

  it("should identify keyword-related failures", () => {
    const error = ParseError.error(
      DiagnosticCode.UNEXPECTED_TOKEN,
      "Unexpected keyword",
      createSpan(),
    );
    const failure = new ParseFailure([error]);
    const context = createTestContext();

    expect(strategy.canRecover(context, failure)).toBe(true);
  });

  it("should provide suggestions for misplaced keywords", () => {
    const context = createTestContext();
    context.pushParsingContext({
      name: "expression-context",
      expectedElements: [],
      recoveryStrategies: [],
      metadata: {},
    });

    const failure = createTestFailure();

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
  });

  it("should skip to safe recovery point", () => {
    const tokens = [
      new Identifier("broken", createSpan()),
      new Identifier("syntax", createSpan()),
      new Symbol("Semicolon", ";", createSpan()),
      new Identifier("next", createSpan()),
    ];
    const context = createTestContext(tokens);
    const failure = createTestFailure();

    const result = strategy.recover(context, failure);

    expect(result.success).toBe(true);
    expect(result.tokensSkipped).toBe(2); // "broken" and "syntax"
  });
});

describe("Recovery Strategy Interface", () => {
  it("should have consistent interface across all strategies", () => {
    const strategies: RecoveryStrategy[] = [
      new StatementBoundaryRecovery(),
      new DelimiterRecovery(),
      new ExpressionRecovery(),
      new KeywordRecovery(),
    ];

    for (const strategy of strategies) {
      expect(strategy.name).toBeDefined();
      expect(typeof strategy.canRecover).toBe("function");
      expect(typeof strategy.recover).toBe("function");
    }
  });

  it("should return consistent RecoveryResult structure", () => {
    const context = createTestContext();
    const failure = createTestFailure();
    const strategy = new StatementBoundaryRecovery();

    const result = strategy.recover(context, failure);

    expect(typeof result.success).toBe("boolean");
    expect(typeof result.tokensSkipped).toBe("number");
    expect(Array.isArray(result.virtualTokensInserted)).toBe(true);
    expect(typeof result.message).toBe("string");
  });
});
