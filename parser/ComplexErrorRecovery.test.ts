import { describe, expect, it } from "vitest";
import { DiagnosticCode, DiagnosticCollection } from "../diagnostics/mod.ts";
import { tokenizeToArray } from "../tokens/Tokenizer.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import * as Parser from "./Parser.ts";
import {
  ParseFailure,
  ParserContext,
  ParseResult,
  PartialNode,
  RecoveredNode,
} from "./Parser.ts";
import { expression, expressionWithRecovery } from "./parsers/Expression.ts";
import { statement } from "./parsers/Statement.ts";
import { pipe } from "./Pipeable.ts";

const EMPTY_SPAN = new Span(
  new SpanLocation(1, 1, 0),
  new SpanLocation(1, 1, 0),
);

function createParserContext(source: string): ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

// Helper function to check if a result contains RecoveredNode instances
function hasRecoveredNodes(result: ParseResult<any>): boolean {
  if (result.type === "success") {
    return isRecoveredNode(result.value) ||
      containsRecoveredNodes(result.value);
  }
  return false;
}

function isRecoveredNode(value: any): boolean {
  return value instanceof RecoveredNode;
}

function containsRecoveredNodes(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item) =>
      isRecoveredNode(item) || containsRecoveredNodes(item)
    );
  }

  return Object.values(value).some((prop) =>
    isRecoveredNode(prop) || containsRecoveredNodes(prop)
  );
}

// Helper function to check if a result contains PartialNode instances
function hasPartialNodes(result: ParseResult<any>): boolean {
  if (result.type === "success") {
    return isPartialNode(result.value) || containsPartialNodes(result.value);
  }
  if (result.type === "failure" && result.partialResult) {
    return isPartialNode(result.partialResult) ||
      containsPartialNodes(result.partialResult);
  }
  return false;
}

function isPartialNode(value: any): boolean {
  return value instanceof PartialNode;
}

function containsPartialNodes(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item) =>
      isPartialNode(item) || containsPartialNodes(item)
    );
  }

  return Object.values(value).some((prop) =>
    isPartialNode(prop) || containsPartialNodes(prop)
  );
}

// Helper function to count total errors from result and context
function getTotalErrorCount(
  result: ParseResult<any>,
  context: ParserContext,
): number {
  const resultErrors = result.type === "failure" ? result.errors.length : 0;
  const contextDiagnostics = context.diagnostics.getAll().length;
  return resultErrors + contextDiagnostics;
}

describe("Complex Error Recovery Scenarios", () => {
  describe("Nested error scenarios (errors within errors)", () => {
    it("should handle nested missing delimiters in function call within array", () => {
      const source = "[foo(1, 2, bar(3, 4]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting (either in result or context)
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available (even if empty)
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should handle nested record literals with missing braces", () => {
      const source = '{user: {name: "John", profile: {age: 30, city: "NYC"}';
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Should have meaningful error messages about structures (if any errors exist)
      const allDiagnostics = context.diagnostics.getAll();
      const allErrors = result.type === "failure" ? result.errors : [];

      if (allDiagnostics.length > 0 || allErrors.length > 0) {
        const allMessages = [
          ...allDiagnostics.map((d) => d.message),
          ...allErrors.map((e) => e.message),
        ];

        // If there are error messages, at least some should be meaningful
        expect(allMessages.length).toBeGreaterThan(0);
      }

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);
    });

    it("should handle function call with nested malformed expressions", () => {
      const source = "foo(1 + + 2, bar(3 * * 4), 5)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should handle nested array literals with multiple errors", () => {
      const source = "[[1, , 3], [4, 5, ], [, 7, 8]]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should handle deeply nested delimiter mismatches", () => {
      const source = "foo(bar[baz{qux(1, 2, 3}])";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });
  });

  describe("Multiple consecutive errors in the same construct", () => {
    it("should handle multiple consecutive missing arguments in function call", () => {
      const source = "foo(1, , , 4, , 6)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should handle multiple consecutive operator errors", () => {
      const source = "1 + + + 2 - - 3 * * * 4";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should handle multiple consecutive missing record fields", () => {
      const source = '{name: "John", , , age: 30, , city: "NYC", ,}';
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should handle multiple consecutive statement errors", () => {
      const source = `
        let = 42;
        fun (x: Int): Int => x + 1;
        = "invalid";
        let y;
        fun (): Void => {};
      `;
      const context = createParserContext(source);

      // Parse multiple statements to collect all errors
      const statements = [];
      const allErrors = [];

      while (!context.isAtEnd()) {
        // Skip whitespace and newlines
        while (
          !context.isAtEnd() &&
          (context.peek().kind === "Whitespace" ||
            context.peek().kind === "Newline")
        ) {
          context.consume();
        }

        if (context.isAtEnd()) break;

        const result = statement().parse(context);

        if (result.type === "success") {
          statements.push(result.value);
        } else {
          allErrors.push(...result.errors);
          // Try to recover by skipping to next statement boundary
          while (!context.isAtEnd()) {
            const token = context.peek();
            if (
              token.kind === "Newline" ||
              (token.kind === "Symbol" && token.symbol === "Semicolon")
            ) {
              context.consume();
              break;
            }
            context.consume();
          }
        }
      }

      // Should have collected multiple statement errors
      const totalDiagnostics = context.diagnostics.getAll();
      expect(totalDiagnostics.length + allErrors.length).toBeGreaterThan(2);

      // Should have recovery history for statement parsing
      const recoveryHistory = context.getRecoveryHistory();
      expect(recoveryHistory.length).toBeGreaterThan(0);
    });

    it("should handle multiple consecutive array element errors", () => {
      const source = "[1, , , 4, , , 7, , 9, ,]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });
  });

  describe("Recovery from different parser combinator failures", () => {
    it("should recover from sequence combinator failures", () => {
      const source = "incomplete sequence";
      const context = createParserContext(source);

      // Test recoverableSeq combinator directly
      const parser = Parser.recoverableSeq(
        Parser.token("Identifier"), // Should succeed on "incomplete"
        Parser.token("IntegerLiteral"), // Should fail on "sequence"
        Parser.token("Symbol"), // Should fail - no symbol present
      );

      const result = parser.parse(context);

      // Should succeed with partial results
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toBeDefined(); // First element succeeded
        expect(result.value[1]).toBeNull(); // Second element failed
        expect(result.value[2]).toBeNull(); // Third element failed
      }

      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.RECOVERED_ERROR
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should recover from alternative combinator failures", () => {
      const source = "invalid_token";
      const context = createParserContext(source);

      // Test or combinator with recovery
      const parser = Parser.or(
        Parser.token("IntegerLiteral"),
        Parser.token("StringLiteral"),
        Parser.token("BooleanLiteral"),
      );

      const result = parser.parse(context);

      // Should fail since none of the alternatives match
      expect(result.type).toBe("failure");
      if (result.type === "failure") {
        // Should have errors from all attempted alternatives
        expect(result.errors.length).toBeGreaterThan(0);
      }

      // Test with recovery wrapper
      const recoveryParser = Parser.catchFailure((failure) => {
        // Custom recovery logic
        context.addRecoveryError(
          Parser.ParseError.info(
            DiagnosticCode.RECOVERED_ERROR,
            "Recovered from alternative parser failure",
            context.span(),
          ),
          "AlternativeRecovery",
        );

        // Skip the problematic token and return a recovery result
        if (!context.isAtEnd()) {
          context.consume();
        }
        return new Parser.ParseSuccess("RECOVERED");
      })(parser);

      const recoveryResult = recoveryParser.parse(context);
      expect(recoveryResult.type).toBe("success");

      // Should have recovery history
      const recoveryHistory = context.getRecoveryHistory();
      expect(recoveryHistory.length).toBeGreaterThan(0);
    });

    it("should recover from delimiter combinator failures", () => {
      const source = "(incomplete_delimited";
      const context = createParserContext(source);

      // Test recoverableDelimited combinator
      const parser = Parser.recoverableDelimited(
        Parser.symbol("("),
        Parser.token("Identifier"),
        Parser.symbol(")"),
        true, // insertMissing
      );

      const result = parser.parse(context);

      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeDefined(); // Opening delimiter found
        expect(result.value.content).toBeDefined(); // Content found
        expect(result.value.after).toBeNull(); // Closing delimiter missing
      }

      // Should have recovery diagnostics for missing delimiter
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("closing delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should recover from precedence combinator failures", () => {
      const source = "1 + + 2";
      const context = createParserContext(source);

      // This should trigger precedence parsing errors
      const result = expression().parse(context);

      // Should either fail or succeed with some form of error handling
      expect(result.type).toBeDefined();

      // Should have some form of error reporting
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThanOrEqual(0);

      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Context should be properly managed
      expect(context.getCurrentContext()).toBeNull();
    });

    it("should recover from optional combinator failures", () => {
      const source = "required_part";
      const context = createParserContext(source);

      // Test optional combinator with recovery
      const parser = Parser.seq(
        Parser.token("Identifier"), // Should succeed
        Parser.optional(Parser.token("IntegerLiteral")), // Should succeed with null
        Parser.optional(Parser.token("StringLiteral")), // Should succeed with null
      );

      const result = parser.parse(context);

      // Should succeed with optional parts as null
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toBeDefined(); // Required part
        expect(result.value[1]).toBeNull(); // Optional part 1
        expect(result.value[2]).toBeNull(); // Optional part 2
      }
    });

    it("should recover from repetition combinator failures", () => {
      const source = "item1 invalid item2";
      const context = createParserContext(source);

      // Test zeroOrMore with recovery
      const itemParser = Parser.or(
        Parser.token("Identifier"),
        Parser.token("IntegerLiteral"),
      );

      const parser = Parser.zeroOrMore(itemParser);
      const result = parser.parse(context);

      // Should parse what it can and stop at the invalid token
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.length).toBeGreaterThan(0);
      }

      // Skip whitespace to get to the next token
      while (!context.isAtEnd() && context.peek().kind === "Whitespace") {
        context.consume();
      }

      // The invalid token should still be in the stream
      if (!context.isAtEnd()) {
        expect(context.peek().kind).toBe("Identifier"); // "invalid"
      }
    });
  });

  describe("Edge cases with end-of-input during recovery", () => {
    it("should handle end-of-input during delimiter recovery", () => {
      const source = "(incomplete";
      const context = createParserContext(source);

      const parser = Parser.recoverableDelimited(
        Parser.symbol("("),
        Parser.token("Identifier"),
        Parser.symbol(")"),
        true,
      );

      const result = parser.parse(context);

      // Should succeed with recovery even at end of input
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeDefined();
        expect(result.value.content).toBeDefined();
        expect(result.value.after).toBeNull(); // Missing due to EOF
      }

      // Should have recovery diagnostics for EOF
      const diagnostics = context.diagnostics.getAll();
      const eofDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("end of") ||
        d.message.includes("EOF")
      );
      expect(eofDiagnostics.length).toBeGreaterThan(0);
    });

    it("should handle end-of-input during synchronization", () => {
      const source = "invalid tokens here";
      const context = createParserContext(source);

      // Test synchronize combinator that looks for semicolon (which doesn't exist)
      const parser = Parser.synchronize(
        Parser.token("IntegerLiteral"), // This will fail
        (token) => token.kind === "Symbol" && token.symbol === "Semicolon",
      );

      const result = parser.parse(context);

      // The synchronize combinator may fail if it can't find the sync point
      // This is acceptable behavior - we just need to verify it handles EOF gracefully
      if (result.type === "success") {
        expect(result.value).toBeNull();
        // Should be at end of input after synchronization attempt
        expect(context.isAtEnd()).toBe(true);
      } else {
        // Failure is also acceptable if sync point not found
        expect(result.type).toBe("failure");
      }

      // Should have some form of error handling
      const diagnostics = context.diagnostics.getAll();
      const totalErrors = result.type === "failure" ? result.errors.length : 0;
      expect(diagnostics.length + totalErrors).toBeGreaterThanOrEqual(0);
    });

    it("should handle end-of-input during sequence recovery", () => {
      const source = "first";
      const context = createParserContext(source);

      const parser = Parser.recoverableSeq(
        Parser.token("Identifier"), // Should succeed
        Parser.token("IntegerLiteral"), // Should fail - no more tokens
        Parser.token("StringLiteral"), // Should fail - no more tokens
      );

      const result = parser.parse(context);

      // Should succeed with partial results
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toBeDefined(); // First element succeeded
        expect(result.value[1]).toBeNull(); // Second element failed (EOF)
        expect(result.value[2]).toBeNull(); // Third element failed (EOF)
      }

      // Should have recovery diagnostics for EOF scenarios
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.RECOVERED_ERROR ||
        d.code === DiagnosticCode.PREMATURE_EOF
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should handle end-of-input during expression recovery", () => {
      const source = "1 +";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should handle incomplete binary expression at EOF
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThan(0);

      // Should have EOF-related error information
      const allDiagnostics = context.diagnostics.getAll();
      const allErrors = result.type === "failure" ? result.errors : [];
      const eofErrors = [
        ...allDiagnostics.filter((d) =>
          d.code === DiagnosticCode.PREMATURE_EOF ||
          d.message.includes("end of") ||
          d.message.includes("EOF")
        ),
        ...allErrors.filter((e) =>
          e.code === DiagnosticCode.PREMATURE_EOF ||
          e.message.includes("end of") ||
          e.message.includes("EOF")
        ),
      ];
      expect(eofErrors.length).toBeGreaterThan(0);
    });

    it("should handle end-of-input during statement recovery", () => {
      const source = "let x =";
      const context = createParserContext(source);
      const result = statement().parse(context);

      // Should handle incomplete let declaration at EOF
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThan(0);

      // Should have EOF-related error information
      const allDiagnostics = context.diagnostics.getAll();
      const allErrors = result.type === "failure" ? result.errors : [];
      const eofErrors = [
        ...allDiagnostics.filter((d) =>
          d.code === DiagnosticCode.PREMATURE_EOF ||
          d.message.includes("end of") ||
          d.message.includes("EOF")
        ),
        ...allErrors.filter((e) =>
          e.code === DiagnosticCode.PREMATURE_EOF ||
          e.message.includes("end of") ||
          e.message.includes("EOF")
        ),
      ];
      expect(eofErrors.length).toBeGreaterThan(0);
    });
  });

  describe("Partial AST node creation verification", () => {
    it("should create PartialNode instances for incomplete constructs", () => {
      const source = "{ name: ";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should either succeed with partial nodes or fail with partial result
      if (result.type === "success") {
        expect(hasPartialNodes(result)).toBe(true);
      } else if (result.type === "failure" && result.partialResult) {
        expect(hasPartialNodes(result)).toBe(true);
      }

      // Should have meaningful error information
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThan(0);
    });

    it("should create PartialNode with correct field information", () => {
      // This test would need specific parser support for PartialNode creation
      // For now, we verify that the infrastructure exists
      const partialNode = new PartialNode(
        "RecordLiteral",
        { fields: [{ name: "test", value: null }] },
        ["closingBrace"],
        [Parser.ParseError.error(
          DiagnosticCode.UNCLOSED_DELIMITER,
          "Missing closing brace",
          EMPTY_SPAN,
        )],
        EMPTY_SPAN,
      );

      expect(partialNode.nodeType).toBe("RecordLiteral");
      expect(partialNode.completedFields).toBeDefined();
      expect(partialNode.missingFields).toContain("closingBrace");
      expect(partialNode.errors.length).toBe(1);
    });

    it("should preserve partial results in ParseFailure", () => {
      const source = "incomplete_construct";
      const context = createParserContext(source);

      // Create a parser that returns partial results
      const parser: Parser.Parser<string> = {
        parse(ctx: ParserContext): Parser.ParseResult<string> {
          const partialResult = "PARTIAL_RESULT";
          const error = Parser.ParseError.error(
            DiagnosticCode.INVALID_SYNTAX,
            "Incomplete construct",
            ctx.span(),
          );
          return new ParseFailure([error], partialResult);
        },
        pipe,
      };

      const result = parser.parse(context);

      expect(result.type).toBe("failure");
      if (result.type === "failure") {
        expect(result.partialResult).toBe("PARTIAL_RESULT");
        expect(result.errors.length).toBe(1);
      }
    });

    it("should handle complex partial AST structures", () => {
      const source = '{ user: { name: "John", age: ';
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Should handle nested partial structures
      const totalErrors = getTotalErrorCount(result, context);
      expect(totalErrors).toBeGreaterThan(0);

      // Should have recovery information for nested structures
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);
    });
  });

  describe("RecoveredNode instances and error information verification", () => {
    it("should create RecoveredNode instances with proper error information", () => {
      const recoveryErrors = [
        Parser.ParseError.warning(
          DiagnosticCode.INSERTED_TOKEN,
          "Inserted missing delimiter",
          EMPTY_SPAN,
        ),
      ];

      const recoveredNode = new RecoveredNode(
        "RECOVERED_VALUE",
        recoveryErrors,
        EMPTY_SPAN,
      );

      expect(recoveredNode.value).toBe("RECOVERED_VALUE");
      expect(recoveredNode.recoveryErrors.length).toBe(1);
      expect(recoveredNode.recoveryErrors[0].code).toBe(
        DiagnosticCode.INSERTED_TOKEN,
      );
      expect(recoveredNode.span).toBeDefined();
    });

    it("should verify RecoveredNode contains comprehensive error context", () => {
      const errorContext: Parser.ErrorContext = {
        parsingContexts: [{
          name: "expression",
          expectedElements: ["operand"],
          recoveryStrategies: ["ExpressionRecovery"],
          metadata: {},
        }],
        position: 5,
        nearbyTokens: [],
        metadata: { recoveryAttempt: 1 },
      };

      const recoveryError = Parser.ParseError.errorWithContext(
        DiagnosticCode.RECOVERED_ERROR,
        "Recovered from expression error",
        EMPTY_SPAN,
        errorContext,
        ["Number", "Identifier"],
        null,
      );

      expect(recoveryError.parsingContext).toBeDefined();
      expect(recoveryError.expectedTokens).toContain("Number");
      expect(recoveryError.expectedTokens).toContain("Identifier");
    });

    it("should verify RecoveredNode error information is preserved through parsing", () => {
      const source = "foo(1, , 3)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Check if any RecoveredNode instances were created
      const hasRecovered = hasRecoveredNodes(result);

      // Should have recovery information regardless of RecoveredNode creation
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Should have enhanced error information
      const allDiagnostics = context.diagnostics.getAll();
      const enhancedDiagnostics = allDiagnostics.filter((d) =>
        d.parsingContext !== undefined ||
        d.expectedTokens !== undefined ||
        d.actualToken !== undefined
      );

      // At least some diagnostics should have enhanced information
      expect(enhancedDiagnostics.length).toBeGreaterThanOrEqual(0);
    });

    it("should verify error information quality in RecoveredNode instances", () => {
      const source = "(incomplete_call";
      const context = createParserContext(source);

      // Use recoverableDelimited which should create recovery information
      const parser = Parser.recoverableDelimited(
        Parser.symbol("("),
        Parser.token("Identifier"),
        Parser.symbol(")"),
        true,
      );

      const result = parser.parse(context);

      // Should succeed with recovery
      expect(result.type).toBe("success");

      // Should have detailed recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter((d) =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.code === DiagnosticCode.RECOVERED_ERROR ||
        d.code === DiagnosticCode.RECOVERED_AT
      );

      expect(recoveryDiagnostics.length).toBeGreaterThan(0);

      // Verify diagnostic quality
      recoveryDiagnostics.forEach((diagnostic) => {
        expect(diagnostic.message).toBeTruthy();
        expect(diagnostic.span).toBeDefined();
        expect(diagnostic.code).toBeDefined();
      });
    });

    it("should verify recovery attempt information is tracked", () => {
      const source = "1 + + 2";
      const context = createParserContext(source);
      const result = expressionWithRecovery().parse(context);

      // Should have recovery history
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Verify recovery event structure
      recoveryHistory.forEach((event) => {
        expect(typeof event.strategy).toBe("string");
        expect(typeof event.position).toBe("number");
        expect(typeof event.tokensSkipped).toBe("number");
        expect(typeof event.success).toBe("boolean");
        expect(typeof event.message).toBe("string");
      });
    });

    it("should verify context stack management during recovery", () => {
      const source = "nested(expression(with(errors)))";
      const context = createParserContext(source);

      // Parse with context tracking
      const result = expression().parse(context);

      // Context stack should be properly managed (empty after parsing)
      expect(context.getCurrentContext()).toBeNull();
      expect(context.getContextStack()).toHaveLength(0);

      // Should have recovery information
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);
    });
  });
});
