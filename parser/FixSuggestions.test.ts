import { describe, it, expect } from "vitest";
import { Token, Symbol, Identifier } from "../tokens/Token.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { DiagnosticCode, DiagnosticCollection } from "../diagnostics/mod.ts";
import { ParserContext } from "./Parser.ts";
import { FixSuggestionEngine, EnhancedErrorFactory } from "./FixSuggestions.ts";

// Helper function to create a test span
function createSpan(line: number, col: number): Span {
  const start = new SpanLocation(line, col, 0);
  const end = new SpanLocation(line, col + 1, 1);
  return new Span(start, end);
}

// Helper function to create a symbol token
function createSymbol(symbol: string, line: number = 1, col: number = 1): Symbol {
  const span = createSpan(line, col);
  const token = new Symbol(symbol as any, span);
  // Ensure the span is properly set
  (token as any).span = span;
  return token;
}

// Helper function to create an identifier token
function createIdentifier(text: string, line: number = 1, col: number = 1): Identifier {
  return new Identifier(text, createSpan(line, col));
}

// Helper function to create a parser context
function createContext(tokens: Token[]): ParserContext {
  return new ParserContext("test.lang", tokens, new DiagnosticCollection());
}

describe("FixSuggestionEngine", () => {
  describe("suggestMissingDelimiter", () => {
    it("should suggest inserting missing closing parenthesis", () => {
      const tokens = [
        createSymbol("OpenParen"),
        createIdentifier("test"),
      ];
      const context = createContext(tokens);
      context.setPosition(2); // At end after "test"

      const fixes = FixSuggestionEngine.suggestMissingDelimiter(
        context,
        "CloseParen",
        createSpan(1, 5),
        { token: tokens[0], position: 0 }
      );

      expect(fixes).toHaveLength(1);
      expect(fixes[0].kind).toBe("insert");
      expect(fixes[0].message).toContain("Insert missing ')'");
      expect(fixes[0].message).toContain("match '(' at line 1");
      expect(fixes[0].replacement).toBe(")");
    });

    it("should suggest inserting missing closing brace", () => {
      const tokens = [
        createSymbol("OpenBrace"),
        createIdentifier("content"),
      ];
      const context = createContext(tokens);
      context.setPosition(2);

      const fixes = FixSuggestionEngine.suggestMissingDelimiter(
        context,
        "CloseBrace",
        createSpan(1, 8),
        { token: tokens[0], position: 0 }
      );

      expect(fixes).toHaveLength(1);
      expect(fixes[0].kind).toBe("insert");
      expect(fixes[0].message).toContain("Insert missing '}'");
      expect(fixes[0].replacement).toBe("}");
    });

    it("should suggest inserting delimiter without opening context", () => {
      const tokens = [createIdentifier("test")];
      const context = createContext(tokens);
      context.setPosition(1);

      const fixes = FixSuggestionEngine.suggestMissingDelimiter(
        context,
        "CloseParen",
        createSpan(1, 5)
      );

      expect(fixes).toHaveLength(1);
      expect(fixes[0].kind).toBe("insert");
      expect(fixes[0].message).toBe("Insert missing ')'");
      expect(fixes[0].replacement).toBe(")");
    });
  });

  describe("suggestUnmatchedDelimiter", () => {
    it("should suggest replacing unmatched delimiter", () => {
      const unmatchedToken = createSymbol("CloseBrace", 1, 5);
      const context = createContext([unmatchedToken]);

      const fixes = FixSuggestionEngine.suggestUnmatchedDelimiter(
        context,
        unmatchedToken,
        "CloseParen"
      );

      expect(fixes.length).toBeGreaterThan(0);
      
      const replaceFix = fixes.find(f => f.kind === "replace");
      expect(replaceFix).toBeDefined();
      expect(replaceFix!.message).toContain("Replace '}' with expected ')'");
      expect(replaceFix!.replacement).toBe(")");

      const insertFix = fixes.find(f => f.kind === "insert");
      expect(insertFix).toBeDefined();
      expect(insertFix!.message).toContain("Insert ')' before '}'");
    });

    it("should suggest removing unmatched delimiter", () => {
      const unmatchedToken = createSymbol("CloseParen", 1, 5);
      const context = createContext([unmatchedToken]);

      const fixes = FixSuggestionEngine.suggestUnmatchedDelimiter(
        context,
        unmatchedToken
      );

      const deleteFix = fixes.find(f => f.kind === "delete");
      expect(deleteFix).toBeDefined();
      expect(deleteFix!.message).toContain("Remove unmatched ')'");
      expect(deleteFix!.replacement).toBe("");
    });
  });

  describe("suggestValidIdentifier", () => {
    it("should suggest alternatives for keyword used as identifier", () => {
      const keywordToken = createIdentifier("fun", 1, 1);
      const context = createContext([keywordToken]);

      const fixes = FixSuggestionEngine.suggestValidIdentifier(
        context,
        keywordToken,
        "variable"
      );

      expect(fixes.length).toBeGreaterThan(0);
      
      // Should suggest alternatives
      const alternativeFix = fixes.find(f => f.message.includes("func"));
      expect(alternativeFix).toBeDefined();
      expect(alternativeFix!.kind).toBe("replace");

      // Should suggest escaping
      const escapeFix = fixes.find(f => f.message.includes("backticks"));
      expect(escapeFix).toBeDefined();
      expect(escapeFix!.replacement).toBe("`fun`");
    });

    it("should suggest fixing invalid characters", () => {
      const invalidToken = createIdentifier("test-name", 1, 1);
      const context = createContext([invalidToken]);

      const fixes = FixSuggestionEngine.suggestValidIdentifier(
        context,
        invalidToken
      );

      const cleanFix = fixes.find(f => f.message.includes("invalid characters"));
      expect(cleanFix).toBeDefined();
      expect(cleanFix!.kind).toBe("replace");
      expect(cleanFix!.replacement).toBe("test_name");
    });

    it("should suggest fixing identifier starting with number", () => {
      const invalidToken = createIdentifier("123test", 1, 1);
      const context = createContext([invalidToken]);

      const fixes = FixSuggestionEngine.suggestValidIdentifier(
        context,
        invalidToken
      );

      const underscoreFix = fixes.find(f => f.message.includes("underscore"));
      expect(underscoreFix).toBeDefined();
      expect(underscoreFix!.replacement).toBe("_123test");

      const letterFix = fixes.find(f => f.message.includes("letter"));
      expect(letterFix).toBeDefined();
      expect(letterFix!.replacement).toBe("id123test");
    });

    it("should provide context-specific suggestions", () => {
      const token = createIdentifier("test", 1, 1);
      const context = createContext([token]);

      const fixes = FixSuggestionEngine.suggestValidIdentifier(
        context,
        token,
        "function"
      );

      const contextFix = fixes.find(f => f.message.includes("function-appropriate"));
      expect(contextFix).toBeDefined();
      expect(contextFix!.replacement).toMatch(/testFn|handleTest|processTest/);
    });
  });

  describe("suggestCorrectKeywordUsage", () => {
    it("should suggest correct usage example", () => {
      const context = createContext([]);
      
      const fixes = FixSuggestionEngine.suggestCorrectKeywordUsage(
        context,
        "fun",
        "expression",
        "declaration"
      );

      const usageFix = fixes.find(f => f.message.includes("Correct usage"));
      expect(usageFix).toBeDefined();
      expect(usageFix!.message).toContain("fun functionName(params)");
    });

    it("should suggest alternative keywords", () => {
      const context = createContext([]);
      
      const fixes = FixSuggestionEngine.suggestCorrectKeywordUsage(
        context,
        "fun",
        "statement"
      );

      const alternativeFix = fixes.find(f => f.message.includes("Use"));
      expect(alternativeFix).toBeDefined();
    });
  });
});

describe("EnhancedErrorFactory", () => {
  describe("missingDelimiter", () => {
    it("should create error with intelligent fix suggestions", () => {
      const tokens = [
        createSymbol("OpenParen"),
        createIdentifier("test"),
      ];
      const context = createContext(tokens);
      context.setPosition(2);

      const error = EnhancedErrorFactory.missingDelimiter(
        context,
        "CloseParen",
        { token: tokens[0], position: 0 }
      );

      expect(error.code).toBe(DiagnosticCode.UNCLOSED_DELIMITER);
      expect(error.message).toContain("Missing ')'");
      expect(error.message).toContain("match '(' at line 1");
      expect(error.fixes.length).toBeGreaterThan(0);
      
      const fix = error.fixes[0];
      expect(fix.kind).toBe("insert");
      expect(fix.replacement).toBe(")");
    });
  });

  describe("unmatchedDelimiter", () => {
    it("should create error with fix suggestions for unmatched delimiter", () => {
      const unmatchedToken = createSymbol("CloseBrace", 1, 5);
      const context = createContext([unmatchedToken]);

      const error = EnhancedErrorFactory.unmatchedDelimiter(
        context,
        unmatchedToken,
        "CloseParen"
      );

      expect(error.code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
      expect(error.message).toContain("Unexpected '}'");
      expect(error.message).toContain("expected ')'");
      expect(error.fixes.length).toBeGreaterThan(0);
    });
  });

  describe("invalidIdentifier", () => {
    it("should create error with fix suggestions for invalid identifier", () => {
      const invalidToken = createIdentifier("123invalid", 1, 1);
      const context = createContext([invalidToken]);

      const error = EnhancedErrorFactory.invalidIdentifier(
        context,
        invalidToken,
        "variable"
      );

      expect(error.code).toBe(DiagnosticCode.INVALID_SYNTAX);
      expect(error.message).toContain("Invalid identifier '123invalid'");
      expect(error.message).toContain("variable context");
      expect(error.fixes.length).toBeGreaterThan(0);
    });
  });

  describe("wrongKeywordContext", () => {
    it("should create error with fix suggestions for wrong keyword context", () => {
      const context = createContext([]);

      const error = EnhancedErrorFactory.wrongKeywordContext(
        context,
        "fun",
        "expression",
        "declaration"
      );

      expect(error.code).toBe(DiagnosticCode.INVALID_SYNTAX);
      expect(error.message).toContain("Keyword 'fun' cannot be used in expression");
      expect(error.message).toContain("expected declaration");
      expect(error.fixes.length).toBeGreaterThan(0);
    });
  });
});

describe("Integration with Error Recovery", () => {
  it("should integrate fix suggestions with delimiter recovery", () => {
    const tokens = [
      createSymbol("OpenParen"),
      createIdentifier("test"),
      // Missing CloseParen
    ];
    const context = createContext(tokens);
    context.setPosition(2);

    // Simulate what DelimiterRecovery would do
    const error = EnhancedErrorFactory.missingDelimiter(
      context,
      "CloseParen",
      { token: tokens[0], position: 0 }
    );

    context.addRecoveryError(error, "DelimiterRecovery");

    const diagnostics = context.diagnostics.getAll();
    expect(diagnostics).toHaveLength(1);
    
    const diagnostic = diagnostics[0];
    expect(diagnostic.fixes.length).toBeGreaterThan(0);
    expect(diagnostic.fixes[0].replacement).toBe(")");
  });

  it("should integrate fix suggestions with keyword recovery", () => {
    const context = createContext([]);
    context.pushParsingContext({
      name: "expression",
      expectedElements: ["identifier", "literal"],
      recoveryStrategies: ["KeywordRecovery"],
      metadata: {},
    });

    const error = EnhancedErrorFactory.wrongKeywordContext(
      context,
      "fun",
      "expression",
      "declaration"
    );

    context.addRecoveryError(error, "KeywordRecovery");

    const diagnostics = context.diagnostics.getAll();
    expect(diagnostics).toHaveLength(1);
    
    const diagnostic = diagnostics[0];
    expect(diagnostic.fixes.length).toBeGreaterThan(0);
  });
});