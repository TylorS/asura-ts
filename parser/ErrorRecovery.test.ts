import { describe, expect, it } from "vitest";
import { 
  ParseError, 
  ParseFailure, 
  RecoveredNode, 
  PartialNode,
  ErrorContext,
  ParsingContext,
  RecoveryAttempt,
  ParserContext
} from "./Parser.ts";
import { DiagnosticCode, DiagnosticSeverity, DiagnosticCollection } from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Identifier } from "../tokens/Token.ts";

describe("Error Recovery Infrastructure", () => {
  const testSpan = new Span(
    new SpanLocation(1, 1, 0),
    new SpanLocation(1, 5, 4)
  );

  describe("Enhanced ParseError", () => {
    it("should create ParseError with enhanced context information", () => {
      const context: ErrorContext = {
        parsingContexts: [{
          name: "function-declaration",
          expectedElements: ["identifier", "parameters"],
          recoveryStrategies: ["skip-to-semicolon"],
          metadata: { depth: 1 }
        }],
        position: 10,
        nearbyTokens: [],
        metadata: { phase: "parsing" }
      };

      const expectedTokens = ["identifier", "fun"];
      const recoveryAttempts: RecoveryAttempt[] = [{
        strategy: "skip-to-semicolon",
        success: false,
        tokensSkipped: 3,
        message: "Attempted to skip to semicolon"
      }];

      const error = ParseError.errorWithContext(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Expected identifier",
        testSpan,
        context,
        expectedTokens,
        null,
        [],
        []
      );

      expect(error.severity).toBe(DiagnosticSeverity.ERROR);
      expect(error.code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
      expect(error.message).toBe("Expected identifier");
      expect(error.parsingContext).toBe(context);
      expect(error.expectedTokens).toEqual(expectedTokens);
      expect(error.actualToken).toBe(null);
    });

    it("should preserve enhanced information when adding fixes", () => {
      const context: ErrorContext = {
        parsingContexts: [],
        position: 5,
        nearbyTokens: [],
        metadata: {}
      };

      const error = ParseError.errorWithContext(
        DiagnosticCode.MISSING_SEMICOLON,
        "Missing semicolon",
        testSpan,
        context,
        [";"]
      );

      const errorWithFix = error.addFix({
        kind: "insert",
        message: "Insert semicolon",
        span: testSpan,
        replacement: ";"
      });

      expect(errorWithFix.parsingContext).toBe(context);
      expect(errorWithFix.expectedTokens).toEqual([";"]);
      expect(errorWithFix.fixes).toHaveLength(1);
    });
  });

  describe("Enhanced ParseFailure", () => {
    it("should support partial results", () => {
      const partialResult = { name: "incomplete" };
      const error = ParseError.error(
        DiagnosticCode.PREMATURE_EOF,
        "Unexpected end of file",
        testSpan
      );

      const failure = new ParseFailure([error], partialResult);

      expect(failure.type).toBe("failure");
      expect(failure.errors).toHaveLength(1);
      expect(failure.partialResult).toBe(partialResult);
    });

    it("should work without partial results", () => {
      const error = ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "Unexpected token",
        testSpan
      );

      const failure = new ParseFailure([error]);

      expect(failure.type).toBe("failure");
      expect(failure.errors).toHaveLength(1);
      expect(failure.partialResult).toBeUndefined();
    });
  });

  describe("RecoveredNode", () => {
    it("should create RecoveredNode with recovery information", () => {
      const value = new Identifier("test", testSpan);
      const recoveryErrors = [
        ParseError.error(DiagnosticCode.SKIPPED_TOKENS, "Skipped tokens", testSpan)
      ];

      const recoveredNode = new RecoveredNode(value, recoveryErrors, testSpan);

      expect(recoveredNode.value).toBe(value);
      expect(recoveredNode.recoveryErrors).toBe(recoveryErrors);
      expect(recoveredNode.span).toBe(testSpan);
    });
  });

  describe("PartialNode", () => {
    it("should create PartialNode with partial completion information", () => {
      const completedFields = { name: "test" };
      const missingFields = ["parameters", "body"];
      const errors = [
        ParseError.error(DiagnosticCode.INCOMPLETE_FUNCTION, "Incomplete function", testSpan)
      ];

      const partialNode = new PartialNode(
        "FunctionDeclaration",
        completedFields,
        missingFields,
        errors,
        testSpan
      );

      expect(partialNode.nodeType).toBe("FunctionDeclaration");
      expect(partialNode.completedFields).toBe(completedFields);
      expect(partialNode.missingFields).toEqual(missingFields);
      expect(partialNode.errors).toBe(errors);
      expect(partialNode.span).toBe(testSpan);
    });
  });
});

describe("Enhanced Diagnostic Integration", () => {
  const testSpan = new Span(
    new SpanLocation(1, 1, 0),
    new SpanLocation(1, 5, 4)
  );

  it("should transfer enhanced information from ParseError to Diagnostic", () => {
    const diagnostics = new DiagnosticCollection();
    const context = new ParserContext("test.ts", [], diagnostics);

    const errorContext: ErrorContext = {
      parsingContexts: [{
        name: "expression",
        expectedElements: ["identifier"],
        recoveryStrategies: ["skip-to-operator"],
        metadata: {}
      }],
      position: 15,
      nearbyTokens: [],
      metadata: { phase: "expression-parsing" }
    };

    const parseError = ParseError.errorWithContext(
      DiagnosticCode.UNEXPECTED_TOKEN,
      "Expected identifier",
      testSpan,
      errorContext,
      ["identifier", "number"],
      null
    );

    const diagnostic = context.addFailure(parseError);

    expect(diagnostic.severity).toBe(DiagnosticSeverity.ERROR);
    expect(diagnostic.code).toBe(DiagnosticCode.UNEXPECTED_TOKEN);
    expect(diagnostic.message).toBe("Expected identifier");
    expect(diagnostic.fileName).toBe("test.ts");
    expect(diagnostic.parsingContext).toBe(errorContext);
    expect(diagnostic.expectedTokens).toEqual(["identifier", "number"]);
    expect(diagnostic.actualToken).toBe(null);
  });

  it("should preserve enhanced information when creating diagnostic fixes", () => {
    const diagnostics = new DiagnosticCollection();
    const context = new ParserContext("test.ts", [], diagnostics);

    const errorContext: ErrorContext = {
      parsingContexts: [],
      position: 20,
      nearbyTokens: [],
      metadata: {}
    };

    const parseError = ParseError.errorWithContext(
      DiagnosticCode.MISSING_SEMICOLON,
      "Missing semicolon",
      testSpan,
      errorContext,
      [";"]
    );

    const diagnostic = context.addFailure(parseError);
    const diagnosticWithFix = diagnostic.withFix("Insert semicolon", ";");

    expect(diagnosticWithFix.parsingContext).toBe(errorContext);
    expect(diagnosticWithFix.expectedTokens).toEqual([";"]);
    expect(diagnosticWithFix.fixes).toHaveLength(1);
    expect(diagnosticWithFix.fixes[0].message).toBe("Insert semicolon");
  });
});
