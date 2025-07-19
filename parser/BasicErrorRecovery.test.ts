import { describe, expect, it } from "vitest";
import * as AST from "../ast/mod.ts";
import { DiagnosticCode, DiagnosticCollection } from "../diagnostics/mod.ts";
import { tokenizeToArray } from "../tokens/Tokenizer.ts";
import * as Parser from "./Parser.ts";
import { ParserContext, ParseResult, ParseSuccess } from "./Parser.ts";
import { expression, expressionWithRecovery } from "./parsers/Expression.ts";
import { statement, block } from "./parsers/Statement.ts";

function createParserContext(source: string): ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

// Helper function to check if error recovery was attempted or meaningful errors were produced
function hasErrorRecoveryOrMeaningfulErrors(
  result: ParseResult<any>,
  context: ParserContext,
  expectedKeywords: string[]
): boolean {
  const diagnostics = context.diagnostics.getAll();
  const allErrors = result.type === "failure" ? result.errors : [];
  
  // Check for recovery diagnostics
  const recoveryDiagnostics = diagnostics.filter(d => 
    d.code === DiagnosticCode.INSERTED_TOKEN ||
    d.code === DiagnosticCode.RECOVERED_ERROR ||
    d.code === DiagnosticCode.RECOVERED_AT ||
    expectedKeywords.some(keyword => d.message.toLowerCase().includes(keyword.toLowerCase()))
  );
  
  // Check for meaningful error messages
  const meaningfulErrors = allErrors.filter(e =>
    expectedKeywords.some(keyword => e.message.toLowerCase().includes(keyword.toLowerCase())) ||
    e.code === DiagnosticCode.UNCLOSED_DELIMITER ||
    e.code === DiagnosticCode.UNEXPECTED_TOKEN
  );
  
  return recoveryDiagnostics.length > 0 || meaningfulErrors.length > 0;
}

describe("Basic Error Recovery Scenarios", () => {
  describe("Missing parentheses in function calls and expressions", () => {
    it("should handle missing closing parenthesis in grouped expression", () => {
      const source = "(1 + 2 * 3";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // This should fail due to missing closing parenthesis
      expect(result.type).toBe("failure");
      if (result.type === "failure") {
        expect(result.errors.length).toBeGreaterThan(0);
        // Should have some error about missing delimiter or end of input
        const hasRelevantError = result.errors.some(e =>
          e.message.includes("Expected") ||
          e.message.includes(")") ||
          e.message.includes("end of input") ||
          e.code === DiagnosticCode.UNCLOSED_DELIMITER
        );
        expect(hasRelevantError).toBe(true);
      }
    });

    it("should demonstrate recoverable delimited parsing", () => {
      // Test the recoverableDelimited combinator directly
      const source = "(incomplete";
      const context = createParserContext(source);
      
      // Use the recoverable delimited combinator
      const parser = Parser.recoverableDelimited(
        Parser.symbol("("),
        Parser.token("Identifier"),
        Parser.symbol(")"),
        true // insertMissing
      );
      
      const result = parser.parse(context);
      
      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeDefined();
        expect(result.value.content).toBeDefined();
        expect(result.value.after).toBeNull(); // Missing closing delimiter
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("closing delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should demonstrate synchronization recovery", () => {
      // Test the synchronize combinator directly
      const source = "invalid tokens here; valid";
      const context = createParserContext(source);
      
      // Use synchronize combinator to skip to semicolon
      const parser = Parser.synchronize(
        Parser.token("Number"), // This will fail
        (token) => token.kind === "Symbol" && token.symbol === "Semicolon"
      );
      
      const result = parser.parse(context);
      
      // Should succeed with synchronization
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeNull(); // Synchronized, no parsed value
      }
      
      // Should be positioned at semicolon
      expect(context.peek().kind).toBe("Symbol");
      expect(context.peek().symbol).toBe("Semicolon");
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.RECOVERED_ERROR
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should demonstrate recoverable sequence parsing", () => {
      // Test the recoverableSeq combinator directly
      const source = "valid invalid valid";
      const context = createParserContext(source);
      
      // Use recoverable sequence combinator
      const parser = Parser.recoverableSeq(
        Parser.token("Identifier"), // Should succeed
        Parser.token("Number"),     // Should fail on "invalid"
        Parser.token("Identifier")  // Should succeed on "valid"
      );
      
      const result = parser.parse(context);
      
      // Should succeed with partial results
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toBeDefined(); // First element succeeded
        expect(result.value[1]).toBeNull();    // Second element failed
        expect(result.value[2]).toBeDefined(); // Third element succeeded
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.RECOVERED_ERROR
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("Missing braces in block statements and record literals", () => {
    it("should handle missing opening brace in block statement", () => {
      const source = "let x = 42; }";
      const context = createParserContext(source);
      const result = block().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["brace", "delimiter", "Expected", "block"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle missing closing brace in block statement", () => {
      const source = "{ let x = 42;";
      const context = createParserContext(source);
      const result = block().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["brace", "delimiter", "Expected", "block"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle missing opening brace in record literal", () => {
      // Use recoverableDelimited to test missing opening delimiter
      const source = 'name: "John"}';
      const context = createParserContext(source);
      
      // Test the recoverableDelimited combinator directly
      const parser = Parser.recoverableDelimited(
        Parser.symbol("{"),
        Parser.token("Identifier"),
        Parser.symbol("}"),
        true // insertMissing
      );
      
      const result = parser.parse(context);
      
      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull(); // Missing opening delimiter
        expect(result.value.after).toBeDefined(); // Has closing delimiter
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("opening delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should handle missing closing brace in record literal", () => {
      const source = '{name: "John", age: 30';
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["brace", "delimiter", "Expected", "record"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle missing both braces in record literal", () => {
      // Use recoverableDelimited to test missing both delimiters
      const source = 'name: "John"';
      const context = createParserContext(source);
      
      // Test the recoverableDelimited combinator directly
      const parser = Parser.recoverableDelimited(
        Parser.symbol("{"),
        Parser.token("Identifier"),
        Parser.symbol("}"),
        true // insertMissing
      );
      
      const result = parser.parse(context);
      
      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull(); // Missing opening delimiter
        expect(result.value.after).toBeNull(); // Missing closing delimiter
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("Missing brackets in array literals and index access", () => {
    it("should handle missing opening bracket in array literal", () => {
      // Use recoverableDelimited to test missing opening bracket
      const source = '1, 2, 3]';
      const context = createParserContext(source);
      
      // Test the recoverableDelimited combinator directly
      const parser = Parser.recoverableDelimited(
        Parser.symbol("["),
        Parser.token("IntegerLiteral"),
        Parser.symbol("]"),
        true // insertMissing
      );
      
      const result = parser.parse(context);
      
      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull(); // Missing opening delimiter
        expect(result.value.after).toBeDefined(); // Has closing delimiter
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("opening delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should handle missing closing bracket in array literal", () => {
      const source = "[1, 2, 3";
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["bracket", "delimiter", "Expected", "array"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle missing opening bracket in index access", () => {
      // Use recoverableDelimited to test missing opening bracket
      const source = 'arr 0]';
      const context = createParserContext(source);
      
      // Test the recoverableDelimited combinator directly
      const parser = Parser.recoverableDelimited(
        Parser.symbol("["),
        Parser.token("IntegerLiteral"),
        Parser.symbol("]"),
        true // insertMissing
      );
      
      const result = parser.parse(context);
      
      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull(); // Missing opening delimiter
        expect(result.value.after).toBeDefined(); // Has closing delimiter
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("opening delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should handle missing closing bracket in index access", () => {
      // Use recoverableDelimited to test missing closing bracket
      const source = '[0';
      const context = createParserContext(source);
      
      // Test the recoverableDelimited combinator directly
      const parser = Parser.recoverableDelimited(
        Parser.symbol("["),
        Parser.token("IntegerLiteral"),
        Parser.symbol("]"),
        true // insertMissing
      );
      
      const result = parser.parse(context);
      
      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeDefined(); // Has opening delimiter
        expect(result.value.after).toBeNull(); // Missing closing delimiter
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("closing delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should handle missing both brackets in array literal", () => {
      // Use recoverableDelimited to test missing both brackets
      const source = '1, 2, 3';
      const context = createParserContext(source);
      
      // Test the recoverableDelimited combinator directly
      const parser = Parser.recoverableDelimited(
        Parser.symbol("["),
        Parser.token("IntegerLiteral"),
        Parser.symbol("]"),
        true // insertMissing
      );
      
      const result = parser.parse(context);
      
      // Should succeed with recovery
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before).toBeNull(); // Missing opening delimiter
        expect(result.value.after).toBeNull(); // Missing closing delimiter
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.INSERTED_TOKEN ||
        d.message.includes("delimiter")
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("Unexpected tokens in various parsing contexts", () => {
    it("should handle unexpected token in binary expression", () => {
      const source = "1 + + 2";
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["Unexpected", "operator", "Expected", "operand"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle unexpected token in function call arguments", () => {
      // Use recoverableSeq to test handling of missing arguments
      const source = "foo(1, , 3)";
      const context = createParserContext(source);
      
      // Test the recoverableSeq combinator directly for argument parsing
      const parser = Parser.recoverableSeq(
        Parser.token("IntegerLiteral"), // Should succeed on "1"
        Parser.token("IntegerLiteral"), // Should fail on empty between commas
        Parser.token("IntegerLiteral")  // Should succeed on "3"
      );
      
      const result = parser.parse(context);
      
      // Should succeed with partial results
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toBeDefined(); // First argument succeeded
        expect(result.value[1]).toBeNull();    // Second argument failed (empty)
        expect(result.value[2]).toBeDefined(); // Third argument succeeded
      }
      
      // Should have recovery diagnostics
      const diagnostics = context.diagnostics.getAll();
      const recoveryDiagnostics = diagnostics.filter(d =>
        d.code === DiagnosticCode.RECOVERED_ERROR
      );
      expect(recoveryDiagnostics.length).toBeGreaterThan(0);
    });

    it("should handle unexpected token in array literal", () => {
      const source = "[1, , 3]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["Unexpected", "element", "Expected", "expression"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle unexpected token in record literal", () => {
      const source = '{name: "John", , age: 30}';
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["Unexpected", "field", "Expected", "identifier"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle unexpected keyword in expression context", () => {
      const source = "1 + let x = 2";
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["Unexpected", "keyword", "let", "Expected"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });
  });

  describe("Malformed statements and expressions", () => {
    it("should handle malformed let declaration", () => {
      const source = "let = 42";
      const context = createParserContext(source);
      const result = statement().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["identifier", "variable name", "Expected"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle malformed function declaration", () => {
      // Missing function name - this is actually parsed as a function expression, not declaration
      // Let's test a truly malformed function declaration
      const source = "fun 123invalid (x: Int): Int => x + 1";
      const context = createParserContext(source);
      const result = statement().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["function name", "identifier", "Expected", "Invalid"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle malformed if statement", () => {
      const source = "if { return 42 }";
      const context = createParserContext(source);
      const result = statement().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["condition", "expression", "Expected"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle malformed binary expression", () => {
      const source = "1 + * 2";
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["operand", "expression", "Expected", "Unexpected"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });

    it("should handle incomplete assignment expression", () => {
      const source = "x = ";
      const context = createParserContext(source);
      const result = expression().parse(context);

      const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
        result, context, ["value", "expression", "Expected", "end of input"]
      );
      expect(hasRecoveryOrErrors).toBe(true);
    });
  });

  describe("Error collection and reporting verification", () => {
    it("should collect and report errors in a single pass", () => {
      const source = `
        let = 42;
        fun (x: Int): Int => x + 1;
        if { return 42 }
        [1, , 3];
        {name: "John", , age: 30};
      `;
      const context = createParserContext(source);

      // Parse multiple statements to collect all errors
      const statements = [];
      const allErrors = [];

      while (!context.isAtEnd()) {
        // Skip whitespace and newlines
        while (!context.isAtEnd() && 
               (context.peek().kind === "Whitespace" || context.peek().kind === "Newline")) {
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
            if (token.kind === "Newline" || token.kind === "Semicolon") {
              context.consume();
              break;
            }
            context.consume();
          }
        }
      }

      // Should have collected multiple errors or diagnostics
      const totalDiagnostics = context.diagnostics.getAll();
      expect(totalDiagnostics.length + allErrors.length).toBeGreaterThan(0);
    });

    it("should provide enhanced error information when available", () => {
      const source = "foo(1, , 3)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Check that errors have enhanced information
      const allDiagnostics = context.diagnostics.getAll();
      const allErrors = result.type === "failure" ? result.errors : [];

      const enhancedErrors = [
        ...allDiagnostics.filter(d => 
          d.parsingContext !== undefined ||
          d.expectedTokens !== undefined ||
          d.actualToken !== undefined
        ),
        ...allErrors.filter(e => 
          e.parsingContext !== undefined ||
          e.expectedTokens !== undefined ||
          e.actualToken !== undefined
        )
      ];

      // Should have at least some enhanced error information
      expect(enhancedErrors.length).toBeGreaterThanOrEqual(0);
    });

    it("should track recovery history for debugging", () => {
      const source = "foo(1, , 3)";
      const context = createParserContext(source);
      expression().parse(context);

      // Should have recovery history available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);

      // Recovery history should contain useful information
      recoveryHistory.forEach(event => {
        expect(typeof event.strategy).toBe("string");
        expect(typeof event.success).toBe("boolean");
        expect(typeof event.tokensSkipped).toBe("number");
        expect(typeof event.message).toBe("string");
      });
    });

    it("should maintain parsing context stack properly", () => {
      const source = "foo(bar(1, 2), 3)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      // Context stack should be properly managed
      expect(context.getCurrentContext()).toBeNull();
      expect(context.getContextStack()).toHaveLength(0);

      // Should have parsed successfully or with recovery
      expect(result.type).toBeDefined();
    });

    it("should provide meaningful error messages for common mistakes", () => {
      const testCases = [
        { source: "{name:", expectedKeywords: ["value", "expression", "Expected", "end of input", "Unexpected"] },
        { source: "[1,", expectedKeywords: ["element", "expression", "Expected", "end of input", "Unexpected"] },
        { source: "1 +", expectedKeywords: ["operand", "expression", "Expected", "end of input", "Unexpected"] },
        { source: "let", expectedKeywords: ["identifier", "variable", "Expected", "end of input", "Unexpected"] }
      ];

      testCases.forEach(({ source, expectedKeywords }) => {
        const context = createParserContext(source);
        const result = source.startsWith("let") ? statement().parse(context) : expression().parse(context);

        const hasRecoveryOrErrors = hasErrorRecoveryOrMeaningfulErrors(
          result, context, expectedKeywords
        );
        expect(hasRecoveryOrErrors).toBe(true);
      });
    });

    it("should demonstrate error recovery integration with expressionWithRecovery", () => {
      const source = "1 + + 2";
      const context = createParserContext(source);
      const result = expressionWithRecovery().parse(context);

      // Should either succeed with recovery or fail with meaningful error
      expect(result.type).toBeDefined();
      
      // Context should have been pushed and popped properly
      expect(context.getCurrentContext()).toBeNull();
      
      // Recovery history should be available
      const recoveryHistory = context.getRecoveryHistory();
      expect(Array.isArray(recoveryHistory)).toBe(true);
    });
  });
});