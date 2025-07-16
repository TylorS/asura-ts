import { describe, expect, it } from "vitest";
import * as AST from "../../ast/mod.ts";
import { ParserContext, ParseResult, ParseSuccess } from "../Parser.ts";
import { tokenizeToArray } from "../../tokens/Tokenizer.ts";
import { DiagnosticCollection, formatDiagnostics } from "../../diagnostics/mod.ts";
import { sourceFile } from "./SourceFile.ts";

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

describe("SourceFile Parser", () => {
  it("should parse empty source file", () => {
    const context = createParserContext("");
    const result = sourceFile("test.ts").parse(context);
    
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBeInstanceOf(AST.SourceFile);
      const sourceFile = result.value as AST.SourceFile;
      expect(sourceFile.fileName).toBe("test.ts");
      expect(sourceFile.statements).toEqual([]);
    }
  });

  it("should parse source file with single statement", () => {
    const context = createParserContext("let x = 42;");
    const result = sourceFile("test.ts").parse(context);
    
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBeInstanceOf(AST.SourceFile);
      const sourceFile = result.value as AST.SourceFile;
      expect(sourceFile.fileName).toBe("test.ts");
      expect(sourceFile.statements).toHaveLength(1);
      expect(sourceFile.statements[0]).toBeInstanceOf(AST.LetDeclaration);
    }
  });

  it("should parse source file with multiple statements", () => {
    const context = createParserContext(`
      let x = 42;
      let y = "hello";
      fun add(a: Int, b: Int): Int => a + b;
    `);
    const result = sourceFile("test.ts").parse(context);
    
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBeInstanceOf(AST.SourceFile);
      const sourceFile = result.value as AST.SourceFile;
      expect(sourceFile.fileName).toBe("test.ts");
      expect(sourceFile.statements).toHaveLength(3);
      expect(sourceFile.statements[0]).toBeInstanceOf(AST.LetDeclaration);
      expect(sourceFile.statements[1]).toBeInstanceOf(AST.LetDeclaration);
      expect(sourceFile.statements[2]).toBeInstanceOf(AST.FunctionDeclaration);
    }
  });

  it("should parse source file with comments", () => {
    const source = `
      // This is a comment
      let x = 42;
      /* Multi-line
         comment */
      let y = "hello";
    `;
    const context = createParserContext(source);
    const result = sourceFile("test.ts").parse(context);
    
    assertSuccess(result, context, source);
    expect(result.value).toBeInstanceOf(AST.SourceFile);
    const file = result.value as AST.SourceFile;
    expect(file.statements).toHaveLength(4); // 2 comments + 2 declarations
    expect(file.statements[0]).toBeInstanceOf(AST.Comment);
    expect(file.statements[1]).toBeInstanceOf(AST.LetDeclaration);
    expect(file.statements[2]).toBeInstanceOf(AST.MultilineComment);
    expect(file.statements[3]).toBeInstanceOf(AST.LetDeclaration);
  });

  it("should parse source file with imports", () => {
    const context = createParserContext(`
      import { foo, bar } from "module";
      import * as utils from "utils";
      let x = foo();
    `);
    const result = sourceFile("test.ts").parse(context);
    
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBeInstanceOf(AST.SourceFile);
      const sourceFile = result.value as AST.SourceFile;
      expect(sourceFile.statements).toHaveLength(3);
      expect(sourceFile.statements[0]).toBeInstanceOf(AST.ImportDeclaration);
      expect(sourceFile.statements[1]).toBeInstanceOf(AST.ImportDeclaration);
      expect(sourceFile.statements[2]).toBeInstanceOf(AST.LetDeclaration);
    }
  });

  it("should parse source file with declarations", () => {
    const source = `
      fun add(x: Int, y: Int): Int => x + y;
      let result = add(1, 2);
      data Option<T> = Some(T) | None;
      effect IO { read: (String) => String };
      interface Printable { toString: () => String };
    `
    const context = createParserContext(source);
    const result = sourceFile("test.ts").parse(context);
    
    assertSuccess(result, context, source);
    expect(result.value).toBeInstanceOf(AST.SourceFile);
    const file = result.value as AST.SourceFile;
    expect(file.statements).toHaveLength(5);
    expect(file.statements[0]).toBeInstanceOf(AST.FunctionDeclaration);
    expect(file.statements[1]).toBeInstanceOf(AST.LetDeclaration);
    expect(file.statements[2]).toBeInstanceOf(AST.DataDeclaration);
    expect(file.statements[3]).toBeInstanceOf(AST.EffectDeclaration);
    expect(file.statements[4]).toBeInstanceOf(AST.InterfaceDeclaration);
  });

  it("should parse source file with control flow", () => {
    const context = createParserContext(`
      let x = 10;
      if (x > 0) {
        while (x > 0) {
          x = x - 1;
        }
      } else {
        x = 0;
      }
    `);
    const result = sourceFile("test.ts").parse(context);
    
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBeInstanceOf(AST.SourceFile);
      const sourceFile = result.value as AST.SourceFile;
      expect(sourceFile.statements).toHaveLength(2);
      expect(sourceFile.statements[0]).toBeInstanceOf(AST.LetDeclaration);
      expect(sourceFile.statements[1]).toBeInstanceOf(AST.IfStatement);
    }
  });

  it("should handle whitespace and newlines", () => {
    const context = createParserContext(`
      
      
      let x = 42;
      
      
      let y = "hello";
      
    `);
    const result = sourceFile("test.ts").parse(context);
    
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBeInstanceOf(AST.SourceFile);
      const sourceFile = result.value as AST.SourceFile;
      expect(sourceFile.statements).toHaveLength(2);
      expect(sourceFile.statements[0]).toBeInstanceOf(AST.LetDeclaration);
      expect(sourceFile.statements[1]).toBeInstanceOf(AST.LetDeclaration);
    }
  });

  it("should preserve span information", () => {
    const context = createParserContext("let x = 42;");
    const result = sourceFile("test.ts").parse(context);
    
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBeInstanceOf(AST.SourceFile);
      const sourceFile = result.value as AST.SourceFile;
      expect(sourceFile.span).toBeDefined();
      expect(sourceFile.span.start).toBeDefined();
      expect(sourceFile.span.end).toBeDefined();
    }
  });
}); 