import { describe, expect, it } from "vitest";
import { DiagnosticCode, DiagnosticCollection } from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Token } from "../tokens/Token.ts";
import {
  ParserContext,
  recoverableDelimited,
  symbol,
  token,
} from "./Parser.ts";

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

  if (kind === "Symbol") {
    return { kind, symbol: text as any, span } as Token;
  }

  return { kind, span } as Token;
}

// Helper function to create a parser context
function createContext(tokens: Token[]): ParserContext {
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

describe("recoverableDelimited combinator", () => {
  describe("Basic functionality", () => {
    it("should parse successfully when all delimiters and content are present", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("Identifier", "content"),
        createToken("Symbol", "CloseParen"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toEqual(tokens[1]);
        expect(result.value.after).toEqual(tokens[2]);
      }
    });

    it("should handle whitespace between delimiters and content", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("Whitespace", " "),
        createToken("Identifier", "content"),
        createToken("Whitespace", " "),
        createToken("Symbol", "CloseParen"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toEqual(tokens[2]); // Skip whitespace
        expect(result.value.after).toEqual(tokens[4]);
      }
    });
  });

  describe("Missing opening delimiter", () => {
    it("should handle missing opening delimiter with insertMissing=true", () => {
      const tokens = [
        createToken("Identifier", "content"),
        createToken("Symbol", "CloseParen"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        true, // insertMissing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull();
        expect(result.value.content).toEqual(tokens[0]);
        expect(result.value.after).toEqual(tokens[1]);
      }

      // Should have inserted virtual opening delimiter
      const diagnostics = context.diagnostics.getAll();
      const insertedTokenDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN &&
        d.message.includes("opening delimiter")
      );
      expect(insertedTokenDiagnostics.length).toBe(1);
    });

    it("should handle missing opening delimiter with insertMissing=false", () => {
      const tokens = [
        createToken("Identifier", "content"),
        createToken("Symbol", "CloseParen"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        false, // insertMissing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull();
        expect(result.value.content).toEqual(tokens[0]);
        expect(result.value.after).toEqual(tokens[1]);
      }

      // Should not have inserted virtual opening delimiter
      const diagnostics = context.diagnostics.getAll();
      const insertedTokenDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN
      );
      expect(insertedTokenDiagnostics.length).toBe(0);
    });
  });

  describe("Missing closing delimiter", () => {
    it("should handle missing closing delimiter with insertMissing=true", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("Identifier", "content"),
        createToken("Identifier", "next"), // No closing paren
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        true, // insertMissing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toEqual(tokens[1]);
        expect(result.value.after).toBeNull();
      }

      // Should have inserted virtual closing delimiter
      const diagnostics = context.diagnostics.getAll();
      const insertedTokenDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN &&
        d.message.includes("closing delimiter")
      );
      expect(insertedTokenDiagnostics.length).toBe(1);
    });

    it("should synchronize to recovery point when closing delimiter is missing", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("Identifier", "content"),
        createToken("Identifier", "extra1"),
        createToken("Identifier", "extra2"),
        createToken("Symbol", "Semicolon"), // Recovery point
        createToken("Identifier", "after"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        true,
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toEqual(tokens[1]);
        expect(result.value.after).toBeNull();
      }

      // Should have recovery information about skipped tokens
      const recoveryHistory = context.getRecoveryHistory();
      const delimiterRecoveryEvents = recoveryHistory.filter((event) =>
        event.strategy === "DelimiterRecovery"
      );
      expect(delimiterRecoveryEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Missing both delimiters", () => {
    it("should handle missing both delimiters with insertMissing=true", () => {
      const tokens = [
        createToken("Identifier", "content"),
        createToken("Identifier", "next"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        true, // insertMissing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull();
        expect(result.value.content).toEqual(tokens[0]);
        expect(result.value.after).toBeNull();
      }

      // Should have inserted both virtual delimiters
      const diagnostics = context.diagnostics.getAll();
      const insertedTokenDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN
      );
      expect(insertedTokenDiagnostics.length).toBe(2); // Both opening and closing
    });

    it("should handle missing both delimiters with insertMissing=false", () => {
      const tokens = [
        createToken("Identifier", "content"),
        createToken("Identifier", "next"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        false, // insertMissing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull();
        expect(result.value.content).toEqual(tokens[0]);
        expect(result.value.after).toBeNull();
      }

      // Should not have inserted virtual delimiters
      const diagnostics = context.diagnostics.getAll();
      const insertedTokenDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN
      );
      expect(insertedTokenDiagnostics.length).toBe(0);
    });
  });

  describe("Failed content parsing", () => {
    it("should handle failed content parsing and continue with closing delimiter", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("IntegerLiteral", "123"), // Wrong token type for content
        createToken("Symbol", "CloseParen"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"), // Expects Identifier, gets Number
        symbol(")"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toBeNull(); // Content failed
        expect(result.value.after).toEqual(tokens[2]);
      }

      // Should have recovery information about failed content
      const recoveryHistory = context.getRecoveryHistory();
      const contentRecoveryEvents = recoveryHistory.filter((event) =>
        event.strategy === "DelimiterRecovery" &&
        event.message.includes("Content parsing failed")
      );
      expect(contentRecoveryEvents.length).toBe(1);
    });

    it("should skip problematic tokens when content parsing fails", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("IntegerLiteral", "123"), // Wrong token type
        createToken("Identifier", "extra"), // Extra token to skip
        createToken("Symbol", "CloseParen"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toBeNull();
        expect(result.value.after).toEqual(tokens[3]);
      }
    });
  });

  describe("Complete failure scenarios", () => {
    it("should fail when no part can be parsed", () => {
      const tokens = [
        createToken("IntegerLiteral", "123"), // Wrong for opening
        createToken("IntegerLiteral", "456"), // Wrong for content
        createToken("IntegerLiteral", "789"), // Wrong for closing
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        false, // Don't insert missing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("failure");
      if (result.type === "failure") {
        const completeFailureErrors = result.errors.filter((error) =>
          error.code === DiagnosticCode.UNCLOSED_DELIMITER &&
          error.message.includes("Failed to parse delimited expression")
        );
        expect(completeFailureErrors.length).toBe(1);
      }
    });
  });

  describe("Different delimiter types", () => {
    it("should work with brace delimiters", () => {
      const tokens = [
        createToken("Symbol", "OpenBrace"),
        createToken("Identifier", "content"),
        createToken("Symbol", "CloseBrace"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("{"),
        token("Identifier"),
        symbol("}"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toEqual(tokens[1]);
        expect(result.value.after).toEqual(tokens[2]);
      }
    });

    it("should work with bracket delimiters", () => {
      const tokens = [
        createToken("Symbol", "OpenBracket"),
        createToken("Identifier", "content"),
        createToken("Symbol", "CloseBracket"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("["),
        token("Identifier"),
        symbol("]"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toEqual(tokens[1]);
        expect(result.value.after).toEqual(tokens[2]);
      }
    });
  });

  describe("Recovery synchronization points", () => {
    it("should synchronize to semicolon", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("Identifier", "content"),
        createToken("Identifier", "extra1"),
        createToken("Identifier", "extra2"),
        createToken("Symbol", "Semicolon"), // Sync point
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"), // Missing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toEqual(tokens[1]);
        expect(result.value.after).toBeNull();
      }

      // Should have synchronized to semicolon
      const diagnostics = context.diagnostics.getAll();
      const syncDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.RECOVERED_AT &&
        d.message.includes("Skipped") &&
        d.message.includes("tokens")
      );
      expect(syncDiagnostics.length).toBe(1);
    });

    it("should synchronize to comma", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("Identifier", "content"),
        createToken("Identifier", "extra"),
        createToken("Symbol", "Comma"), // Sync point
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"), // Missing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      // Should have synchronized to comma
      const diagnostics = context.diagnostics.getAll();
      const syncDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.RECOVERED_AT
      );
      expect(syncDiagnostics.length).toBe(1);
    });

    it("should synchronize to newline", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("Identifier", "content"),
        createToken("Identifier", "extra"),
        createToken("Newline", "\n"), // Sync point
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"), // Missing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      // Should have synchronized to newline
      const diagnostics = context.diagnostics.getAll();
      const syncDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.RECOVERED_AT
      );
      expect(syncDiagnostics.length).toBe(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty input", () => {
      const tokens: Token[] = [];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("failure");
      if (result.type === "failure") {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("should handle end of input during parsing", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        // Unexpected end of input
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        true, // insertMissing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toEqual(tokens[0]);
        expect(result.value.content).toBeNull();
        expect(result.value.after).toBeNull();
      }

      // Should have inserted missing tokens
      const diagnostics = context.diagnostics.getAll();
      const insertedTokenDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN
      );
      expect(insertedTokenDiagnostics.length).toBe(1); // Only closing delimiter
    });
  });

  describe("Type safety", () => {
    it("should maintain correct types for nullable fields", () => {
      const tokens = [
        createToken("Symbol", "OpenParen"),
        createToken("IntegerLiteral", "123"), // Wrong type for content
        createToken("Symbol", "CloseParen"),
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        // TypeScript should infer the correct nullable types
        const { before, content, after } = result.value;

        expect(before?.kind).toBe("Symbol");
        expect(content).toBeNull(); // Failed to parse
        expect(after?.kind).toBe("Symbol");
      }
    });
  });

  describe("Recovery history tracking", () => {
    it("should track all recovery attempts in history", () => {
      const tokens = [
        createToken("Identifier", "content"), // Missing opening delimiter
        createToken("Identifier", "extra"), // Missing closing delimiter
      ];
      const context = createContext(tokens);

      const parser = recoverableDelimited(
        symbol("("),
        token("Identifier"),
        symbol(")"),
        true, // insertMissing
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");

      const recoveryHistory = context.getRecoveryHistory();
      const delimiterRecoveryEvents = recoveryHistory.filter((event) =>
        event.strategy === "DelimiterRecovery"
      );

      // Should have multiple recovery events for missing delimiters
      expect(delimiterRecoveryEvents.length).toBeGreaterThan(0);
    });
  });
});
