import * as AST from "../ast/mod.ts";
import { Span } from "../ast/Span.ts";
import { ExpressionStatement } from "../ast/Statement/mod.ts";
import { SpanLocation } from "./Span.ts";

const Terminals = {
  BigFloat: /^[0-9]+(\.[0-9]+)?n/,
  Boolean: /^(true|false)/,
  Comment: /^\/\/.*/,
  Float: /^[0-9]+(\.[0-9]+)?/,
  Identifier: /^[a-zA-Z_][a-zA-Z0-9_]*/,
  MultiLineComment: /^\/\*[\s\S]*\*\//,
  Newline: /^\n/,
  String: /^"[^"]*"/,
  Whitespace: /^\s+/,
};

export class TokenizerState {
  private line: number = 0;
  private column: number = 0;
  private character: number = 0;

  constructor(readonly source: string) {}

  peek() {
    return this.source[this.character];
  }

  slice(length: number) {
    return this.source.slice(this.character, this.character + length);
  }

  next() {
    const char = this.source[this.character];
    if (char === "\n") {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    this.character++;
    return char;
  }

  isEndOfFile() {
    return this.character >= this.source.length;
  }

  spanLocation(): SpanLocation {
    return new SpanLocation(this.line, this.column, this.character);
  }

  terminal(regex: RegExp) {
    const match = regex.exec(this.source.slice(this.character));
    if (match) {
      this.character += match[0].length;
      return match[0];
    }
    return null;
  }
}

export function* tokenize(source: string) {
  const state = new TokenizerState(source);

  while (!state.isEndOfFile()) {
    yield* tokenizeStatments(state);
  }
}

function* tokenizeStatments(state: TokenizerState) {
  while (!state.isEndOfFile()) {
    yield* tokenizeStatement(state);
  }
}

function* tokenizeStatement(state: TokenizerState) {
  const char = state.peek();
  if (char === "(") {
    return yield* tokenizeExpressionStatementFromOpenParenthesis(state);
  }

  // BreakStatement
  // ContinueStatement
  // ForInStatement
  // ForOfStatement
  // ForStatement
  // IfStatement with else if and else
  // ReturnStatement
  // WhileStatement

  // DataDeclaration
  // EffectDeclaration
  // FunctionDeclaration
  // ImportDeclaration
  // InterfaceDeclaration
  // LetDeclaration
  // TypeAliasDeclaration

  // Comment
  // MultiLineComment
}

function* tokenizeExpressionStatementFromOpenParenthesis(state: TokenizerState) {
  const openParenthesisSpan = state.spanLocation();
  state.next();
  const char = state.peek();
  
  // We don't care about empty
  if (char === ")") {
    return;
  }

  for (const expression of tokenizeExpression(state)) {
    yield new ExpressionStatement(expression, new Span(openParenthesisSpan, state.spanLocation()));
  }
}

function* tokenizeExpression(state: TokenizerState) {}

function* tokenizeBinaryExpression(state: TokenizerState) {}

function* tokenizeFunctionExpression(state: TokenizerState) {}

function* tokenizeMatchExpression(state: TokenizerState) {}

function* tokenizeLiteral(state: TokenizerState) {
  // ArrayLiteral
  // BigDecimalLiteral
  // BigIntLiteral
  // BooleanLiteral
  // FloatLiteral
  // IntegerLiteral
  // RecordLiteral
  // RegexLiteral
  // StringLiteral
}

function* tokenizeIdentifier(state: TokenizerState) {}

function* tokenizeTypeArguments(state: TokenizerState) {}

function* tokenizeTypeParameters(state: TokenizerState) {}

function* tokenizeTypeParameter(state: TokenizerState) { }

function* tokenizeType(state: TokenizerState) { 
  // ArrayType
  // BigDecimalType | BigDecimalLiteralType
  // BigIntType | BigIntLiteralType
  // BooleanType | BooleanLiteralType
  // EffectType
  // FloatType | FloatLiteralType
  // FunctionType
  // IntersectionType
  // IntType | IntegerLiteralType
  // RecordLiteralType
  // RegexLiteralType
  // StringLiteralType
  // TupleLiteralType
  // TypeReference
  // UnionType

}

function* tokenizeTypeReference(state: TokenizerState) { }
