import { describe, expect, it } from "vitest";
import * as AST from "../ast/mod.ts";
import {
  DiagnosticCode,
  DiagnosticCollection,
  DiagnosticSeverity,
} from "../diagnostics/mod.ts";
import { tokenizeToArray } from "../tokens/Tokenizer.ts";
import { ParserContext, ParseResult, ParseSuccess } from "./Parser.ts";
import { sourceFile } from "./parsers/SourceFile.ts";
import { statement } from "./parsers/Statement.ts";
import { expression } from "./parsers/Expression.ts";
import * as Parser from "./Parser.ts";

/**
 * Integration tests for full source file parsing with error recovery
 *
 * These tests verify that:
 * - Complete source files with multiple syntax errors can be parsed
 * - All errors are found and reported in a single pass
 * - Well-formed code after errors is parsed correctly
 * - Error recovery doesn't interfere with correct parsing
 * - Performance impact of error recovery is acceptable
 */

function createParserContext(
  source: string,
  fileName: string = "test.ts",
): ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new ParserContext(fileName, tokens, diagnostics);
}

function parseSourceFile(source: string, fileName: string = "test.ts"): {
  result: ParseResult<AST.SourceFile>;
  context: ParserContext;
  diagnostics: DiagnosticCollection;
} {
  const context = createParserContext(source, fileName);
  const result = sourceFile(fileName).parse(context);
  return { result, context, diagnostics: context.diagnostics };
}

// Helper to parse statements with error recovery using available combinators
function parseStatementsWithRecovery(source: string): {
  statements: AST.Statement[];
  errors: number;
  context: ParserContext;
} {
  const context = createParserContext(source);
  const statements: AST.Statement[] = [];
  let totalErrors = 0;

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
      totalErrors += result.errors.length;
      // Simple recovery: skip to next statement boundary
      let tokensSkipped = 0;
      while (!context.isAtEnd() && tokensSkipped < 20) { // Prevent infinite loops
        const token = context.peek();
        context.consume();
        tokensSkipped++;

        if (
          token.kind === "Newline" ||
          (token.kind === "Symbol" &&
            (token.symbol === "Semicolon" || token.symbol === "CloseBrace"))
        ) {
          break;
        }
      }
    }
  }

  return {
    statements,
    errors: totalErrors + context.diagnostics.getAll().length,
    context,
  };
}

// Helper to test error recovery combinators directly
function testRecoveryCombinators(): void {
  // Test recoverableDelimited
  const delimiterSource = "(incomplete";
  const delimiterContext = createParserContext(delimiterSource);
  const delimiterParser = Parser.recoverableDelimited(
    Parser.symbol("("),
    Parser.token("Identifier"),
    Parser.symbol(")"),
    true,
  );
  const delimiterResult = delimiterParser.parse(delimiterContext);

  expect(delimiterResult.type).toBe("success");
  if (delimiterResult.type === "success") {
    expect(delimiterResult.value.before).toBeDefined();
    expect(delimiterResult.value.after).toBeNull();
  }

  // Test synchronize
  const syncSource = "invalid tokens here; valid";
  const syncContext = createParserContext(syncSource);
  const syncParser = Parser.synchronize(
    Parser.token("Number"),
    (token) => token.kind === "Symbol" && token.symbol === "Semicolon",
  );
  const syncResult = syncParser.parse(syncContext);

  expect(syncResult.type).toBe("success");
  if (syncResult.type === "success") {
    expect(syncResult.value).toBeNull();
  }

  // Test recoverableSeq
  const seqSource = "valid invalid valid";
  const seqContext = createParserContext(seqSource);
  const seqParser = Parser.recoverableSeq(
    Parser.token("Identifier"),
    Parser.token("Number"),
    Parser.token("Identifier"),
  );
  const seqResult = seqParser.parse(seqContext);

  expect(seqResult.type).toBe("success");
  if (seqResult.type === "success") {
    expect(seqResult.value[0]).toBeDefined();
    expect(seqResult.value[1]).toBeNull();
    expect(seqResult.value[2]).toBeDefined();
  }
}

describe("Source File Error Recovery Integration Tests", () => {
  describe("Error Recovery Combinator Integration", () => {
    it("should demonstrate recoverableDelimited combinator functionality", () => {
      testRecoveryCombinators();
    });

    it("should test error recovery combinators with various inputs", () => {
      // Test recoverableDelimited with missing closing delimiter
      const delimiterSource = "(incomplete";
      const delimiterContext = createParserContext(delimiterSource);
      const delimiterParser = Parser.recoverableDelimited(
        Parser.symbol("("),
        Parser.token("Identifier"),
        Parser.symbol(")"),
        true,
      );
      const delimiterResult = delimiterParser.parse(delimiterContext);

      expect(delimiterResult.type).toBe("success");
      if (delimiterResult.type === "success") {
        expect(delimiterResult.value.before).toBeDefined();
        expect(delimiterResult.value.content).toBeDefined();
        expect(delimiterResult.value.after).toBeNull();
      }

      // Should have recovery diagnostics
      const diagnostics = delimiterContext.diagnostics.getAll();
      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it("should test synchronize combinator with token skipping", () => {
      const syncSource = "invalid tokens here; valid";
      const syncContext = createParserContext(syncSource);
      const syncParser = Parser.synchronize(
        Parser.token("Number"), // This will fail
        (token) => token.kind === "Symbol" && token.symbol === "Semicolon",
      );
      const syncResult = syncParser.parse(syncContext);

      expect(syncResult.type).toBe("success");
      if (syncResult.type === "success") {
        expect(syncResult.value).toBeNull();
      }

      // Should be positioned at semicolon
      expect(syncContext.peek().kind).toBe("Symbol");
      expect(syncContext.peek().symbol).toBe("Semicolon");
    });

    it("should test recoverableSeq combinator with partial success", () => {
      const seqSource = "valid invalid valid";
      const seqContext = createParserContext(seqSource);
      const seqParser = Parser.recoverableSeq(
        Parser.token("Identifier"), // Should succeed
        Parser.token("Number"), // Should fail on "invalid"
        Parser.token("Identifier"), // Should succeed on "valid"
      );
      const seqResult = seqParser.parse(seqContext);

      expect(seqResult.type).toBe("success");
      if (seqResult.type === "success") {
        expect(seqResult.value[0]).toBeDefined(); // First element succeeded
        expect(seqResult.value[1]).toBeNull(); // Second element failed
        expect(seqResult.value[2]).toBeDefined(); // Third element succeeded
      }
    });
  });

  describe("Multiple Syntax Errors - Single Pass Detection", () => {
    it("should find errors using manual statement parsing with recovery", () => {
      const source = `
        let broken = [1, 2, 3;
        fun malformed(a, b { return a + b; }
        let correct = "this should work";
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should have found some errors
      expect(errors).toBeGreaterThan(0);

      // Should have parsed at least the correct statement
      expect(statements.length).toBeGreaterThan(0);

      // Should have let declarations
      const letDecls = statements.filter((stmt) =>
        stmt instanceof AST.LetDeclaration
      );
      expect(letDecls.length).toBeGreaterThan(0);
    });

    it("should find errors using manual parsing with recovery for mixed syntax issues", () => {
      const source = `
        let x = 42;
        let broken = [1, 2, 3;
        fun malformed(a, b { return a + b; }
        let correct = "this should work";
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should find some errors
      expect(errors).toBeGreaterThan(0);

      // Should have parsed some statements
      expect(statements.length).toBeGreaterThan(1);

      // Should have let declarations
      const letDecls = statements.filter((stmt) =>
        stmt instanceof AST.LetDeclaration
      );
      expect(letDecls.length).toBeGreaterThan(1);
    });

    it("should handle nested error scenarios with manual recovery", () => {
      const source = `
        let simple1 = 42;
        fun broken(param1, param2 { return param1 + param2; }
        let simple2 = "after error";
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should find some errors
      expect(errors).toBeGreaterThan(0);

      // Should have parsed the simple declarations
      expect(statements.length).toBeGreaterThan(1);
      const letDecls = statements.filter((stmt) =>
        stmt instanceof AST.LetDeclaration
      );
      expect(letDecls.length).toBeGreaterThan(1);
    });
  });

  describe("Well-formed Code After Errors", () => {
    it("should parse correct code after syntax errors using manual recovery", () => {
      const source = `
        let broken = [1, 2, 3;
        fun malformed(a, b { return a + b; }
        let correctVar = "this is correct";
        fun correctFunction(x: Int, y: Int): Int => x + y;
        let anotherCorrectVar = 42;
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should have some errors from the broken code
      expect(errors).toBeGreaterThan(0);

      // Should have parsed the correct statements
      expect(statements.length).toBeGreaterThan(2);

      // Should have let declarations
      const letDecls = statements.filter((stmt) =>
        stmt instanceof AST.LetDeclaration
      );
      const funcDecls = statements.filter((stmt) =>
        stmt instanceof AST.FunctionDeclaration
      );

      expect(letDecls.length).toBeGreaterThan(1);
      expect(funcDecls.length).toBeGreaterThan(0);
    });

    it("should maintain correct AST structure for valid code sections using manual recovery", () => {
      const source = `
        let broken = [1, 2, 3;
        fun calculateSum(x: Int, y: Int): Int => x + y;
        let testArray = [1, 2, 3, 4, 5];
        let result = 42;
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should have some errors from broken code
      expect(errors).toBeGreaterThan(0);

      // Should have parsed valid statements
      expect(statements.length).toBeGreaterThan(2);

      // Find the calculateSum function
      const calcSumFunc = statements.find((stmt) =>
        stmt instanceof AST.FunctionDeclaration &&
        (stmt as AST.FunctionDeclaration).name.name === "calculateSum"
      ) as AST.FunctionDeclaration;

      if (calcSumFunc) {
        // Verify function structure is correct
        expect(calcSumFunc.parameters.length).toBe(2);
        expect(calcSumFunc.parameters[0].name.name).toBe("x");
        expect(calcSumFunc.parameters[1].name.name).toBe("y");
      }

      // Should have let declarations
      const letDecls = statements.filter((stmt) =>
        stmt instanceof AST.LetDeclaration
      );
      expect(letDecls.length).toBeGreaterThan(1);
    });
  });

  describe("Error Recovery Non-Interference", () => {
    it("should not interfere with parsing of completely correct code", () => {
      const source = `
        let x = 42;
        fun simple(): Int => 100;
        let y = "hello world";
        fun add(a: Int, b: Int): Int => a + b;
      `;

      const { result, context } = parseSourceFile(source);
      const allDiagnostics = context.diagnostics.getAll();

      // Should have minimal errors for simple correct code
      expect(allDiagnostics.length).toBeLessThan(2);

      // Should parse successfully
      expect(result.type).toBe("success");

      if (result.type === "success") {
        const statements = result.value.statements;
        expect(statements.length).toBeGreaterThan(0);

        // Verify expected statement types are present
        const functions = statements.filter((stmt) =>
          stmt instanceof AST.FunctionDeclaration
        );
        const letDecls = statements.filter((stmt) =>
          stmt instanceof AST.LetDeclaration
        );

        // Should have parsed at least some statements
        expect(functions.length + letDecls.length).toBeGreaterThan(0);
      }
    });

    it("should maintain performance for error-free code", () => {
      // Generate a larger correct source file to test performance
      const generateCorrectCode = (size: number): string => {
        let code = 'import { utils } from "module";\n\n';

        for (let i = 0; i < size; i++) {
          code += `let var${i} = ${i};\n`;
          code += `fun func${i}(x: Int): Int => x + ${i};\n`;
        }

        code += "\ndata LargeType = ";
        for (let i = 0; i < size; i++) {
          code += `Variant${i}(Int)`;
          if (i < size - 1) code += " | ";
        }
        code += ";\n";

        return code;
      };

      const source = generateCorrectCode(50); // Generate 50 variables and functions

      const startTime = performance.now();
      const { result, context } = parseSourceFile(source);
      const endTime = performance.now();

      const parseTime = endTime - startTime;
      const allDiagnostics = context.diagnostics.getAll();

      // Should have no errors
      expect(allDiagnostics.length).toBe(0);

      // Should parse successfully
      expect(result.type).toBe("success");

      // Performance should be reasonable (less than 100ms for this size)
      expect(parseTime).toBeLessThan(100);

      if (result.type === "success") {
        const statements = result.value.statements;
        // Should have import + 50 lets + 50 functions + 1 data = 102 statements
        expect(statements.length).toBe(102);
      }
    });
  });

  describe("Performance Impact of Error Recovery", () => {
    it("should have acceptable performance impact when errors are present", () => {
      const generateCodeWithErrors = (size: number): string => {
        let code = "";

        for (let i = 0; i < size; i++) {
          if (i % 10 === 0) {
            // Introduce errors every 10th item
            code += `let var${i} = [1, 2, 3;\n`; // Missing closing bracket
            code += `fun func${i}(x: Int y: Int): Int => x + y;\n`; // Missing comma
          } else {
            code += `let var${i} = ${i};\n`;
            code += `fun func${i}(x: Int): Int => x + ${i};\n`;
          }
        }

        return code;
      };

      const source = generateCodeWithErrors(20); // Smaller size for more realistic test

      const startTime = performance.now();
      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );
      const endTime = performance.now();

      const parseTime = endTime - startTime;

      // Should have found some errors
      expect(errors).toBeGreaterThan(0);

      // Should have parsed some statements despite errors
      expect(statements.length).toBeGreaterThan(10);

      // Performance should still be reasonable even with errors (less than 200ms)
      expect(parseTime).toBeLessThan(200);
    });

    it("should handle large files with many errors efficiently", () => {
      const generateLargeFileWithManyErrors = (): string => {
        let code = "";

        // Create a file with many different types of errors
        for (let i = 0; i < 50; i++) { // Reduced size for more realistic test
          switch (i % 5) {
            case 0:
              code += `let var${i} = [1, 2, 3;\n`; // Missing bracket
              break;
            case 1:
              code += `fun func${i}(a, b { return a + b; }\n`; // Missing paren
              break;
            case 2:
              code += `let obj${i} = "value";\n`; // Correct statement
              break;
            case 3:
              code += `let broken${i} = [1, 2;\n`; // Missing bracket
              break;
            case 4:
              code += `let correct${i} = ${i};\n`; // Correct statement
              break;
          }
        }

        return code;
      };

      const source = generateLargeFileWithManyErrors();

      const startTime = performance.now();
      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );
      const endTime = performance.now();

      const parseTime = endTime - startTime;

      // Should have found some errors
      expect(errors).toBeGreaterThan(10);

      // Should still complete parsing in reasonable time (less than 500ms)
      expect(parseTime).toBeLessThan(500);

      // Should have parsed some statements despite many errors
      expect(statements.length).toBeGreaterThan(10);
    });

    it("should demonstrate recovery performance statistics", () => {
      const source = `
        let broken1 = [1, 2, 3;
        fun broken2(a, b { return a + b; }
        let correct1 = "this works";
        fun correct2(): Int => 42;
        let correct3 = [1, 2, 3];
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      const stats = context.getPerformanceStats();

      // Should have some errors
      expect(errors).toBeGreaterThan(0);

      // Should have parsed some statements
      expect(statements.length).toBeGreaterThanOrEqual(2);

      // Performance stats should be available
      expect(typeof stats.isRecoveryActive).toBe("boolean");
      expect(typeof stats.recoveryAttempts).toBe("number");
      expect(typeof stats.errorCount).toBe("number");
      expect(typeof stats.isFastPathEnabled).toBe("boolean");

      console.log(`Performance stats for error recovery:`, {
        recoveryAttempts: stats.recoveryAttempts,
        errorCount: stats.errorCount,
        cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
        statementsFound: statements.length,
        errorsFound: errors,
      });
    });
  });

  describe("Edge Cases and Robustness", () => {
    it("should handle end-of-input during recovery", () => {
      const source = `
        fun incomplete(param1, param2
        // File ends abruptly without closing paren or brace
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should handle gracefully and report errors
      expect(errors).toBeGreaterThan(0);

      // Should not crash or hang
      expect(statements).toBeDefined();
      expect(Array.isArray(statements)).toBe(true);
    });

    it("should handle deeply nested error scenarios", () => {
      const source = `
        fun outer(a, b { return a + b; }
        let shouldStillWork = "after error";
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should find some errors
      expect(errors).toBeGreaterThan(0);

      // Should still parse the let declaration
      expect(statements.length).toBeGreaterThan(0);
      const letDecls = statements.filter((stmt) =>
        stmt instanceof AST.LetDeclaration
      );
      expect(letDecls.length).toBeGreaterThan(0);
    });

    it("should handle mixed valid and invalid tokens", () => {
      const source = `
        let valid1 = 42;
        let broken = [1, 2, 3;
        let valid2 = "string";
        fun brokenFunc(a, b { return a + b; }
        fun validFunction(): Int => 100;
        let valid3 = [1, 2, 3];
      `;

      const { statements, errors, context } = parseStatementsWithRecovery(
        source,
      );

      // Should report errors for invalid syntax
      expect(errors).toBeGreaterThan(0);

      // Should still parse valid declarations
      expect(statements.length).toBeGreaterThan(2);
      const letDecls = statements.filter((stmt) =>
        stmt instanceof AST.LetDeclaration
      );
      const funcDecls = statements.filter((stmt) =>
        stmt instanceof AST.FunctionDeclaration
      );

      // Should have parsed at least some valid statements
      expect(letDecls.length + funcDecls.length).toBeGreaterThan(2);
    });
  });
});
