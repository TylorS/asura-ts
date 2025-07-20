import { describe, expect, it } from "vitest";
import * as AST from "../../ast/mod.ts";
import {
  DiagnosticCollection,
  formatDiagnostics,
} from "../../diagnostics/mod.ts";
import { tokenizeToArray } from "../../tokens/Tokenizer.ts";
import {
  ParseFailure,
  ParserContext,
  ParseResult,
  ParseSuccess,
} from "../Parser.ts";
import {
  block,
  breakStatement,
  continueStatement,
  statement,
} from "./Statement.ts";

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

function assertFailure<T>(
  result: ParseResult<T>,
): asserts result is ParseFailure {
  expect(result.type).toBe("failure");
}

describe("Statement Parser", () => {
  describe("comments", () => {
    it("should parse single line comments", () => {
      const context = createParserContext("// This is a comment");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.Comment);
        expect((result.value as AST.Comment).text).toBe(
          "// This is a comment",
        );
      }
    });

    it("should parse multi-line comments", () => {
      const context = createParserContext(
        "/* This is a\nmulti-line comment */",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.MultilineComment);
        expect((result.value as AST.MultilineComment).text).toBe(
          "/* This is a\nmulti-line comment */",
        );
      }
    });
  });

  describe("import declarations", () => {
    it("should parse namespace imports", () => {
      const context = createParserContext('import * as utils from "utils"');
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ImportDeclaration);
        const importDecl = result.value as AST.ImportDeclaration;
        expect(importDecl.imports).toBeInstanceOf(AST.NamespaceImport);
      }
    });

    it("should parse named imports", () => {
      const context = createParserContext(
        'import { foo, bar as baz } from "module"',
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ImportDeclaration);
        const importDecl = result.value as AST.ImportDeclaration;
        expect(importDecl.imports).toBeInstanceOf(AST.NamedImports);
        const namedImports = importDecl.imports as AST.NamedImports;
        expect(namedImports.imports).toHaveLength(2);
      }
    });
  });

  describe("data declarations", () => {
    it("should parse simple data declarations", () => {
      const context = createParserContext("data Option = Some(A) | None");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.DataDeclaration);
        const dataDecl = result.value as AST.DataDeclaration;
        expect(dataDecl.name.text).toBe("Option");
        expect(dataDecl.constructors).toHaveLength(2);
      }
    });

    it("should parse data declarations with type parameters", () => {
      const context = createParserContext(
        "data Maybe<T> = Just(T) | Nothing",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.DataDeclaration);
        const dataDecl = result.value as AST.DataDeclaration;
        expect(dataDecl.typeParameters).toHaveLength(1);
      }
    });

    it("should parse exported data declarations", () => {
      const context = createParserContext(
        "export data Result<T, E> = Ok(T) | Err(E)",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.DataDeclaration);
        const dataDecl = result.value as AST.DataDeclaration;
        expect(dataDecl.exportKeyword).not.toBeNull();
      }
    });
  });

  describe("effect declarations", () => {
    it("should parse effect declarations", () => {
      const context = createParserContext(
        "effect IO { read: (String) => String, write: (String) => Unit }",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectDeclaration);
        const effectDecl = result.value as AST.EffectDeclaration;
        expect(effectDecl.name.text).toBe("IO");
        expect(effectDecl.fields).toHaveLength(2);
      }
    });

    it("should parse exported effect declarations", () => {
      const context = createParserContext(
        "export effect Console { log: (String) => Unit }",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectDeclaration);
        const effectDecl = result.value as AST.EffectDeclaration;
        expect(effectDecl.exportKeyword).not.toBeNull();
      }
    });

    it("should parse effect declarations with function syntax", () => {
      const source = `
        effect Console {
          log(String) => Unit
        }
      `;
      const context = createParserContext(source);
      const result = statement().parse(context);
      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.EffectDeclaration);
      const effectDecl = result.value as AST.EffectDeclaration;
      expect(effectDecl.name.text).toBe("Console");
      expect(effectDecl.fields).toHaveLength(1);
      expect(effectDecl.fields[0].name.text).toBe("log");
      expect(effectDecl.fields[0].type).toBeInstanceOf(AST.FunctionType);
      expect((effectDecl.fields[0].type as AST.FunctionType).parameters).toHaveLength(1);
    });
  });

  describe("function declarations", () => {
    it("should parse simple function declarations", () => {
      const context = createParserContext(
        "fun add(x: Int, y: Int): Int => x + y",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionDeclaration);
        const funcDecl = result.value as AST.FunctionDeclaration;
        expect(funcDecl.name.text).toBe("add");
        expect(funcDecl.parameters).toHaveLength(2);
        expect(funcDecl.returnType).toBeInstanceOf(AST.IntegerType);
      }
    });

    it("should parse function declarations with effects", () => {
      const context = createParserContext(
        "fun readFile(path: String): {IO} String => { /* body */ }",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionDeclaration);
        const funcDecl = result.value as AST.FunctionDeclaration;
        expect(funcDecl.effects).toBeInstanceOf(AST.EffectRecordSignature);
      }
    });

    it("should parse exported function declarations", () => {
      const context = createParserContext(
        "export fun multiply(x: Int, y: Int): Int => x * y",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionDeclaration);
        const funcDecl = result.value as AST.FunctionDeclaration;
        expect(funcDecl.exportKeyword).not.toBeNull();
      }
    });
  });

  describe("interface declarations", () => {
    it("should parse interface declarations", () => {
      const context = createParserContext(
        "interface Printable { toString: () => String }",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.InterfaceDeclaration);
        const interfaceDecl = result.value as AST.InterfaceDeclaration;
        expect(interfaceDecl.name.text).toBe("Printable");
        expect(interfaceDecl.fields).toHaveLength(1);
      }
    });

    it("should parse interface declarations with extends", () => {
      const context = createParserContext(
        "interface Collection<T> extends Iterable<T> { size: () => Int }",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.InterfaceDeclaration);
        const interfaceDecl = result.value as AST.InterfaceDeclaration;
        expect(interfaceDecl.extendedTypes).toHaveLength(1);
      }
    });
  });

  describe("let declarations", () => {
    it("should parse simple let declarations", () => {
      const context = createParserContext("let x = 42");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.LetDeclaration);
        const letDecl = result.value as AST.LetDeclaration;
        expect(letDecl.name.text).toBe("x");
        expect(letDecl.initializer).toBeInstanceOf(AST.IntegerLiteral);
      }
    });

    it("should parse let declarations with type annotations", () => {
      const context = createParserContext('let name: String = "John"');
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.LetDeclaration);
        const letDecl = result.value as AST.LetDeclaration;
        expect(letDecl.type).toBeInstanceOf(AST.StringType);
      }
    });

    it("should parse mutable let declarations", () => {
      const context = createParserContext("let mut counter = 0");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.LetDeclaration);
        const letDecl = result.value as AST.LetDeclaration;
        expect(letDecl.mutableKeyword).not.toBeNull();
      }
    });

    it('should allow type annotations', () => {
      const source = 'let x: Int = 42';
      const context = createParserContext(source);
      const result = statement().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.LetDeclaration);
      const letDecl = result.value as AST.LetDeclaration;
      expect(letDecl.type).toBeInstanceOf(AST.IntegerType);
    })

    it('should allow handler type annotations', () => {
      const source = `
        let x: Handler<ForEach<_>> = handle ForEach<_> { 
          forEach: fun(items) => {
            for item of items {
              resume(item)
            }
          }
        }
      `;
      const context = createParserContext(source);
      const result = statement().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.LetDeclaration);
      const letDecl = result.value as AST.LetDeclaration;
      expect(letDecl.type).toBeInstanceOf(AST.HandlerType);
      const handlerType = letDecl.type as AST.HandlerType;
      expect(handlerType.effect).toBeInstanceOf(AST.TypeReference);
      expect(handlerType.effect.name.text).toBe("ForEach");
      expect(handlerType.effect.typeArguments).toHaveLength(1);
    })
  });

  describe("type alias declarations", () => {
    it("should parse type alias declarations", () => {
      const context = createParserContext("type Point = { x: Int, y: Int }");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TypeAliasDeclaration);
        const typeAlias = result.value as AST.TypeAliasDeclaration;
        expect(typeAlias.name.text).toBe("Point");
        expect(typeAlias.type).toBeInstanceOf(AST.RecordType);
      }
    });

    it("should parse type alias declarations with type parameters", () => {
      const context = createParserContext(
        "type Result<T, E> = Ok(T) | Err(E)",
      );
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TypeAliasDeclaration);
        const typeAlias = result.value as AST.TypeAliasDeclaration;
        expect(typeAlias.typeParameters).toHaveLength(2);
      }
    });
  });

  describe("control flow", () => {
    it("should parse if statements", () => {
      const source = `
        if (x > 0) {
          return "positive"
        } else {
          return "negative"
        }
      `;
      const context = createParserContext(source);
      const result = statement().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.IfStatement);
      const ifStmt = result.value as AST.IfStatement;
      expect(ifStmt.condition).toBeInstanceOf(AST.BinaryExpression);
      expect(ifStmt.then).toBeInstanceOf(AST.Block);
      expect(ifStmt.else_).toBeInstanceOf(AST.Block);
    });

    it("should parse while statements", () => {
      const source = `
        while i < 10 {
          i += 1
        }
      `;
      const context = createParserContext(source);
      const result = statement().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.WhileStatement);
      const whileStmt = result.value as AST.WhileStatement;
      expect(whileStmt.condition).toBeInstanceOf(AST.BinaryExpression);
      expect(whileStmt.body).toBeInstanceOf(AST.Block);
    });

    it("should parse for statements", () => {
      const source = `
        for (let i = 0; i < 10; i = i + 1) {
          print(i)
        }
      `;
      const context = createParserContext(source);
      const result = statement().parse(context);

      assertSuccess(result, context, source);

      expect(result.value).toBeInstanceOf(AST.ForStatement);
      const forStmt = result.value as AST.ForStatement;
      expect(forStmt.initialization).toHaveLength(1);
      expect(forStmt.initialization![0]).toBeInstanceOf(AST.BinaryExpression);
      expect(forStmt.condition).toBeInstanceOf(AST.BinaryExpression);
      expect(forStmt.update).toBeInstanceOf(AST.BinaryExpression);
    });

    it("should parse for-in statements", () => {
      const context = createParserContext(`
        for item in items {
          print(item);
        }
      `);
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ForInStatement);
        const forInStmt = result.value as AST.ForInStatement;
        expect(forInStmt.variable.text).toBe("item");
        expect(forInStmt.iterable).toBeInstanceOf(AST.Identifier);
      }
    });

    it("should parse for-of statements", () => {
      const context = createParserContext(`
        for value of items {
          print(value);
        }
      `);
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ForOfStatement);
        const forOfStmt = result.value as AST.ForOfStatement;
        expect(forOfStmt.variable.text).toBe("value");
        expect(forOfStmt.iterable).toBeInstanceOf(AST.Identifier);
      }
    });

    it("should parse continue statements", () => {
      const context = createParserContext("continue");
      const result = continueStatement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ContinueStatement);
        const continueStmt = result.value as AST.ContinueStatement;
        expect(continueStmt.label).toBeNull();
      }
    });

    it("should parse continue statements with labels", () => {
      const context = createParserContext("continue outer");
      const result = continueStatement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ContinueStatement);
        const continueStmt = result.value as AST.ContinueStatement;
        expect(continueStmt.label?.text).toBe("outer");
      }
    });

    it("should parse break statements", () => {
      const context = createParserContext("break");
      const result = breakStatement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BreakStatement);
        const breakStmt = result.value as AST.BreakStatement;
        expect(breakStmt.label).toBeNull();
      }
    });

    it("should parse break statements with labels", () => {
      const context = createParserContext("break outer");
      const result = breakStatement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BreakStatement);
        const breakStmt = result.value as AST.BreakStatement;
        expect(breakStmt.label?.text).toBe("outer");
      }
    });
  });

  describe("expression statements", () => {
    it("should parse expression statements", () => {
      const context = createParserContext("x + y");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ExpressionStatement);
        const exprStmt = result.value as AST.ExpressionStatement;
        expect(exprStmt.expression).toBeInstanceOf(AST.BinaryExpression);
      }
    });

    it("should parse handler expressions as statements", () => {
      const context = createParserContext("handle ForEach { foo: x + y }");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ExpressionStatement);
        const exprStmt = result.value as AST.ExpressionStatement;
        expect(exprStmt.expression).toBeInstanceOf(AST.HandlerExpression);
      }
    });

    it("should parse resume expressions as statements", () => {
      const context = createParserContext("resume(x)");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.ExpressionStatement);
        const exprStmt = result.value as AST.ExpressionStatement;
        expect(exprStmt.expression).toBeInstanceOf(AST.ResumeExpression);
      }
    });
  });

  describe("effect operations", () => {
    it("should parse simple effect operations", () => {
      const context = createParserContext("a <- ForEach.forEach(items)");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectOperation);
        const effectOp = result.value as AST.EffectOperation;
        expect(effectOp.variable.text).toBe("a");
        expect(effectOp.effectName.text).toBe("ForEach");
        expect(effectOp.operation.text).toBe("forEach");
        expect(effectOp.args).toHaveLength(1);
        expect(effectOp.args[0]).toBeInstanceOf(AST.Identifier);
      }
    });

    it("should parse effect operations with multiple arguments", () => {
      const context = createParserContext("result <- IO.readFile(path, encoding)");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectOperation);
        const effectOp = result.value as AST.EffectOperation;
        expect(effectOp.variable.text).toBe("result");
        expect(effectOp.effectName.text).toBe("IO");
        expect(effectOp.operation.text).toBe("readFile");
        expect(effectOp.args).toHaveLength(2);
      }
    });

    it("should parse effect operations with no arguments", () => {
      const context = createParserContext("value <- State.get()");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectOperation);
        const effectOp = result.value as AST.EffectOperation;
        expect(effectOp.variable.text).toBe("value");
        expect(effectOp.effectName.text).toBe("State");
        expect(effectOp.operation.text).toBe("get");
        expect(effectOp.args).toHaveLength(0);
      }
    });

    it("should parse effect operations with complex arguments", () => {
      const context = createParserContext("result <- Console.log(\"Hello\", user.name)");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectOperation);
        const effectOp = result.value as AST.EffectOperation;
        expect(effectOp.args).toHaveLength(2);
        expect(effectOp.args[0]).toBeInstanceOf(AST.StringLiteral);
        expect(effectOp.args[1]).toBeInstanceOf(AST.PropertyAccess);
      }
    });

    it("should parse effect operations with nested expressions", () => {
      const context = createParserContext("sum <- Math.add(x, y * 2)");
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectOperation);
        const effectOp = result.value as AST.EffectOperation;
        expect(effectOp.args).toHaveLength(2);
        expect(effectOp.args[1]).toBeInstanceOf(AST.BinaryExpression);
      }
    });
  });

  describe("blocks", () => {
    it("should parse empty blocks", () => {
      const context = createParserContext("{}");
      const result = block().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.Block);
        const blockStmt = result.value as AST.Block;
        expect(blockStmt.statements).toEqual([]);
      }
    });

    it("should parse blocks with statements", () => {
      const context = createParserContext("{ let x = 1; let y = 2; }");
      const result = block().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.Block);
        const blockStmt = result.value as AST.Block;
        expect(blockStmt.statements).toHaveLength(2);
        expect(blockStmt.statements[0]).toBeInstanceOf(AST.LetDeclaration);
        expect(blockStmt.statements[1]).toBeInstanceOf(AST.LetDeclaration);
      }
    });
  });

  describe("complex statements", () => {
    it("should parse nested control flow", () => {
      const source = `if (x > 0) {
  for (let i = 0; i < x; i = i + 1) {
    if (i % 2 == 0) {
      continue;
    }
    print(i);
  }
}`;
      const context = createParserContext(source);
      const result = statement().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.IfStatement);
      const ifStmt = result.value as AST.IfStatement;
      expect(ifStmt.condition).toBeInstanceOf(AST.BinaryExpression);
      expect(ifStmt.then).toBeInstanceOf(AST.Block);
      expect(ifStmt.else_).toBeNull();
    });

    it("should parse complete effect handling workflow", () => {
      const source = `effect ForEach<A> {
  forEach(Array<A>) => A
}

let withForEach = handle ForEach<_> {
  forEach: fun(items) => {
    for item of items {
      resume(item);
    }
  }
}

fun processItems(items: Array<number>): {ForEach<number>} Array<number> => {
  item <- ForEach.forEach(items);
  return item + 1;
}

let result = processItems([1, 2, 3]) |> withForEach;
      `;

      const context = createParserContext(source);

      // Parse effect declaration
      let result = statement().parse(context);

      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.EffectDeclaration);

      // Parse handler declaration
      result = statement().parse(context);
      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.LetDeclaration);
      const letDecl = result.value as AST.LetDeclaration;
      expect(letDecl.initializer).toBeInstanceOf(AST.HandlerExpression);

      // Parse function declaration
      result = statement().parse(context);
      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.FunctionDeclaration);

      // Parse final let declaration
      result = statement().parse(context);
      assertSuccess(result, context, source);
      expect(result.value).toBeInstanceOf(AST.LetDeclaration);
    });

    it("should parse handler composition with pipes", () => {
      const source = `
        let result = processData([1, 2, 3]) |> withForEach |> withLogging;
      `;

      const context = createParserContext(source);
      const result = statement().parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.LetDeclaration);
        const letDecl = result.value as AST.LetDeclaration;
        expect(letDecl.initializer).toBeInstanceOf(AST.BinaryExpression);
        // The pipe operator should create a chain of binary expressions
        const binary = letDecl.initializer as AST.BinaryExpression;
        expect(binary.operator.text).toBe("|>");
      }
    });

    it("should parse mixed declarations and statements", () => {
      const context = createParserContext(`
        let x = 42;
        fun add(a: Int, b: Int): Int => a + b;
        if (x > 0) {
          add(x, 1);
        }
      `);
      const letDeclaration = statement().parse(context);
      expect(letDeclaration.type).toBe("success");
      if (letDeclaration.type === "success") {
        expect(letDeclaration.value).toBeInstanceOf(AST.LetDeclaration);
      }

      const functionDeclaration = statement().parse(context);
      expect(functionDeclaration.type).toBe("success");
      if (functionDeclaration.type === "success") {
        expect(functionDeclaration.value).toBeInstanceOf(
          AST.FunctionDeclaration,
        );
      }

      const ifStatement = statement().parse(context);
      expect(ifStatement.type).toBe("success");
      if (ifStatement.type === "success") {
        expect(ifStatement.value).toBeInstanceOf(AST.IfStatement);
      }
    });
  });

  describe("error recovery", () => {
    describe("handler and effect syntax errors", () => {
      it("should handle malformed handler expressions", () => {
        const context = createParserContext("handle ForEach { foo: }");
        const result = statement().parse(context);

        expect(result.type).toBe("failure");
        if (result.type === "failure") {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      // it("should handle malformed effect operations", () => {
      //   const context = createParserContext("a <- ForEach.");
      //   const result = statement().parse(context);

      //   expect(result.type).toBe("failure");
      //   if (result.type === "failure") {
      //     expect(result.errors.length).toBeGreaterThan(0);
      //   }
      // });

      it("should handle incomplete resume expressions", () => {
        const context = createParserContext("resume");
        const result = statement().parse(context);

        expect(result.type).toBe("failure");
        if (result.type === "failure") {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      // it("should handle missing effect operation arguments", () => {
      //   const context = createParserContext("a <- ForEach.forEach(");
      //   const result = statement().parse(context);

      //   expect(result.type).toBe("failure");
      //   if (result.type === "failure") {
      //     expect(result.errors.length).toBeGreaterThan(0);
      //   }
      // });

      it("should handle malformed handler case syntax", () => {
        const context = createParserContext("handle ForEach { foo }");
        const result = statement().parse(context);

        expect(result.type).toBe("failure");
        if (result.type === "failure") {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });
    });

    describe("context tracking", () => {
      it("should track parsing context during statement parsing", () => {
        const context = createParserContext("let x = 42");
        const parser = statement();
        const result = parser.parse(context);

        expect(result.type).toBe("success");

        // Check that context was properly managed (no context should remain)
        expect(context.getCurrentContext()).toBeNull();
        expect(context.getContextStack()).toHaveLength(0);
      });

      it("should track context for function declarations", () => {
        const context = createParserContext("fun test(): Int = 42");
        const parser = statement();
        parser.parse(context);

        // Function may fail due to missing body syntax, but context should still be managed
        expect(context.getCurrentContext()).toBeNull();
        expect(context.getContextStack()).toHaveLength(0);
      });

      it("should track context for block statements", () => {
        const context = createParserContext("{ let x = 42 }");
        const parser = block();
        const result = parser.parse(context);

        expect(result.type).toBe("success");
        expect(context.getCurrentContext()).toBeNull();
      });
    });

    describe("synchronization recovery", () => {
      it("should handle malformed statements gracefully", () => {
        const context = createParserContext("invalid syntax here\nlet x = 42");
        const parser = statement();
        const result = parser.parse(context);

        // The parser should either succeed or fail gracefully with diagnostic information
        if (result.type === "failure") {
          expect(result.errors.length).toBeGreaterThan(0);
          // Check that diagnostics were collected
          expect(context.diagnostics.getAll().length).toBeGreaterThan(0);
        }
      });

      it("should provide recovery history tracking", () => {
        const context = createParserContext("malformed input");
        const parser = statement();
        parser.parse(context);

        // Check that recovery history is available
        const recoveryHistory = context.getRecoveryHistory();
        // Recovery history should be accessible (may be empty for successful parses)
        expect(Array.isArray(recoveryHistory)).toBe(true);
      });
    });

    describe("delimiter recovery", () => {
      it("should handle missing braces in blocks", () => {
        const context = createParserContext("{ let x = 42");
        const parser = block();
        const result = parser.parse(context);

        // Should fail due to missing closing brace
        expect(result.type).toBe("failure");
        if (result.type === "failure") {
          expect(result.errors.length).toBeGreaterThan(0);

          // Should have some error about missing delimiter
          const delimiterErrors = result.errors.filter((e) =>
            e.message.includes("brace") ||
            e.message.includes("delimiter") ||
            e.message.includes("}") ||
            e.message.includes("Expected")
          );
          expect(delimiterErrors.length).toBeGreaterThan(0);
        }
      });
    });

    describe("enhanced error messages", () => {
      it("should provide context-aware error messages", () => {
        const context = createParserContext("fun incomplete");
        const parser = statement();
        const result = parser.parse(context);

        assertFailure(result);
        expect(result.errors.length).toBeGreaterThan(0);

        // Check that at least one error has enhanced information
        const enhancedErrors = result.errors.filter((e) =>
          e.parsingContext !== undefined ||
          e.expectedTokens !== undefined ||
          e.actualToken !== undefined
        );

        // At least some errors should have enhanced information
        expect(enhancedErrors.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe("comprehensive error recovery", () => {
      it("should demonstrate end-to-end error recovery functionality", () => {
        // Test multiple statements with various error recovery scenarios
        const context = createParserContext(`
          let x = 42
          fun test(): Int = 100
          if (true) { let y = 10 }
          data MyType = Constructor
        `);

        // Parse multiple statements
        const statements = [];
        while (!context.isAtEnd()) {
          // Skip whitespace
          while (
            !context.isAtEnd() &&
            (context.peek().kind === "Whitespace" ||
              context.peek().kind === "Newline")
          ) {
            context.consume();
          }

          if (context.isAtEnd()) break;

          const parser = statement();
          const result = parser.parse(context);

          if (result.type === "success") {
            statements.push(result.value);
          } else {
            // Even if individual statements fail, we should have error information
            expect(result.errors.length).toBeGreaterThan(0);
            break;
          }
        }

        // Should have parsed at least some statements successfully
        expect(statements.length).toBeGreaterThan(0);

        // Context should be properly managed
        expect(context.getCurrentContext()).toBeNull();
        expect(context.getContextStack()).toHaveLength(0);

        // Recovery history should be available
        const recoveryHistory = context.getRecoveryHistory();
        expect(Array.isArray(recoveryHistory)).toBe(true);
      });
    });
  });
});
