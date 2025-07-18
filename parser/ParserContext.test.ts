import { describe, expect, it } from "vitest";
import { DiagnosticCollection, DiagnosticCode, DiagnosticSeverity } from "../diagnostics/mod.ts";
import { formatDiagnostics } from "../diagnostics/DiagnosticFormatter.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Token } from "../tokens/Token.ts";
import { ParserContext, ParseError, ParsingContext } from "./Parser.ts";

// Helper function to create a simple token
function createToken(kind: Token["kind"], text: string = "", line: number = 1, column: number = 1): Token {
  const span = new Span(
    new SpanLocation(line, column, 0),
    new SpanLocation(line, column + text.length, text.length)
  );
  
  if (kind === "Identifier") {
    return { kind, text, span } as Token;
  }
  
  return { kind, span } as Token;
}

describe("ParserContext Extensions", () => {
  describe("Context stack management", () => {
    it("should manage parsing context stack correctly", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [createToken("Identifier", "test")];
      const context = new ParserContext("test.ts", tokens, diagnostics);

      // Test initial state
      expect(context.getCurrentContext()).toBeNull();
      expect(context.getContextStack()).toHaveLength(0);

      // Test pushing context
      const parsingContext: ParsingContext = {
        name: "function-declaration",
        expectedElements: ["identifier", "parameters"],
        recoveryStrategies: ["StatementBoundary"],
        metadata: { type: "declaration" }
      };

      context.pushParsingContext(parsingContext);
      expect(context.getCurrentContext()).toBe(parsingContext);
      expect(context.getContextStack()).toHaveLength(1);

      // Test pushing another context
      const nestedContext: ParsingContext = {
        name: "parameter-list",
        expectedElements: ["parameter", "comma"],
        recoveryStrategies: ["DelimiterRecovery"],
        metadata: { nested: true }
      };

      context.pushParsingContext(nestedContext);
      expect(context.getCurrentContext()).toBe(nestedContext);
      expect(context.getContextStack()).toHaveLength(2);

      // Test popping context
      const popped = context.popParsingContext();
      expect(popped).toBe(nestedContext);
      expect(context.getCurrentContext()).toBe(parsingContext);
      expect(context.getContextStack()).toHaveLength(1);

      // Test popping last context
      const lastPopped = context.popParsingContext();
      expect(lastPopped).toBe(parsingContext);
      expect(context.getCurrentContext()).toBeNull();
      expect(context.getContextStack()).toHaveLength(0);

      // Test popping from empty stack
      const emptyPop = context.popParsingContext();
      expect(emptyPop).toBeNull();
    });
  });

  describe("Recovery point management", () => {
    it("should manage recovery points correctly", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [
        createToken("Identifier", "test1"),
        createToken("Identifier", "test2"),
        createToken("Identifier", "test3")
      ];
      const context = new ParserContext("test.ts", tokens, diagnostics);

      // Test marking recovery point at start
      const point1 = context.markRecoveryPoint();
      expect(point1.position).toBe(0);
      expect(point1.diagnosticCount).toBe(0);
      expect(point1.timestamp).toBeGreaterThan(0);

      // Advance position and add diagnostic
      context.consume();
      const error = ParseError.error(DiagnosticCode.UNEXPECTED_TOKEN, "test error", tokens[0].span);
      context.addFailure(error);

      // Mark another recovery point
      const point2 = context.markRecoveryPoint();
      expect(point2.position).toBe(1);
      expect(point2.diagnosticCount).toBe(1);

      // Advance further
      context.consume();
      expect(context.getPosition()).toBe(2);

      // Restore to first recovery point
      context.restoreToRecoveryPoint(point1);
      expect(context.getPosition()).toBe(0);
      // Note: diagnostics are preserved, so count should still be 1
      expect(diagnostics.getAll()).toHaveLength(1);

      // Restore to second recovery point
      context.restoreToRecoveryPoint(point2);
      expect(context.getPosition()).toBe(1);
    });
  });

  describe("Synchronization", () => {
    it("should skip to synchronization point correctly", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [
        createToken("Identifier", "test1"),
        createToken("Identifier", "test2"),
        createToken("Identifier", "semicolon"), // Pretend this is a semicolon
        createToken("Identifier", "test3")
      ];
      const context = new ParserContext("test.ts", tokens, diagnostics);

      // Test synchronization to semicolon-like token
      const syncPredicate = (token: Token) => {
        return token.kind === "Identifier" && (token as any).text === "semicolon";
      };

      context.skipToSynchronizationPoint(syncPredicate);
      expect(context.getPosition()).toBe(2); // Should stop at the "semicolon" token
    });

    it("should handle synchronization when predicate is never satisfied", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [
        createToken("Identifier", "test1"),
        createToken("Identifier", "test2"),
        createToken("Identifier", "test3")
      ];
      const context = new ParserContext("test.ts", tokens, diagnostics);

      const neverSatisfied = () => false;
      context.skipToSynchronizationPoint(neverSatisfied);
      expect(context.getPosition()).toBe(tokens.length); // Should reach end
    });
  });

  describe("Virtual token insertion", () => {
    it("should record virtual token insertion", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [createToken("Identifier", "test")];
      const context = new ParserContext("test.ts", tokens, diagnostics);

      const span = new Span(
        new SpanLocation(1, 1, 0),
        new SpanLocation(1, 2, 1)
      );

      // Test virtual token insertion
      context.insertVirtualToken("CloseParen", span);

      // Should have added a diagnostic
      expect(diagnostics.getAll()).toHaveLength(1);
      const diagnostic = diagnostics.getAll()[0];
      expect(diagnostic.code).toBe(DiagnosticCode.INSERTED_TOKEN);
      expect(diagnostic.message).toBe("Inserted virtual CloseParen");

      // Should have added to recovery history
      const history = context.getRecoveryHistory();
      expect(history).toHaveLength(1);
      expect(history[0].strategy).toBe("VirtualTokenInsertion");
      expect(history[0].message).toBe("Inserted virtual CloseParen");
    });
  });

  describe("Enhanced error reporting", () => {
    it("should add recovery errors with history tracking", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [createToken("Identifier", "test")];
      const context = new ParserContext("test.ts", tokens, diagnostics);

      const error = ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Test recovery error",
        tokens[0].span
      );

      // Test adding recovery error
      context.addRecoveryError(error, "TestStrategy");

      // Should have added diagnostic
      expect(diagnostics.getAll()).toHaveLength(1);
      const diagnostic = diagnostics.getAll()[0];
      expect(diagnostic.message).toBe("Test recovery error");

      // Should have added to recovery history
      const history = context.getRecoveryHistory();
      expect(history).toHaveLength(1);
      expect(history[0].strategy).toBe("TestStrategy");
      expect(history[0].success).toBe(true);
      expect(history[0].message).toBe("Test recovery error");
      expect(history[0].position).toBe(0);
    });
  });

  describe("Enhanced addFailure method", () => {
    it("should transfer enhanced information from ParseError to Diagnostic", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [createToken("Identifier", "test")];
      const context = new ParserContext("test.ts", tokens, diagnostics);

      // Create enhanced ParseError with context information
      const errorContext = {
        parsingContexts: [{
          name: "test-context",
          expectedElements: ["identifier"],
          recoveryStrategies: ["sync"],
          metadata: {}
        }],
        position: 0,
        nearbyTokens: tokens,
        metadata: { test: true }
      };

      const recoveryAttempts = [{
        strategy: "TestRecovery",
        success: false,
        tokensSkipped: 2,
        message: "Recovery failed"
      }];

      const enhancedError = new ParseError(
        DiagnosticSeverity.ERROR,
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Enhanced error",
        tokens[0].span,
        [], // fixes
        [], // related info
        errorContext,
        ["identifier", "keyword"], // expected tokens
        tokens[0], // actual token
        ["parser1", "parser2"], // parser stack
        recoveryAttempts
      );

      // Test that addFailure transfers enhanced information
      const diagnostic = context.addFailure(enhancedError);

      expect(diagnostic.parsingContext).toBe(errorContext);
      expect(diagnostic.expectedTokens).toEqual(["identifier", "keyword"]);
      expect(diagnostic.actualToken).toBe(tokens[0]);
      expect(diagnostic.parserStack).toEqual(["parser1", "parser2"]);
      expect(diagnostic.recoveryAttempts).toBe(recoveryAttempts);
    });
  });

  describe("Diagnostic formatting snapshots", () => {
    it("should format basic error diagnostic", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [createToken("Identifier", "myVar", 1, 5)];
      const context = new ParserContext("example.ts", tokens, diagnostics);

      const error = ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Expected semicolon after variable declaration",
        tokens[0].span
      );

      context.addFailure(error);

      const source = "let myVar = 42";
      const formatted = formatDiagnostics(diagnostics.getAll(), source);
      
      expect(formatted).toMatchSnapshot();
    });

    it("should format virtual token insertion diagnostic", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [createToken("Identifier", "func", 1, 0)];
      const context = new ParserContext("example.ts", tokens, diagnostics);

      const span = new Span(
        new SpanLocation(1, 10, 10),
        new SpanLocation(1, 10, 10)
      );

      context.insertVirtualToken("CloseParen", span);

      const source = "function() { return 42; }";
      const formatted = formatDiagnostics(diagnostics.getAll(), source);
      
      expect(formatted).toMatchSnapshot();
    });

    it("should format enhanced error with context information", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [
        createToken("Identifier", "function", 1, 0),
        createToken("Identifier", "myFunc", 1, 9),
        createToken("Identifier", "param", 1, 16)
      ];
      const context = new ParserContext("example.ts", tokens, diagnostics);

      // Create enhanced ParseError with rich context
      const errorContext = {
        parsingContexts: [{
          name: "function-declaration",
          expectedElements: ["identifier", "parameter-list", "function-body"],
          recoveryStrategies: ["StatementBoundary", "DelimiterRecovery"],
          metadata: { functionName: "myFunc" }
        }],
        position: 2,
        nearbyTokens: tokens,
        metadata: { 
          parsingPhase: "parameter-list",
          expectedDelimiter: ")"
        }
      };

      const recoveryAttempts = [
        {
          strategy: "DelimiterRecovery",
          success: false,
          tokensSkipped: 1,
          message: "Attempted to find closing parenthesis"
        },
        {
          strategy: "StatementBoundary",
          success: true,
          tokensSkipped: 0,
          message: "Synchronized at statement boundary"
        }
      ];

      const enhancedError = new ParseError(
        DiagnosticSeverity.ERROR,
        DiagnosticCode.UNCLOSED_DELIMITER,
        "Missing closing parenthesis in function parameter list",
        new Span(
          new SpanLocation(1, 16, 16),
          new SpanLocation(1, 21, 21)
        ),
        [
          {
            kind: "insert",
            message: "Insert closing parenthesis",
            span: new Span(
              new SpanLocation(1, 21, 21),
              new SpanLocation(1, 21, 21)
            ),
            replacement: ")"
          }
        ],
        [
          {
            message: "Function declaration started here",
            span: new Span(
              new SpanLocation(1, 0, 0),
              new SpanLocation(1, 8, 8)
            ),
            fileName: "example.ts"
          }
        ],
        errorContext,
        [")", "comma", "parameter"], // expected tokens
        tokens[2], // actual token
        ["parseFunction", "parseParameterList", "parseParameter"], // parser stack
        recoveryAttempts
      );

      context.addFailure(enhancedError);

      const source = "function myFunc(param { return 42; }";
      const formatted = formatDiagnostics(diagnostics.getAll(), source);
      
      expect(formatted).toMatchSnapshot();
    });

    it("should format multiple recovery errors with history", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [
        createToken("Identifier", "if", 1, 0),
        createToken("Identifier", "condition", 1, 3),
        createToken("Identifier", "statement", 2, 2)
      ];
      const context = new ParserContext("example.ts", tokens, diagnostics);

      // Add multiple recovery errors
      const error1 = ParseError.error(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected opening parenthesis after 'if'",
        new Span(new SpanLocation(1, 2, 2), new SpanLocation(1, 3, 3))
      );
      context.addRecoveryError(error1, "DelimiterRecovery");

      const error2 = ParseError.warning(
        DiagnosticCode.INSERTED_TOKEN,
        "Inserted missing opening parenthesis",
        new Span(new SpanLocation(1, 3, 3), new SpanLocation(1, 3, 3))
      );
      context.addRecoveryError(error2, "VirtualTokenInsertion");

      const error3 = ParseError.error(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected closing parenthesis after condition",
        new Span(new SpanLocation(1, 12, 12), new SpanLocation(1, 12, 12))
      );
      context.addRecoveryError(error3, "DelimiterRecovery");

      const source = "if condition\n  statement;";
      const formatted = formatDiagnostics(diagnostics.getAll(), source);
      
      expect(formatted).toMatchSnapshot();

      // Also test recovery history
      const history = context.getRecoveryHistory();
      expect(history).toHaveLength(3);
      expect(history.map(h => h.strategy)).toEqual([
        "DelimiterRecovery",
        "VirtualTokenInsertion", 
        "DelimiterRecovery"
      ]);
    });

    it("should format synchronization recovery scenario", () => {
      const diagnostics = new DiagnosticCollection();
      const tokens: Token[] = [
        createToken("Identifier", "function", 1, 0),
        createToken("Identifier", "broken", 1, 9),
        createToken("Identifier", "syntax", 1, 16),
        createToken("Identifier", "here", 1, 23),
        createToken("Identifier", "function", 2, 0),
        createToken("Identifier", "valid", 2, 9)
      ];
      const context = new ParserContext("example.ts", tokens, diagnostics);

      // Simulate a parsing error that requires synchronization
      const parseError = ParseError.error(
        DiagnosticCode.INVALID_SYNTAX,
        "Invalid function declaration syntax",
        new Span(new SpanLocation(1, 16, 16), new SpanLocation(1, 28, 28))
      );
      context.addRecoveryError(parseError, "SyntaxError");

      // Simulate skipping to synchronization point
      const syncPredicate = (token: Token) => {
        return token.kind === "Identifier" && (token as any).text === "function";
      };
      
      // Skip to the next function declaration
      context.setPosition(1); // Start after first function token
      context.skipToSynchronizationPoint(syncPredicate);
      
      // Add recovery success message
      const recoveryInfo = ParseError.info(
        DiagnosticCode.RECOVERED_AT,
        "Recovered parsing at next function declaration",
        new Span(new SpanLocation(2, 0, 0), new SpanLocation(2, 8, 8))
      );
      context.addRecoveryError(recoveryInfo, "StatementBoundary");

      const source = "function broken syntax here\nfunction valid() { return 42; }";
      const formatted = formatDiagnostics(diagnostics.getAll(), source);
      
      expect(formatted).toMatchSnapshot();
    });
  });
});