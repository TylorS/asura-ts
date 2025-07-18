import { describe, expect, it } from "vitest";
import { DiagnosticCode, DiagnosticCollection } from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Token } from "../tokens/Token.ts";
import {
  ParseFailure,
  ParserContext,
  ParseSuccess,
  synchronize,
  SyncPredicate,
  token,
} from "./Parser.ts";

// Helper function to create test tokens
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

describe("synchronize combinator", () => {
  it("should return successful result when main parser succeeds", () => {
    const tokens = [createToken("Identifier", "test")];
    const context = createContext(tokens);

    const identifierParser = token("Identifier");
    const syncPredicate: SyncPredicate = (token) => token.kind === "Newline";
    const syncParser = synchronize(identifierParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value.kind).toBe("Identifier");
      expect(result.value.text).toBe("test");
    }
  });

  it("should return null when synchronization succeeds", () => {
    const tokens = [
      createToken("Identifier", "unexpected"),
      createToken("Symbol", "Plus"),
      createToken("Newline"),
      createToken("Identifier", "after"),
    ];
    const context = createContext(tokens);

    // Try to parse a number but we have an identifier
    const numberParser = token("Number");
    const syncPredicate: SyncPredicate = (token) => token.kind === "Newline";
    const syncParser = synchronize(numberParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should have skipped to the newline
    expect(context.peek().kind).toBe("Newline");
  });

  it("should skip multiple tokens until sync predicate matches", () => {
    const tokens = [
      createToken("Identifier", "wrong1"),
      createToken("Symbol", "Plus"),
      createToken("Identifier", "wrong2"),
      createToken("Symbol", "Multiply"),
      createToken("Symbol", "Semicolon"), // sync point
      createToken("Identifier", "after"),
    ];
    const context = createContext(tokens);

    const numberParser = token("Number");
    const syncPredicate: SyncPredicate = (token) =>
      token.kind === "Symbol" && token.symbol === "Semicolon";
    const syncParser = synchronize(numberParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should be positioned at the semicolon
    expect(context.peek().kind).toBe("Symbol");
    expect(context.peek().symbol).toBe("Semicolon");
  });

  it("should fail when reaching end of input without finding sync point", () => {
    const tokens = [
      createToken("Identifier", "wrong1"),
      createToken("Symbol", "Plus"),
      createToken("Identifier", "wrong2"),
    ];
    const context = createContext(tokens);

    const numberParser = token("Number");
    const syncPredicate: SyncPredicate = (token) => token.kind === "Newline";
    const syncParser = synchronize(numberParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("failure");
    if (result.type === "failure") {
      // Should have both original error and sync failure error
      expect(result.errors.length).toBeGreaterThanOrEqual(2);

      // Check for sync failure error
      const syncError = result.errors.find((e) =>
        e.code === DiagnosticCode.SYNC_FAILED
      );
      expect(syncError).toBeDefined();
      expect(syncError!.message.includes("Failed to synchronize")).toBe(true);
    }
  });

  it("should handle empty token stream gracefully", () => {
    const tokens: Token[] = [];
    const context = createContext(tokens);

    const identifierParser = token("Identifier");
    const syncPredicate: SyncPredicate = (token) => token.kind === "Newline";
    const syncParser = synchronize(identifierParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("failure");
    if (result.type === "failure") {
      // Should have sync failure error
      const syncError = result.errors.find((e) =>
        e.code === DiagnosticCode.SYNC_FAILED
      );
      expect(syncError).toBeDefined();
    }
  });

  it("should use custom error message when provided", () => {
    const tokens = [
      createToken("Identifier", "wrong"),
      createToken("Symbol", "Plus"),
    ];
    const context = createContext(tokens);

    const numberParser = token("Number");
    const syncPredicate: SyncPredicate = (token) => token.kind === "Newline";
    const customMessage = "Custom sync failure message";
    const syncParser = synchronize(numberParser, syncPredicate, customMessage);

    const result = syncParser.parse(context);

    expect(result.type).toBe("failure");
    if (result.type === "failure") {
      const syncError = result.errors.find((e) =>
        e.code === DiagnosticCode.SYNC_FAILED
      );
      expect(syncError).toBeDefined();
      expect(syncError!.message).toBe(customMessage);
    }
  });

  it("should add recovery information when synchronization succeeds", () => {
    const tokens = [
      createToken("Identifier", "wrong"),
      createToken("Symbol", "Plus"),
      createToken("Newline"),
    ];
    const context = createContext(tokens);

    const numberParser = token("Number");
    const syncPredicate: SyncPredicate = (token) => token.kind === "Newline";
    const syncParser = synchronize(numberParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("success");

    // Check that recovery information was added to diagnostics
    const diagnostics = context.diagnostics.getAll();
    const recoveryDiagnostic = diagnostics.find((d) =>
      d.code === DiagnosticCode.RECOVERED_ERROR
    );
    expect(recoveryDiagnostic).toBeDefined();
    expect(recoveryDiagnostic!.message.includes("Synchronized after skipping"))
      .toBe(true);
  });

  it("should work with complex sync predicates", () => {
    const tokens = [
      createToken("Identifier", "wrong1"),
      createToken("Symbol", "Plus"),
      createToken("Symbol", "OpenBrace"),
      createToken("Identifier", "inside"),
      createToken("Symbol", "CloseBrace"), // This should match our complex predicate
      createToken("Identifier", "after"),
    ];
    const context = createContext(tokens);

    const numberParser = token("Number");

    // Complex predicate: match closing brace or semicolon
    const syncPredicate: SyncPredicate = (token, context) => {
      return token.kind === "Symbol" &&
        (token.symbol === "CloseBrace" || token.symbol === "Semicolon");
    };

    const syncParser = synchronize(numberParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should be positioned at the closing brace
    expect(context.peek().kind).toBe("Symbol");
    expect(context.peek().symbol).toBe("CloseBrace");
  });

  it("should preserve original parser position on success", () => {
    const tokens = [
      createToken("Identifier", "test"),
      createToken("Symbol", "Plus"),
    ];
    const context = createContext(tokens);

    const identifierParser = token("Identifier");
    const syncPredicate: SyncPredicate = (token) => token.kind === "Newline";
    const syncParser = synchronize(identifierParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("success");

    // Position should be after the consumed identifier
    expect(context.peek().kind).toBe("Symbol");
    expect(context.peek().symbol).toBe("Plus");
  });

  it("should handle sync predicate that uses context information", () => {
    const tokens = [
      createToken("Identifier", "wrong"),
      createToken("Symbol", "Plus"),
      createToken("Symbol", "OpenBrace"),
      createToken("Symbol", "CloseBrace"),
    ];
    const context = createContext(tokens);

    // Add some parsing context
    context.pushParsingContext({
      name: "test-context",
      expectedElements: ["Number"],
      recoveryStrategies: ["sync"],
      metadata: {},
    });

    const numberParser = token("Number");

    // Predicate that uses context information
    const syncPredicate: SyncPredicate = (token, ctx) => {
      const currentContext = ctx.getCurrentContext();
      return token.kind === "Symbol" &&
        token.symbol === "CloseBrace" &&
        currentContext?.name === "test-context";
    };

    const syncParser = synchronize(numberParser, syncPredicate);

    const result = syncParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should be positioned at the closing brace
    expect(context.peek().kind).toBe("Symbol");
    expect(context.peek().symbol).toBe("CloseBrace");
  });
});
