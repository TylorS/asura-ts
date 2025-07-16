import { describe, expect, it } from "vitest";
import * as AST from "../../ast/mod.ts";
import { ParserContext, ParseResult, ParseSuccess } from "../Parser.ts";
import { tokenizeToArray } from "../../tokens/Tokenizer.ts";
import { DiagnosticCollection } from "../../diagnostics/mod.ts";
import {
  arrayLiteral,
  binaryExpression,
  expression,
  functionExpression,
  literals,
  matchExpression,
  recordLiteral,
  returnExpressionOrBlock,
  unaryExpression,
} from "./Expression.ts";

function createParserContext(source: string): ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

function assertSuccess<T>(
  result: ParseResult<T>,
): asserts result is ParseSuccess<T> {
  try {
    expect(result.type).toBe("success");
  } catch (e) {
    console.log(result);
    throw e;
  }
}

describe("Expression Parser", () => {
  describe("literals", () => {
    it("should parse integer literals", () => {
      const context = createParserContext("42");
      const result = literals().parse(context);

      assertSuccess(result);
      expect(result.value).toBeInstanceOf(AST.IntegerLiteral);
      expect((result.value as AST.IntegerLiteral).value).toBe(42);
    });

    it("should parse float literals", () => {
      const context = createParserContext("3.14");
      const result = literals().parse(context);

      assertSuccess(result);
      expect(result.value).toBeInstanceOf(AST.FloatLiteral);
      expect((result.value as AST.FloatLiteral).value).toBe(3.14);
    });

    it("should parse big integer literals", () => {
      const context = createParserContext("42n");
      const result = literals().parse(context);

      assertSuccess(result);
      expect(result.value).toBeInstanceOf(AST.BigIntLiteral);
      expect((result.value as AST.BigIntLiteral).value).toBe(BigInt(42));
    });

    it("should parse big decimal literals", () => {
      const context = createParserContext("3.14n");
      const result = literals().parse(context);

      assertSuccess(result);
      expect(result.value).toBeInstanceOf(AST.BigDecimalLiteral);
      const bigDecimal = result.value as AST.BigDecimalLiteral;
      expect(bigDecimal.before).toBe(BigInt(3));
      expect(bigDecimal.after).toBe(BigInt(14));
    });

    it("should parse boolean literals", () => {
      const context = createParserContext("true");
      const result = literals().parse(context);

      assertSuccess(result);
      expect(result.value).toBeInstanceOf(AST.BooleanLiteral);
      expect((result.value as AST.BooleanLiteral).value).toBe(true);
    });

    it("should parse string literals", () => {
      const context = createParserContext('"hello world"');
      const result = literals().parse(context);

      assertSuccess(result);
      expect(result.value).toBeInstanceOf(AST.StringLiteral);
      expect((result.value as AST.StringLiteral).value).toBe("hello world");
    });

    it("should parse regex literals", () => {
      const context = createParserContext("/[a-z]+/g");
      const result = literals().parse(context);

      assertSuccess(result);
      expect(result.value).toBeInstanceOf(AST.RegexLiteral);
      const regex = result.value as AST.RegexLiteral;
      expect(regex.pattern).toBe("[a-z]+");
      expect(regex.flags).toBe("g");
    });
  });

  describe("array literals", () => {
    it("should parse empty array literals", () => {
      const context = createParserContext("[]");
      const result = arrayLiteral().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ArrayLiteral);
        expect((result.value as AST.ArrayLiteral).elements).toEqual([]);
      }
    });

    it("should parse array literals with elements", () => {
      const context = createParserContext("[1, 2, 3]");
      const result = arrayLiteral().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ArrayLiteral);
        const array = result.value as AST.ArrayLiteral;
        expect(array.elements).toHaveLength(3);
        expect(array.elements[0]).toBeInstanceOf(AST.IntegerLiteral);
        expect(array.elements[1]).toBeInstanceOf(AST.IntegerLiteral);
        expect(array.elements[2]).toBeInstanceOf(AST.IntegerLiteral);
      }
    });

    it("should parse nested array literals", () => {
      const context = createParserContext("[[1, 2], [3, 4]]");
      const result = arrayLiteral().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ArrayLiteral);
        const array = result.value as AST.ArrayLiteral;
        expect(array.elements).toHaveLength(2);
        expect(array.elements[0]).toBeInstanceOf(AST.ArrayLiteral);
        expect(array.elements[1]).toBeInstanceOf(AST.ArrayLiteral);
      }
    });
  });

  describe("record literals", () => {
    it("should parse empty record literals", () => {
      const context = createParserContext("{}");
      const result = recordLiteral().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RecordLiteral);
        expect((result.value as AST.RecordLiteral).fields).toEqual([]);
      }
    });

    it("should parse record literals with fields", () => {
      const context = createParserContext('{name: "John", age: 30}');
      const result = recordLiteral().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RecordLiteral);
        const record = result.value as AST.RecordLiteral;
        expect(record.fields).toHaveLength(2);
        expect(record.fields[0].name.text).toBe("name");
        expect(record.fields[0].value).toBeInstanceOf(AST.StringLiteral);
        expect(record.fields[1].name.text).toBe("age");
        expect(record.fields[1].value).toBeInstanceOf(AST.IntegerLiteral);
      }
    });
  });

  describe("parenthesized expressions", () => {
    it("should parse parenthesized expressions", () => {
      const context = createParserContext("(1 + 2)");
      const result = expression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BinaryExpression);
        const binary = result.value as AST.BinaryExpression;
        expect(binary.left).toBeInstanceOf(AST.IntegerLiteral);
        expect(binary.right).toBeInstanceOf(AST.IntegerLiteral);
        expect(binary.operator.text).toBe("+");
      }
    });
  });

  describe("unary expressions", () => {
    it("should parse unary minus", () => {
      const context = createParserContext("-42");
      const result = unaryExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.UnaryExpression);
        const unary = result.value as AST.UnaryExpression;
        expect(unary.operator.text).toBe("-");
        expect(unary.operand).toBeInstanceOf(AST.IntegerLiteral);
      }
    });

    it("should parse unary not", () => {
      const context = createParserContext("!true");
      const result = unaryExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.UnaryExpression);
        const unary = result.value as AST.UnaryExpression;
        expect(unary.operator.text).toBe("!");
        expect(unary.operand).toBeInstanceOf(AST.BooleanLiteral);
      }
    });
  });

  describe("binary expressions", () => {
    it("should parse addition", () => {
      const context = createParserContext("1 + 2");
      const result = binaryExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BinaryExpression);
        const binary = result.value as AST.BinaryExpression;
        expect(binary.operator.text).toBe("+");
        expect(binary.left).toBeInstanceOf(AST.IntegerLiteral);
        expect(binary.right).toBeInstanceOf(AST.IntegerLiteral);
      }
    });

    it("should parse multiplication", () => {
      const context = createParserContext("3 * 4");
      const result = binaryExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BinaryExpression);
        const binary = result.value as AST.BinaryExpression;
        expect(binary.operator.text).toBe("*");
      }
    });

    it("should respect operator precedence", () => {
      const context = createParserContext("1 + 2 * 3");
      const result = binaryExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BinaryExpression);
        const binary = result.value as AST.BinaryExpression;
        expect(binary.operator.text).toBe("+");
        expect(binary.right).toBeInstanceOf(AST.BinaryExpression);
        const rightBinary = binary.right as AST.BinaryExpression;
        expect(rightBinary.operator.text).toBe("*");
      }
    });

    it("should parse comparison operators", () => {
      const context = createParserContext("1 < 2");
      const result = binaryExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BinaryExpression);
        const binary = result.value as AST.BinaryExpression;
        expect(binary.operator.text).toBe("<");
      }
    });

    it("should parse logical operators", () => {
      const context = createParserContext("true && false");
      const result = binaryExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BinaryExpression);
        const binary = result.value as AST.BinaryExpression;
        expect(binary.operator.text).toBe("&&");
      }
    });
  });

  describe("function expressions", () => {
    it("should parse simple function expressions", () => {
      const context = createParserContext("fun(x: Int): Int => x + 1");
      const result = functionExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionExpression);
        const func = result.value as AST.FunctionExpression;
        expect(func.parameters).toHaveLength(1);
        expect(func.parameters[0].name.text).toBe("x");
        expect(func.returnType).toBeInstanceOf(AST.IntegerType);
      }
    });

    it("should parse function expressions with effects", () => {
      const context = createParserContext("fun(x: Int): {IO} Int => x + 1");
      const result = functionExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionExpression);
        const func = result.value as AST.FunctionExpression;
        expect(func.effects).toBeInstanceOf(AST.EffectRecordSignature);
      }
    });

    it("should parse function expressions with type parameters", () => {
      const context = createParserContext("fun<T>(x: T): T => x");
      const result = functionExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionExpression);
        const func = result.value as AST.FunctionExpression;
        expect(func.typeParameters).toHaveLength(1);
      }
    });
  });

  describe("match expressions", () => {
    it("should parse simple match expressions", () => {
      const context = createParserContext(`
        match x {
          1 => "one",
          _ => "other"
        }
      `);
      const result = matchExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.MatchExpression);
        const match = result.value as AST.MatchExpression;
        expect(match.cases).toHaveLength(2);
      }
    });

    it("should parse match expressions with guards", () => {
      const context = createParserContext(`
        match x {
          1 if x > 0 => "positive one",
          _ => "other"
        }
      `);
      const result = matchExpression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.MatchExpression);
        const match = result.value as AST.MatchExpression;
        expect(match.cases[0].guard).toBeInstanceOf(AST.BinaryExpression);
      }
    });
  });

  describe("return expression or block", () => {
    it("should parse arrow expression", () => {
      const context = createParserContext("=> 42");
      const result = returnExpressionOrBlock().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.IntegerLiteral);
      }
    });

    it("should parse block", () => {
      const context = createParserContext("=> { return 42 }");
      const result = returnExpressionOrBlock().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.Block);
      }
    });
  });

  describe("complex expressions", () => {
    it("should parse nested expressions", () => {
      const context = createParserContext("(1 + 2) * (3 - 4)");
      const result = expression().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      }
    });

    it("should parse function calls in expressions", () => {
      const context = createParserContext("add(1, 2) + 3");
      const result = expression().parse(context);

      expect(result.type).toBe("success");
    });
  });
});
