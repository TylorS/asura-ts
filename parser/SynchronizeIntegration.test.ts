import { describe, expect, it } from "vitest";
import { tokenizeToArray } from "../tokens/Tokenizer.ts";
import { DiagnosticCode, DiagnosticCollection } from "../diagnostics/mod.ts";
import {
  ParserContext,
  seq,
  synchronize,
  SyncPredicate,
  token,
} from "./Parser.ts";

function createParserContext(source: string): ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

describe("synchronize combinator integration", () => {
  it("should integrate with existing parser combinators", () => {
    // Test source with syntax error in the middle
    const source = "let x = invalid_token_here; let y = 42;";
    const context = createParserContext(source);

    // Create a parser that expects a number but will encounter an identifier
    const letDeclarationParser = seq(
      token("let"),
      token("Identifier"),
      token("Symbol"), // "="
      token("IntegerLiteral"), // This will fail on "invalid_token_here"
    );

    // Sync predicate to skip to semicolon
    const syncToSemicolon: SyncPredicate = (token) =>
      token.kind === "Symbol" && token.symbol === "Semicolon";

    const recoveringParser = synchronize(letDeclarationParser, syncToSemicolon);

    const result = recoveringParser.parse(context);

    // Should return null (synchronized) instead of failing completely
    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should be positioned at the semicolon
    expect(context.peek().kind).toBe("Symbol");
    expect(context.peek().symbol).toBe("Semicolon");

    // Should have recovery diagnostic
    const diagnostics = context.diagnostics.getAll();
    const recoveryDiagnostic = diagnostics.find((d) =>
      d.code === DiagnosticCode.RECOVERED_ERROR
    );
    expect(recoveryDiagnostic).toBeDefined();
  });

  it("should work with statement boundary synchronization", () => {
    const source = `
      let x = broken syntax here
      let y = 42;
    `;
    const context = createParserContext(source);

    // Skip initial whitespace/newlines
    while (
      context.peek()?.kind === "Whitespace" ||
      context.peek()?.kind === "Newline"
    ) {
      context.consume();
    }

    const letDeclarationParser = seq(
      token("let"),
      token("Identifier"),
      token("Symbol"), // "="
      token("IntegerLiteral"),
    );

    // Sync to next line (newline or next 'let' keyword)
    const syncToNextStatement: SyncPredicate = (token) =>
      token.kind === "Newline" || token.kind === "let";

    const recoveringParser = synchronize(
      letDeclarationParser,
      syncToNextStatement,
    );

    const result = recoveringParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should have found the newline or next statement
    const currentToken = context.peek();
    expect(currentToken.kind === "Newline" || currentToken.kind === "let").toBe(
      true,
    );
  });

  it("should handle complex nested synchronization scenarios", () => {
    const source = "fun broken( syntax here ) { let x = 42; }";
    const context = createParserContext(source);

    // Try to parse a function declaration but it has broken syntax
    const functionParser = seq(
      token("fun"),
      token("Identifier"),
      token("Symbol"), // "("
      token("Identifier"), // parameter name
      token("Symbol"), // ")"
      token("Symbol"), // "{"
    );

    // Sync to opening brace of function body
    const syncToFunctionBody: SyncPredicate = (token) =>
      token.kind === "Symbol" && token.symbol === "OpenBrace";

    const recoveringParser = synchronize(functionParser, syncToFunctionBody);

    const result = recoveringParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should be positioned at the opening brace
    expect(context.peek().kind).toBe("Symbol");
    expect(context.peek().symbol).toBe("OpenBrace");
  });

  it("should preserve error information from original parser", () => {
    const source = "let x = ;"; // Missing value
    const context = createParserContext(source);

    const letDeclarationParser = seq(
      token("let"),
      token("Identifier"),
      token("Symbol"), // "="
      token("IntegerLiteral"), // This will fail on ";"
    );

    const syncToSemicolon: SyncPredicate = (token) =>
      token.kind === "Symbol" && token.symbol === "Semicolon";

    const recoveringParser = synchronize(letDeclarationParser, syncToSemicolon);

    const result = recoveringParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should have both original error and recovery information
    const diagnostics = context.diagnostics.getAll();
    expect(diagnostics.length).toBeGreaterThan(0);

    // Should have recovery diagnostic
    const recoveryDiagnostic = diagnostics.find((d) =>
      d.code === DiagnosticCode.RECOVERED_ERROR
    );
    expect(recoveryDiagnostic).toBeDefined();
  });

  it("should work with custom sync predicates using context", () => {
    const source = "data broken syntax here } interface Test {}";
    const context = createParserContext(source);

    // Add parsing context to simulate being inside a data declaration
    context.pushParsingContext({
      name: "data-declaration",
      expectedElements: ["TypeName"],
      recoveryStrategies: ["sync-to-next-declaration"],
      metadata: {},
    });

    const dataDeclarationParser = seq(
      token("data"),
      token("Identifier"),
      token("Symbol"), // "="
    );

    // Sync to next top-level declaration keyword, considering context
    const syncToNextDeclaration: SyncPredicate = (token, ctx) => {
      const currentContext = ctx.getCurrentContext();
      return (token.kind === "interface" || token.kind === "fun") &&
        currentContext?.name === "data-declaration";
    };

    const recoveringParser = synchronize(
      dataDeclarationParser,
      syncToNextDeclaration,
    );

    const result = recoveringParser.parse(context);

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.value).toBe(null);
    }

    // Should be positioned at the 'interface' keyword
    expect(context.peek().kind).toBe("interface");
  });
});
