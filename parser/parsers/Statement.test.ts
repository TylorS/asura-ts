import { describe, expect, it } from "vitest";
import * as AST from "../../ast/mod.ts";
import {
  DiagnosticCollection,
  formatDiagnostics,
} from "../../diagnostics/mod.ts";
import { tokenizeToArray } from "../../tokens/Tokenizer.ts";
import { ParserContext, ParseResult, ParseSuccess } from "../Parser.ts";
import { block, breakStatement, continueStatement, statement } from "./Statement.ts";

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
});
