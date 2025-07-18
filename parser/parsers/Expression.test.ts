import { describe, expect, it } from "vitest";
import * as AST from "../../ast/mod.ts";
import { formatDiagnostics } from "../../diagnostics/DiagnosticFormatter.ts";
import { DiagnosticCollection } from "../../diagnostics/mod.ts";
import { tokenizeToArray } from "../../tokens/Tokenizer.ts";
import { ParserContext, ParseResult, ParseSuccess } from "../Parser.ts";
import { expression, returnExpressionOrBlock } from "./Expression.ts";

function createParserContext(source: string): ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

function assertSuccess<T>(
  result: ParseResult<T>,
  context: ParserContext,
  source: string,
): asserts result is ParseSuccess<T> {
  try {
    expect(result.type).toBe("success");
  } catch (e) {
    if (result.type === "failure") {
      result.errors.forEach((error) => {
        context.addFailure(error);
      });
      console.log(formatDiagnostics(context.diagnostics.getAll(), source, {
        colorize: true,
      }));
    }

    throw e;
  }
}

describe("Expression Parser", () => {
  describe("literals", () => {
    it("should parse integer literals", () => {
      const source = "42";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.IntegerLiteral);
      expect((result.value as AST.IntegerLiteral).value).toBe(42);
    });

    it("should parse float literals", () => {
      const source = "3.14";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.FloatLiteral);
      expect((result.value as AST.FloatLiteral).value).toBe(3.14);
    });

    it("should parse big integer literals", () => {
      const source = "42n";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BigIntLiteral);
      expect((result.value as AST.BigIntLiteral).value).toBe(BigInt(42));
    });

    it("should parse big decimal literals", () => {
      const source = "3.14n";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BigDecimalLiteral);
      const bigDecimal = result.value as AST.BigDecimalLiteral;
      expect(bigDecimal.before).toBe(BigInt(3));
      expect(bigDecimal.after).toBe(BigInt(14));
    });

    it("should parse boolean literals", () => {
      const source = "true";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BooleanLiteral);
      expect((result.value as AST.BooleanLiteral).value).toBe(true);
    });

    it("should parse string literals", () => {
      const source = '"hello world"';
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.StringLiteral);
      expect((result.value as AST.StringLiteral).value).toBe("hello world");
    });

    it("should parse regex literals", () => {
      const source = "/[a-z]+/g";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.RegexLiteral);
      const regex = result.value as AST.RegexLiteral;
      expect(regex.pattern).toBe("[a-z]+");
      expect(regex.flags).toBe("g");
    });

    it("should parse regex literals with spaces", () => {
      const source = "/[a-z ]+/g ";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.RegexLiteral);
      const regex = result.value as AST.RegexLiteral;
      expect(regex.pattern).toBe("[a-z ]+");
      expect(regex.flags).toBe("g");
    });
  });

  describe("array literals", () => {
    it("should parse empty array literals", () => {
      const source = "[]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.ArrayLiteral);
      expect((result.value as AST.ArrayLiteral).elements).toEqual([]);
    });

    it("should parse array literals with elements", () => {
      const source = "[1, 2, 3]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.ArrayLiteral);
      const array = result.value as AST.ArrayLiteral;
      expect(array.elements).toHaveLength(3);
      expect(array.elements[0]).toBeInstanceOf(AST.IntegerLiteral);
      expect(array.elements[1]).toBeInstanceOf(AST.IntegerLiteral);
      expect(array.elements[2]).toBeInstanceOf(AST.IntegerLiteral);
    });

    it("should parse nested array literals", () => {
      const source = "[[1, 2], [3, 4]]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.ArrayLiteral);
      const array = result.value as AST.ArrayLiteral;
      expect(array.elements).toHaveLength(2);
      expect(array.elements[0]).toBeInstanceOf(AST.ArrayLiteral);
      expect(array.elements[1]).toBeInstanceOf(AST.ArrayLiteral);
    });
  });

  describe("record literals", () => {
    it("should parse empty record literals", () => {
      const source = "{}";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.RecordLiteral);
      expect((result.value as AST.RecordLiteral).fields).toEqual([]);
    });

    it("should parse record literals with fields", () => {
      const source = '{name: "John", age: 30}';
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.RecordLiteral);
      const record = result.value as AST.RecordLiteral;
      expect(record.fields).toHaveLength(2);
      expect(record.fields[0].name.text).toBe("name");
      expect(record.fields[0].value).toBeInstanceOf(AST.StringLiteral);
      expect(record.fields[1].name.text).toBe("age");
      expect(record.fields[1].value).toBeInstanceOf(AST.IntegerLiteral);
    });
  });

  describe("parenthesized expressions", () => {
    it("should parse parenthesized expressions", () => {
      const source = "(1 + 2)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.left).toBeInstanceOf(AST.IntegerLiteral);
      expect(binary.right).toBeInstanceOf(AST.IntegerLiteral);
      expect(binary.operator.text).toBe("+");
    });
  });

  describe("unary expressions", () => {
    it("should parse unary minus", () => {
      const source = "-42";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.UnaryExpression);
      const unary = result.value as AST.UnaryExpression;
      expect(unary.operator.text).toBe("-");
      expect(unary.operand).toBeInstanceOf(AST.IntegerLiteral);
    });

    it("should parse unary not", () => {
      const source = "!true";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.UnaryExpression);
      const unary = result.value as AST.UnaryExpression;
      expect(unary.operator.text).toBe("!");
      expect(unary.operand).toBeInstanceOf(AST.BooleanLiteral);
    });
  });

  describe("binary expressions", () => {
    it("should parse addition", () => {
      const source = "1 + 2";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("+");
      expect(binary.left).toBeInstanceOf(AST.IntegerLiteral);
      expect(binary.right).toBeInstanceOf(AST.IntegerLiteral);
    });

    it("should parse multiplication", () => {
      const source = "3 * 4";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("*");
    });

    it("should respect operator precedence", () => {
      const source = "1 + 2 * 3";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("+");
      expect(binary.right).toBeInstanceOf(AST.BinaryExpression);
      const rightBinary = binary.right as AST.BinaryExpression;
      expect(rightBinary.operator.text).toBe("*");
    });

    it("should parse comparison operators", () => {
      const source = "1 < 2";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("<");
    });

    it("should parse logical operators", () => {
      const source = "true && false";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("&&");
    });

    it("should parse assignment operators", () => {
      const source = "x = 5";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("=");
      expect(binary.left).toBeInstanceOf(AST.Identifier);
      expect(binary.right).toBeInstanceOf(AST.IntegerLiteral);
    });

    it("should parse compound assignment operators", () => {
      const source = "x += 10";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("+=");
    });

    it("should parse chained assignment expressions", () => {
      const source = "x = y = 5";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("=");
      expect(binary.left).toBeInstanceOf(AST.Identifier);
      expect(binary.right).toBeInstanceOf(AST.BinaryExpression);

      const rightBinary = binary.right as AST.BinaryExpression;
      expect(rightBinary.operator.text).toBe("=");
    });

    it("should respect assignment operator precedence", () => {
      const source = "x = 1 + 2 * 3";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("=");
      expect(binary.right).toBeInstanceOf(AST.BinaryExpression);

      const rightBinary = binary.right as AST.BinaryExpression;
      expect(rightBinary.operator.text).toBe("+");
    });
  });

  describe("function expressions", () => {
    it("should parse simple function expressions", () => {
      const source = "fun(x: Int): Int => x + 1";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.FunctionExpression);
      const func = result.value as AST.FunctionExpression;
      expect(func.parameters).toHaveLength(1);
      expect(func.parameters[0].name.text).toBe("x");
      expect(func.returnType).toBeInstanceOf(AST.IntegerType);
    });

    it("should parse function expressions with effects", () => {
      const source = "fun(x: Int): {IO} Int => x + 1";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.FunctionExpression);
      const func = result.value as AST.FunctionExpression;
      expect(func.effects).toBeInstanceOf(AST.EffectRecordSignature);
    });

    it("should parse function expressions with type parameters", () => {
      const source = "fun<T>(x: T): T => x";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.FunctionExpression);
      const func = result.value as AST.FunctionExpression;
      expect(func.typeParameters).toHaveLength(1);
    });
  });

  describe("match expressions", () => {
    it("should parse simple match expressions", () => {
      const source = `match x {
  1 => "one",
  _ => "other"
}`;
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.MatchExpression);
      const match = result.value as AST.MatchExpression;
      expect(match.cases).toHaveLength(2);
    });

    it("should parse match expressions with guards", () => {
      const source = `match x {
  1 if x > 0 => "positive one",
  _ => "other"
}`;
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.MatchExpression);
      const match = result.value as AST.MatchExpression;
      expect(match.cases[0].guard).toBeInstanceOf(AST.BinaryExpression);
    });
  });

  describe("return expression or block", () => {
    it("should parse arrow expression", () => {
      const source = "=> 42";
      const context = createParserContext(source);
      const result = returnExpressionOrBlock().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.IntegerLiteral);
    });

    it("should parse block", () => {
      const source = "=> { return 42 }";
      const context = createParserContext(source);
      const result = returnExpressionOrBlock().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.Block);
    });
  });

  describe("complex expressions", () => {
    it("should parse nested expressions", () => {
      const source = "(1 + 2) * (3 - 4)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.left).toBeInstanceOf(AST.BinaryExpression);
      expect(binary.right).toBeInstanceOf(AST.BinaryExpression);
      expect(binary.operator.text).toBe("*");

      const leftBinary = binary.left as AST.BinaryExpression;
      expect(leftBinary.left).toBeInstanceOf(AST.IntegerLiteral);
      expect(leftBinary.right).toBeInstanceOf(AST.IntegerLiteral);
      expect(leftBinary.operator.text).toBe("+");

      const rightBinary = binary.right as AST.BinaryExpression;
      expect(rightBinary.left).toBeInstanceOf(AST.IntegerLiteral);
      expect(rightBinary.right).toBeInstanceOf(AST.IntegerLiteral);
      expect(rightBinary.operator.text).toBe("-");
    });

    it("should parse function calls in expressions", () => {
      const source = "add(1, 2) + 3";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.BinaryExpression);
      const binary = result.value as AST.BinaryExpression;
      expect(binary.operator.text).toBe("+");
      expect(binary.left).toBeInstanceOf(AST.CallExpression);

      const call = binary.left as AST.CallExpression;
      expect(call.callee).toBeInstanceOf(AST.Identifier);
      expect((call.callee as AST.Identifier).text).toBe("add");
      expect(call.args).toHaveLength(2);
    });

    it("should parse function calls with no arguments", () => {
      const source = "foo()";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.CallExpression);
      const call = result.value as AST.CallExpression;
      expect(call.callee).toBeInstanceOf(AST.Identifier);
      expect((call.callee as AST.Identifier).text).toBe("foo");
      expect(call.args).toHaveLength(0);
    });

    it("should parse nested function calls", () => {
      const source = "foo(bar(1, 2), 3)";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.CallExpression);
      const call = result.value as AST.CallExpression;
      expect(call.args).toHaveLength(2);
      expect(call.args[0]).toBeInstanceOf(AST.CallExpression);
      expect(call.args[1]).toBeInstanceOf(AST.IntegerLiteral);
    });

    it("should parse property access", () => {
      const source = "x.y";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.PropertyAccess);
      const prop = result.value as AST.PropertyAccess;
      expect(prop.object).toBeInstanceOf(AST.Identifier);
      expect((prop.object as AST.Identifier).text).toBe("x");
      expect(prop.property).toBeInstanceOf(AST.Identifier);
      expect(prop.property.text).toBe("y");
    });

    it("should parse bracket access", () => {
      const source = "x[y]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.IndexAccess);
      const idx = result.value as AST.IndexAccess;
      expect(idx.object).toBeInstanceOf(AST.Identifier);
      expect((idx.object as AST.Identifier).text).toBe("x");
      expect(idx.index).toBeInstanceOf(AST.Identifier);
      expect((idx.index as AST.Identifier).text).toBe("y");
    });

    it("should parse method calls", () => {
      const source = "x.y()";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.CallExpression);
      const call = result.value as AST.CallExpression;
      expect(call.callee).toBeInstanceOf(AST.PropertyAccess);
      const prop = call.callee as AST.PropertyAccess;
      expect(prop.object).toBeInstanceOf(AST.Identifier);
      expect((prop.object as AST.Identifier).text).toBe("x");
      expect(prop.property).toBeInstanceOf(AST.Identifier);
      expect(prop.property.text).toBe("y");
      expect(call.args).toHaveLength(0);
    });

    it("should parse complex chained expressions", () => {
      const source = "foo.bar[0].baz(qux, 42)[x.y()]";
      const context = createParserContext(source);
      const result = expression().parse(context);

      assertSuccess(result, context, source);
      // Top-level: IndexAccess
      expect(result.value).toBeInstanceOf(AST.IndexAccess);
      const idx1 = result.value as AST.IndexAccess;
      // idx1.object: CallExpression (baz call)
      expect(idx1.object).toBeInstanceOf(AST.CallExpression);
      const call = idx1.object as AST.CallExpression;
      // call.callee: PropertyAccess (foo.bar[0].baz)
      expect(call.callee).toBeInstanceOf(AST.PropertyAccess);
      const bazProp = call.callee as AST.PropertyAccess;
      expect(bazProp.property.text).toBe("baz");
      // bazProp.object: IndexAccess (foo.bar[0])
      expect(bazProp.object).toBeInstanceOf(AST.IndexAccess);
      const idx0 = bazProp.object as AST.IndexAccess;
      // idx0.object: PropertyAccess (foo.bar)
      expect(idx0.object).toBeInstanceOf(AST.PropertyAccess);
      const barProp = idx0.object as AST.PropertyAccess;
      expect(barProp.object).toBeInstanceOf(AST.Identifier);
      expect((barProp.object as AST.Identifier).text).toBe("foo");
      expect(barProp.property.text).toBe("bar");
      // idx0.index: IntegerLiteral 0
      expect(idx0.index).toBeInstanceOf(AST.IntegerLiteral);
      expect((idx0.index as AST.IntegerLiteral).value).toBe(0);
      // call.args: [Identifier(qux), IntegerLiteral(42)]
      expect(call.args).toHaveLength(2);
      expect(call.args[0]).toBeInstanceOf(AST.Identifier);
      expect((call.args[0] as AST.Identifier).text).toBe("qux");
      expect(call.args[1]).toBeInstanceOf(AST.IntegerLiteral);
      expect((call.args[1] as AST.IntegerLiteral).value).toBe(42);
      // idx1.index: CallExpression (x.y())
      expect(idx1.index).toBeInstanceOf(AST.CallExpression);
      const call2 = idx1.index as AST.CallExpression;
      expect(call2.callee).toBeInstanceOf(AST.PropertyAccess);
      const yProp = call2.callee as AST.PropertyAccess;
      expect(yProp.object).toBeInstanceOf(AST.Identifier);
      expect((yProp.object as AST.Identifier).text).toBe("x");
      expect(yProp.property.text).toBe("y");
      expect(call2.args).toHaveLength(0);
    });
  });
});
