import { describe, expect, it } from "vitest";
import * as Parser from "./Parser.ts";
import { tokenizeToArray } from "../tokens/Tokenizer.ts";
import { DiagnosticCollection } from "../diagnostics/mod.ts";
import { SYMBOL_VALUES } from "../tokens/Symbols.ts";

function createParserContext(source: string): Parser.ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new Parser.ParserContext("test.ts", tokens, diagnostics);
}

describe("Parser Combinators", () => {
  describe("token", () => {
    it("should parse a specific token kind", () => {
      const source = "let";
      const context = createParserContext(source);

      // Test parsing "let" token
      const letParser = Parser.token("let");
      const result = letParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.kind).toBe("let");
      }
    });

    it("should fail for wrong token kind", () => {
      const source = "let x = 42;";
      const context = createParserContext(source);

      // Try to parse "fun" when we have "let"
      const funParser = Parser.token("fun");
      const result = funParser.parse(context);

      expect(result.type).toBe("failure");
    });
  });

  describe("symbol", () => {
    it("should parse a specific symbol", () => {
      const source = "=";
      const context = createParserContext(source);

      // Test parsing "=" symbol
      const equalsParser = Parser.symbol("=");
      const result = equalsParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.kind).toBe("Symbol");
        expect(result.value.symbol).toBe(SYMBOL_VALUES["="]);
      }
    });

    it("should fail for wrong symbol", () => {
      const source = "let x = 42;";
      const context = createParserContext(source);

      // Try to parse "+" when we have "="
      const plusParser = Parser.symbol("+");
      const result = plusParser.parse(context);

      expect(result.type).toBe("failure");
    });
  });

  describe("sequence", () => {
    it("should parse a sequence of tokens", () => {
      const source = "let x = 42";
      const context = createParserContext(source);

      const sequenceParser = Parser.seq(
        Parser.token("let"),
        Parser.token("Identifier"),
        Parser.symbol("="),
        Parser.token("IntegerLiteral"),
      );

      const result = sequenceParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(4);
        expect(result.value[0].kind).toBe("let");
        expect(result.value[1].kind).toBe("Identifier");
        expect(result.value[2].kind).toBe("Symbol");
        expect(result.value[3].kind).toBe("IntegerLiteral");
      }
    });

    it("should fail if sequence is incomplete", () => {
      const source = "let x =";
      const context = createParserContext(source);

      const sequenceParser = Parser.seq(
        Parser.token("let"),
        Parser.token("Identifier"),
        Parser.symbol("="),
        Parser.token("IntegerLiteral"),
      );

      const result = sequenceParser.parse(context);

      expect(result.type).toBe("failure");
    });
  });

  describe("or", () => {
    it("should parse first matching alternative", () => {
      const source = "let x = 42;";
      const context = createParserContext(source);

      const orParser = Parser.or(
        Parser.token("fun"),
        Parser.token("let"),
        Parser.token("data"),
      );

      const result = orParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.kind).toBe("let");
      }
    });

    it("should fail if no alternative matches", () => {
      const source = "let x = 42;";
      const context = createParserContext(source);

      const orParser = Parser.or(
        Parser.token("fun"),
        Parser.token("data"),
        Parser.token("interface"),
      );

      const result = orParser.parse(context);

      expect(result.type).toBe("failure");
    });
  });

  describe("map", () => {
    it("should transform parsed value", () => {
      const source = "42";
      const context = createParserContext(source);

      const numberParser = Parser.token("IntegerLiteral").pipe(
        Parser.map((token) => Number.parseInt(token.text, 10)),
      );

      const result = numberParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBe(42);
        expect(typeof result.value).toBe("number");
      }
    });
  });

  describe("optional", () => {
    it("should parse optional token when present", () => {
      const source = "export let x = 42;";
      const context = createParserContext(source);

      const exportParser = Parser.optional(Parser.token("export"));
      const result = exportParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).not.toBeNull();
        expect(result.value?.kind).toBe("export");
      }
    });

    it("should return null when optional token is absent", () => {
      const source = "let x = 42;";
      const context = createParserContext(source);

      const exportParser = Parser.optional(Parser.token("export"));
      const result = exportParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("zeroOrMore", () => {
    it("should parse zero or more occurrences", () => {
      const source = "let x = 42;";
      const context = createParserContext(source);

      const whitespaceParser = Parser.zeroOrMore(Parser.token("Whitespace"));
      const result = whitespaceParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(Array.isArray(result.value)).toBe(true);
        // Should parse successfully even if no whitespace tokens
      }
    });

    it("should parse multiple occurrences", () => {
      const source = "   let x = 42;";
      const context = createParserContext(source);

      const whitespaceParser = Parser.zeroOrMore(Parser.token("Whitespace"));
      const result = whitespaceParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe("oneOrMore", () => {
    it("should parse one or more occurrences", () => {
      const source = "   let x = 42;";
      const context = createParserContext(source);

      const whitespaceParser = Parser.oneOrMore(Parser.token("Whitespace"));
      const result = whitespaceParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });

    it("should fail when no occurrences found", () => {
      const source = "let x = 42;";
      const context = createParserContext(source);

      const whitespaceParser = Parser.oneOrMore(Parser.token("Whitespace"));
      const result = whitespaceParser.parse(context);

      expect(result.type).toBe("failure");
    });
  });

  describe("delimitedBy", () => {
    it("should parse content between delimiters", () => {
      const source = "(42)";
      const context = createParserContext(source);

      const delimitedParser = Parser.token("IntegerLiteral").pipe(
        Parser.delimitedBy(
          Parser.symbol("("),
          Parser.symbol(")"),
        ),
      );

      const result = delimitedParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.before.kind).toBe("Symbol");
        expect(result.value.before.symbol).toBe(SYMBOL_VALUES["("]);
        expect(result.value.after.kind).toBe("Symbol");
        expect(result.value.after.symbol).toBe(SYMBOL_VALUES[")"]);
        expect(result.value.content.kind).toBe("IntegerLiteral");
      }
    });
  });

  describe("separatedBy", () => {
    it("should parse items separated by delimiter", () => {
      const source = "1, 2, 3";
      const context = createParserContext(source);
      const separatedParser = Parser.token("IntegerLiteral").pipe(
        Parser.separatedBy(Parser.symbol(",")),
      );

      const result = separatedParser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(3);
        expect(result.value[0].kind).toBe("IntegerLiteral");
        expect(result.value[1].kind).toBe("IntegerLiteral");
        expect(result.value[2].kind).toBe("IntegerLiteral");
      }
    });
  });

  describe("precedence", () => {
    // Simple expression type for testing
    type Expr = number | { op: string; left: Expr; right: Expr };

    // Create a simple expression parser for testing precedence
    function createExpressionParser() {
      // Atom parser - just numbers for simplicity
      const atom = Parser.token("IntegerLiteral").pipe(
        Parser.map((token) => Number.parseInt(token.text, 10) as Expr),
      );

      // Operator parsers that return functions
      const addOp = Parser.symbol("+").pipe(
        Parser.map(() => (left: Expr, right: Expr): Expr => ({
          op: "+",
          left,
          right,
        })),
      );

      const subOp = Parser.symbol("-").pipe(
        Parser.map(() => (left: Expr, right: Expr): Expr => ({
          op: "-",
          left,
          right,
        })),
      );

      const mulOp = Parser.symbol("*").pipe(
        Parser.map(() => (left: Expr, right: Expr): Expr => ({
          op: "*",
          left,
          right,
        })),
      );

      const divOp = Parser.symbol("/").pipe(
        Parser.map(() => (left: Expr, right: Expr): Expr => ({
          op: "/",
          left,
          right,
        })),
      );

      // Define precedence levels (lower index = higher precedence)
      const levels = [
        Parser.PrecedenceLevel.left(addOp, subOp), // Addition/subtraction (lowest)
        Parser.PrecedenceLevel.left(mulOp, divOp), // Multiplication/division (higher)
      ];

      return Parser.precedence(atom, levels);
    }

    it("should respect operator precedence", () => {
      const source = "2+3*4";
      const context = createParserContext(source);
      const parser = createExpressionParser();

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        // Should parse as: 2 + (3 * 4)
        const expr = result.value as Expr;
        expect(expr).toEqual({
          op: "+",
          left: 2,
          right: {
            op: "*",
            left: 3,
            right: 4,
          },
        });
      }
    });

    it("should handle left associativity for same precedence", () => {
      const source = "1+2+3";
      const context = createParserContext(source);
      const parser = createExpressionParser();

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        // Should parse as: ((1 + 2) + 3)
        const expr = result.value as Expr;
        expect(expr).toEqual({
          op: "+",
          left: {
            op: "+",
            left: 1,
            right: 2,
          },
          right: 3,
        });
      }
    });

    it("should handle mixed precedence and associativity", () => {
      const source = "10-2*3+4";
      const context = createParserContext(source);
      const parser = createExpressionParser();

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        // Should parse as: (10 - (2 * 3)) + 4
        const expr = result.value as Expr;
        expect(expr).toEqual({
          op: "+",
          left: {
            op: "-",
            left: 10,
            right: {
              op: "*",
              left: 2,
              right: 3,
            },
          },
          right: 4,
        });
      }
    });

    it("should handle single number", () => {
      const source = "42";
      const context = createParserContext(source);
      const parser = createExpressionParser();

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBe(42);
      }
    });

    it("should fail for invalid expression", () => {
      const source = "1+";
      const context = createParserContext(source);
      const parser = createExpressionParser();

      const result = parser.parse(context);

      expect(result.type).toBe("failure");
    });
  });

  describe("unary", () => {
    // Simple expression type for testing unary operators
    type UnaryExpr = number | { op: string; operand: UnaryExpr };

    function createUnaryExpressionParser() {
      // Atom parser - just numbers for simplicity
      const atom = Parser.token("IntegerLiteral").pipe(
        Parser.map((token) => Number.parseInt(token.text, 10) as UnaryExpr),
      );

      // Unary operator parsers
      const negOp = Parser.symbol("-").pipe(
        Parser.map(() => (operand: UnaryExpr): UnaryExpr => ({
          op: "neg",
          operand,
        })),
      );

      const notOp = Parser.symbol("!").pipe(
        Parser.map(() => (operand: UnaryExpr): UnaryExpr => ({
          op: "not",
          operand,
        })),
      );

      return Parser.unary(atom, [negOp, notOp]);
    }

    it("should parse unary operators", () => {
      const source = "-42";
      const context = createParserContext(source);
      const parser = createUnaryExpressionParser();

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toEqual({
          op: "neg",
          operand: 42,
        });
      }
    });
  });
});
