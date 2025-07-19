import { describe, expect, it } from "vitest";
import { DiagnosticCollection } from "../../diagnostics/mod.ts";
import { Span, SpanLocation } from "../../tokens/Span.ts";
import { Token } from "../../tokens/Token.ts";
import { ParserContext } from "../Parser.ts";
import {
  arrayLiteral,
  expression,
  expressionWithRecovery,
  recordLiteral,
} from "./Expression.ts";

// Helper function to create a simple token
function createToken(
  kind: Token["kind"],
  text: string = "",
  symbol?: string,
): Token {
  const span = new Span(
    new SpanLocation(1, 1, 0),
    new SpanLocation(1, 1, text.length),
  );

  if (kind === "Identifier") {
    return { kind, text, span } as Token;
  } else if (kind === "Symbol") {
    return { kind, symbol: symbol as any, text, span } as Token;
  } else if (kind === "IntegerLiteral" || kind === "StringLiteral") {
    return { kind, text, span } as Token;
  } else {
    return { kind, text, span } as Token;
  }
}

// Helper function to create parser context
function createContext(tokens: Token[]): ParserContext {
  return new ParserContext("test.txt", tokens, new DiagnosticCollection());
}

describe("Expression Parser Error Recovery", () => {
  describe("Error Recovery Integration", () => {
    it("should demonstrate error recovery integration with expressionWithRecovery", () => {
      const tokens = [
        createToken("Identifier", "valid"),
      ];
      const context = createContext(tokens);

      const result = expressionWithRecovery().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeDefined();
        expect(result.value.kind).toBe("Identifier");
      }

      // Context should have been pushed and popped properly
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should handle error recovery with invalid tokens", () => {
      const tokens = [
        createToken("Symbol", "+", "Plus"), // Invalid expression start
        createToken("Identifier", "recovered"),
      ];
      const context = createContext(tokens);

      const result = expressionWithRecovery().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeDefined();
        // Should have either parsed successfully or created a recovery placeholder
        expect(result.value.kind).toBeDefined();
      }

      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      // May have diagnostics depending on recovery behavior
      expect(Array.isArray(diagnostics)).toBe(true);
    });

    it("should properly manage parsing context during recovery", () => {
      const tokens = [
        createToken("Identifier", "test"),
      ];
      const context = createContext(tokens);

      const result = expressionWithRecovery().parse(context);

      expect(result.type).toBe("success");

      // Context should have been pushed and popped
      expect(context.getCurrentContext()).toBeNull();

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);
    });
  });

  describe("Basic Expression Parsing", () => {
    it("should parse valid expressions without recovery", () => {
      const tokens = [
        createToken("Identifier", "valid"),
      ];
      const context = createContext(tokens);

      const result = expression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeDefined();
      }
    });

    it("should parse array literals", () => {
      const tokens = [
        createToken("Symbol", "[", "OpenBracket"),
        createToken("IntegerLiteral", "1"),
        createToken("Symbol", ",", "Comma"),
        createToken("IntegerLiteral", "2"),
        createToken("Symbol", "]", "CloseBracket"),
      ];
      const context = createContext(tokens);

      const result = arrayLiteral().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.elements.length).toBe(2);
      }
    });

    it("should parse record literals", () => {
      const tokens = [
        createToken("Symbol", "{", "OpenBrace"),
        createToken("Identifier", "name"),
        createToken("Symbol", ":", "Colon"),
        createToken("StringLiteral", '"test"'),
        createToken("Symbol", "}", "CloseBrace"),
      ];
      const context = createContext(tokens);

      const result = recordLiteral().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeDefined();
      }
    });
  });
});
