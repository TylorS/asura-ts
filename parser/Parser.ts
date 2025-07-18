import {
  Diagnostic,
  DiagnosticCode,
  DiagnosticCollection,
  DiagnosticFix,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
} from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import {
  GetSymbolName,
  getSymbolName,
  SymbolValue,
} from "../tokens/Symbols.ts";
import { Identifier, Symbol, Token } from "../tokens/Token.ts";
import { pipe, Pipeable, pipeArguments } from "./Pipeable.ts";

const EMPTY_SPAN = new Span(
  new SpanLocation(1, 1, 0),
  new SpanLocation(1, 1, 0),
);

export class ParserContext {
  private position: number = 0;
  private contextStack: ParsingContext[] = [];
  private recoveryHistory: RecoveryEvent[] = [];

  constructor(
    readonly fileName: string,
    readonly tokens: Token[],
    readonly diagnostics: DiagnosticCollection,
  ) {}

  // Basic token navigation
  peek(offset: number = 0): Token {
    return this.tokens[this.position + offset];
  }

  span(): Span {
    const token = this.peek();
    if (token !== undefined) {
      return token.span;
    }

    return this.tokens.at(-1)?.span ?? EMPTY_SPAN;
  }

  consume<K extends Token["kind"]>(): Extract<Token, { kind: K }> {
    if (this.position >= this.tokens.length) {
      throw new Error("Attempted to consume past end of tokens");
    }
    return this.tokens[this.position++] as Extract<Token, { kind: K }>;
  }

  consumeIf<B extends Token>(
    predicate: (token: Token) => token is B,
  ): B | null {
    const token = this.peek();
    if (token && predicate(token)) {
      return this.consume() as B;
    }
    return null;
  }

  isAtEnd(): boolean {
    return this.position >= this.tokens.length;
  }

  // Diagnostic helpers
  addFailure(
    failure: ParseError,
  ): Diagnostic {
    const diagnostic = new Diagnostic(
      failure.severity,
      failure.code,
      failure.message,
      failure.span,
      this.fileName,
      failure.fixes,
      failure.relatedInformation,
      // Transfer enhanced information from ParseError to Diagnostic
      failure.parsingContext,
      failure.expectedTokens,
      failure.actualToken,
      failure.parserStack,
      failure.recoveryAttempts,
    );

    this.diagnostics.add(diagnostic);

    return diagnostic;
  }

  // Token matching utilities
  expectToken<B extends Token>(
    predicate: (token: Token) => token is B,
    expectedMessage: string,
  ): B {
    const token = this.peek();
    if (!token) {
      const diagnostic = this.addFailure(
        ParseError.error(
          DiagnosticCode.PREMATURE_EOF,
          `Unexpected end of file, expected ${expectedMessage}`,
          this.tokens[this.tokens.length - 1].span,
        ),
      );
      throw new Error(`Parse error: ${diagnostic.message}`);
    }

    if (predicate(token)) {
      return this.consume() as B;
    }

    const diagnostic = this.addFailure(
      ParseError.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Expected ${expectedMessage}, got ${token.kind}`,
        token.span,
      ),
    );

    throw new Error(`Parse error: ${diagnostic.message}`);
  }

  getPosition(): number {
    return this.position;
  }

  setPosition(position: number): void {
    if (position < 0 || position > this.tokens.length) {
      throw new Error(`Invalid position: ${position}`);
    }
    this.position = position;
  }

  getTokensRemaining(): number {
    return this.tokens.length - this.position;
  }

  // Context stack management methods
  pushParsingContext(context: ParsingContext): void {
    this.contextStack.push(context);
  }

  popParsingContext(): ParsingContext | null {
    return this.contextStack.pop() || null;
  }

  getCurrentContext(): ParsingContext | null {
    return this.contextStack[this.contextStack.length - 1] || null;
  }

  getContextStack(): ParsingContext[] {
    return [...this.contextStack];
  }

  // Recovery point management
  markRecoveryPoint(): RecoveryPoint {
    return {
      position: this.position,
      diagnosticCount: this.diagnostics.getAll().length,
      timestamp: Date.now(),
    };
  }

  restoreToRecoveryPoint(point: RecoveryPoint): void {
    this.position = point.position;
    // Note: We don't remove diagnostics as they should be preserved for reporting
  }

  // Synchronization and virtual token insertion methods
  skipToSynchronizationPoint(predicate: SyncPredicate): void {
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (predicate(token, this)) {
        break;
      }
      this.consume();
    }
  }

  insertVirtualToken(tokenKind: string, span: Span): void {
    // Virtual tokens are conceptual - we record the insertion attempt
    // but don't modify the actual token stream
    this.addRecoveryError(
      ParseError.info(
        DiagnosticCode.INSERTED_TOKEN,
        `Inserted virtual ${tokenKind}`,
        span,
      ),
      "VirtualTokenInsertion",
    );
  }

  // Enhanced error reporting methods
  addRecoveryError(error: ParseError, recoveryStrategy: string): void {
    const recoveryEvent: RecoveryEvent = {
      strategy: recoveryStrategy,
      position: this.position,
      tokensSkipped: 0, // Will be updated by recovery strategies
      success: true, // Assume success unless specified otherwise
      message: error.message,
    };

    this.recoveryHistory.push(recoveryEvent);
    this.addFailure(error);
  }

  getRecoveryHistory(): RecoveryEvent[] {
    return [...this.recoveryHistory];
  }
}

export interface Parser<T> extends Pipeable {
  parse(context: ParserContext): ParseResult<T>;
}

export declare namespace Parser {
  // deno-lint-ignore no-explicit-any
  export type Any = Parser<any>;
  export type Type<T> = [T] extends [never] ? never
    : [T] extends [Parser<infer U>] ? U
    : never;
}

export type ParseResult<T> =
  | ParseSuccess<T>
  | ParseFailure<T>;

export class ParseSuccess<T> implements Pipeable {
  readonly type = "success";
  constructor(
    readonly value: T,
  ) {}

  pipe() {
    return pipeArguments(this, arguments);
  }
}

export class ParseFailure<T = never> {
  readonly type = "failure";
  constructor(
    readonly errors: ReadonlyArray<ParseError>,
    readonly partialResult?: T, // New: partial AST when available
  ) {}

  pipe() {
    return pipeArguments(this, arguments);
  }

  static error(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseFailure {
    return new ParseFailure([
      ParseError.error(code, message, span, fixes, relatedInformation),
    ]);
  }
  static warning(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseFailure {
    return new ParseFailure([
      ParseError.warning(code, message, span, fixes, relatedInformation),
    ]);
  }

  static info(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseFailure {
    return new ParseFailure([
      ParseError.info(code, message, span, fixes, relatedInformation),
    ]);
  }

  static hint(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseFailure {
    return new ParseFailure([
      ParseError.hint(code, message, span, fixes, relatedInformation),
    ]);
  }
}

// Enhanced error recovery types
export interface ErrorContext {
  parsingContexts: ParsingContext[];
  position: number;
  nearbyTokens: Token[];
  metadata: Record<string, unknown>;
}

export interface ParsingContext {
  name: string;
  expectedElements: string[];
  recoveryStrategies: string[];
  metadata: Record<string, unknown>;
}

export interface RecoveryAttempt {
  strategy: string;
  success: boolean;
  tokensSkipped: number;
  message: string;
}

// Recovery point and event interfaces
export interface RecoveryPoint {
  position: number;
  diagnosticCount: number;
  timestamp: number;
}

export interface RecoveryEvent {
  strategy: string;
  position: number;
  tokensSkipped: number;
  success: boolean;
  message: string;
}

// Synchronization predicate type
export type SyncPredicate = (token: Token, context: ParserContext) => boolean;

// Recovery result node types
export class RecoveredNode<T> {
  constructor(
    readonly value: T,
    readonly recoveryErrors: ParseError[],
    readonly span: Span,
  ) {}
}

export class PartialNode<T> {
  constructor(
    readonly nodeType: string,
    readonly completedFields: Partial<T>,
    readonly missingFields: string[],
    readonly errors: ParseError[],
    readonly span: Span,
  ) {}
}

export type PartialResult<T> = T | PartialNode<T>;

export class ParseError {
  constructor(
    readonly severity: DiagnosticSeverity,
    readonly code: DiagnosticCode,
    readonly message: string,
    readonly span: Span,
    readonly fixes: ReadonlyArray<DiagnosticFix>,
    readonly relatedInformation: ReadonlyArray<DiagnosticRelatedInformation>,
    // Enhanced error recovery information (optional)
    readonly parsingContext?: ErrorContext,
    readonly expectedTokens?: string[],
    readonly actualToken?: Token | null,
    readonly parserStack?: string[],
    readonly recoveryAttempts?: RecoveryAttempt[],
  ) {}

  addFix(fix: DiagnosticFix): ParseError {
    return new ParseError(
      this.severity,
      this.code,
      this.message,
      this.span,
      [...this.fixes, fix],
      this.relatedInformation,
      this.parsingContext,
      this.expectedTokens,
      this.actualToken,
      this.parserStack,
      this.recoveryAttempts,
    );
  }

  addRelatedInformation(
    relatedInformation: DiagnosticRelatedInformation,
  ): ParseError {
    return new ParseError(
      this.severity,
      this.code,
      this.message,
      this.span,
      this.fixes,
      [...this.relatedInformation, relatedInformation],
      this.parsingContext,
      this.expectedTokens,
      this.actualToken,
      this.parserStack,
      this.recoveryAttempts,
    );
  }

  static error(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseError {
    return new ParseError(
      DiagnosticSeverity.ERROR,
      code,
      message,
      span,
      fixes,
      relatedInformation,
    );
  }

  static warning(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseError {
    return new ParseError(
      DiagnosticSeverity.WARNING,
      code,
      message,
      span,
      fixes,
      relatedInformation,
    );
  }

  static info(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseError {
    return new ParseError(
      DiagnosticSeverity.INFO,
      code,
      message,
      span,
      fixes,
      relatedInformation,
    );
  }

  static hint(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseError {
    return new ParseError(
      DiagnosticSeverity.HINT,
      code,
      message,
      span,
      fixes,
      relatedInformation,
    );
  }

  // Enhanced factory method with context information
  static errorWithContext(
    code: DiagnosticCode,
    message: string,
    span: Span,
    context: ErrorContext,
    expectedTokens: string[] = [],
    actualToken: Token | null = null,
    fixes: ReadonlyArray<DiagnosticFix> = [],
    relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
  ): ParseError {
    return new ParseError(
      DiagnosticSeverity.ERROR,
      code,
      message,
      span,
      fixes,
      relatedInformation,
      context,
      expectedTokens,
      actualToken,
    );
  }
}

// ===== BASIC PARSER COMBINATORS =====

// Parse a specific token kind
export function token<K extends Token["kind"]>(
  kind: K,
): Parser<Extract<Token, { kind: K }>> {
  return {
    parse(context: ParserContext): ParseResult<Extract<Token, { kind: K }>> {
      const token = context.peek();
      if (!token) {
        return ParseFailure.error(
          DiagnosticCode.PREMATURE_EOF,
          `Unexpected end of file, expected ${kind}`,
          context.span(),
        );
      }

      if (token.kind === kind) {
        return new ParseSuccess(context.consume<K>());
      }

      return ParseFailure.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Expected ${kind}, got ${token.kind}`,
        token.span,
      );
    },
    pipe,
  };
}

export function symbol<K extends SymbolValue>(
  symbol: K,
): Parser<Symbol<GetSymbolName<K>>> {
  const kind = getSymbolName(symbol);

  return {
    parse(context: ParserContext): ParseResult<Symbol<GetSymbolName<K>>> {
      const token = context.peek();
      if (!token || token.kind !== "Symbol") {
        return ParseFailure.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Expected ${kind}, got ${token?.kind}`,
          token?.span ?? context.span(),
        );
      }

      if (token.symbol === kind) {
        return new ParseSuccess(context.consume() as Symbol<GetSymbolName<K>>);
      }

      return ParseFailure.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Expected ${kind}, got ${token.symbol}`,
        token.span,
      );
    },
    pipe,
  };
}

export function optional<T>(
  parser: Parser<T>,
): Parser<T | null> {
  return {
    parse(context: ParserContext): ParseResult<T | null> {
      const start = context.getPosition();
      const result = parser.parse(context);
      if (result.type === "success") {
        return result;
      }
      context.setPosition(start);
      return new ParseSuccess(null);
    },
    pipe,
  };
}

export function or<Parsers extends ReadonlyArray<Parser.Any>>(
  ...parsers: Parsers
): Parser<Parser.Type<Parsers[number]>> {
  return {
    parse(context: ParserContext): ParseResult<Parser.Type<Parsers[number]>> {
      const startPosition = context.getPosition();
      const failures: ParseError[] = [];

      for (const parser of parsers) {
        const result = parser.parse(context);
        if (result.type === "success") {
          return result;
        }

        context.setPosition(startPosition);
        failures.push(...result.errors);
      }

      return new ParseFailure(failures);
    },
    pipe,
  };
}

export function map<T, U>(
  mapper: (value: T) => U,
) {
  return (parser: Parser<T>): Parser<U> => {
    return {
      parse(context: ParserContext): ParseResult<U> {
        const result = parser.parse(context);
        if (result.type === "success") {
          return new ParseSuccess(mapper(result.value));
        }
        return new ParseFailure(result.errors);
      },
      pipe,
    };
  };
}

export function sequence<Parsers extends ReadonlyArray<Parser.Any>>(
  ...parsers: Parsers
): Parser<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> }> {
  return {
    parse(
      context: ParserContext,
    ): ParseResult<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> }> {
      const results: unknown[] = [];

      for (const parser of parsers) {
        const result = parser.parse(context);
        if (result.type === "success") {
          results.push(result.value);
        } else {
          return result;
        }
      }

      return new ParseSuccess(
        results as { [K in keyof Parsers]: Parser.Type<Parsers[K]> },
      );
    },
    pipe,
  };
}

export function seq<Parsers extends ReadonlyArray<Parser.Any>>(
  ...parsers: Parsers
): Parser<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> }> {
  return {
    parse(
      context: ParserContext,
    ): ParseResult<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> }> {
      const results: unknown[] = [];
      skipWhitespace(context);

      for (const parser of parsers) {
        const result = parser.parse(context);
        if (result.type === "success") {
          skipWhitespace(context);
          results.push(result.value);
        } else {
          return result;
        }
      }

      skipWhitespace(context);

      return new ParseSuccess(
        results as { [K in keyof Parsers]: Parser.Type<Parsers[K]> },
      );
    },
    pipe,
  };
}

export function zeroOrMore<T>(
  parser: Parser<T>,
): Parser<T[]> {
  return {
    parse(context: ParserContext): ParseResult<T[]> {
      const startPosition = context.getPosition();
      const results: T[] = [];
      while (!context.isAtEnd()) {
        const result = parser.parse(context);
        if (result.type === "success") {
          results.push(result.value);
        } else {
          break;
        }
      }
      if (results.length === 0) {
        context.setPosition(startPosition);
      }
      return new ParseSuccess(results);
    },
    pipe,
  };
}

export function oneOrMore<T>(
  parser: Parser<T>,
): Parser<T[]> {
  return {
    parse(context: ParserContext): ParseResult<T[]> {
      const startPosition = context.getPosition();
      const results: T[] = [];
      while (!context.isAtEnd()) {
        const result = parser.parse(context);
        if (result.type === "success") {
          results.push(result.value);
        } else {
          break;
        }
      }
      if (results.length < 1) {
        context.setPosition(startPosition);
        return ParseFailure.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Expected one or more`,
          context.span(),
        );
      }

      return new ParseSuccess(results);
    },
    pipe,
  };
}

export const WHITESPACE_OR_NEWLINE = or(token("Whitespace"), token("Newline"));

export function delimitedBy<U, V>(
  open: Parser<U>,
  close: Parser<V>,
) {
  return <T>(content: Parser<T>): Parser<{
    before: U;
    content: T;
    after: V;
  }> => {
    return seq(open, content, close).pipe(
      map(([before, content, after]) => ({ before, content, after })),
    );
  };
}

export function separatedBy<U>(
  separator: Parser<U>,
) {
  return <T>(parser: Parser<T>): Parser<T[]> => {
    return seq(parser, zeroOrMore(seq(separator, parser))).pipe(
      map(([first, rest]) => [first, ...rest.map(([_, value]) => value)]),
    );
  };
}

export function catchFailure<U>(
  f: (failure: ParseFailure<never>) => ParseResult<U>,
) {
  return <T>(parser: Parser<T>): Parser<T | U> => {
    return {
      parse(context: ParserContext): ParseResult<T | U> {
        const result = parser.parse(context);
        if (result.type === "failure") {
          return f(new ParseFailure(result.errors));
        }
        return result;
      },
      pipe,
    };
  };
}

export function lookAhead<T>(parser: Parser<T>): Parser<T> {
  return {
    parse(context: ParserContext): ParseResult<T> {
      const position = context.getPosition();
      const result = parser.parse(context);
      context.setPosition(position);
      return result;
    },
    pipe,
  };
}

export function notFollowedBy<T>(parser: Parser<T>): Parser<void> {
  return {
    parse(context: ParserContext): ParseResult<void> {
      const position = context.getPosition();
      const result = parser.parse(context);
      context.setPosition(position);

      if (result.type === "success") {
        return ParseFailure.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          "Unexpected token",
          context.span(),
        );
      }

      return new ParseSuccess(undefined);
    },
    pipe,
  };
}

export function lazy<T>(
  f: () => Parser<T>,
): Parser<T> {
  let parser: Parser<T> | null = null;

  return {
    parse(context: ParserContext): ParseResult<T> {
      if (parser === null) {
        parser = f();
      }
      return parser.parse(context);
    },
    pipe,
  };
}

// Type for operator parser: returns a function to combine left/right
type OperatorParser<T> = Parser<(left: T, right: T) => T>;

// Precedence level
export class PrecedenceLevel<T> {
  constructor(
    readonly ops: ReadonlyArray<OperatorParser<T>>,
    readonly assoc: "left" | "right" | "none",
  ) {}

  static left<T>(...ops: OperatorParser<T>[]) {
    return new PrecedenceLevel(ops, "left");
  }

  static right<T>(...ops: OperatorParser<T>[]) {
    return new PrecedenceLevel(ops, "right");
  }

  static none<T>(...ops: OperatorParser<T>[]) {
    return new PrecedenceLevel(ops, "none");
  }
}

// The precedence combinator
export function precedence<T>(
  atom: Parser<T>,
  levels: ReadonlyArray<PrecedenceLevel<T>>,
): Parser<T> {
  function makeLevel(index: number): Parser<T> {
    if (index >= levels.length) return atom;

    const { ops, assoc } = levels[index];
    const next = makeLevel(index + 1);

    if (assoc === "left") {
      // left-associative: a op b op c = ((a op b) op c)
      return {
        parse(ctx) {
          skipWhitespace(ctx);
          let result = next.parse(ctx);
          if (result.type !== "success") return result;
          skipWhitespace(ctx);

          while (!ctx.isAtEnd()) {
            let matched = false;
            for (const opParser of ops) {
              const opRes = opParser.parse(ctx);
              skipWhitespace(ctx);
              if (opRes.type === "success") {
                const right = next.parse(ctx);
                skipWhitespace(ctx);
                if (right.type !== "success") return right;
                result = new ParseSuccess(
                  opRes.value(result.value, right.value),
                );
                matched = true;
                break;
              }
            }
            if (!matched) break;
          }
          return result;
        },
        pipe,
      };
    }

    if (assoc === "right") {
      // right-associative: a op b op c = (a op (b op c))
      return {
        parse(ctx) {
          skipWhitespace(ctx);
          const result = next.parse(ctx);
          if (result.type !== "success") return result;

          for (const opParser of ops) {
            skipWhitespace(ctx);
            const opRes = opParser.parse(ctx);
            if (opRes.type === "success") {
              skipWhitespace(ctx);
              const right = makeLevel(index).parse(ctx);
              skipWhitespace(ctx);
              if (right.type !== "success") return right;
              return new ParseSuccess(opRes.value(result.value, right.value));
            }
          }
          return result;
        },
        pipe,
      };
    }

    // non-associative: only one op allowed at this level
    return {
      parse(ctx) {
        skipWhitespace(ctx);
        const result = next.parse(ctx);
        if (result.type !== "success") return result;

        for (const opParser of ops) {
          skipWhitespace(ctx);
          const opRes = opParser.parse(ctx);
          if (opRes.type === "success") {
            skipWhitespace(ctx);
            const right = next.parse(ctx);
            skipWhitespace(ctx);
            if (right.type !== "success") return right;
            return new ParseSuccess(opRes.value(result.value, right.value));
          }
        }
        return result;
      },
      pipe,
    };
  }
  return makeLevel(0);
}

function skipWhitespace(context: ParserContext) {
  let token = context.peek();

  while (
    token !== undefined &&
    (token.kind === "Whitespace" || token.kind === "Newline")
  ) {
    context.consume();
    token = context.peek();
  }
}

// Type for unary operator parser: returns a function to transform the operand
type UnaryOperatorParser<T> = Parser<(operand: T) => T>;

// Unary expression combinator for prefix operators only
export function unary<T>(
  atom: Parser<T>,
  prefixOps: ReadonlyArray<UnaryOperatorParser<T>>,
): Parser<T> {
  return {
    parse(ctx) {
      let result: ParseResult<T> | undefined;

      // Apply prefix operators
      for (const prefixOp of prefixOps) {
        const opRes = prefixOp.parse(ctx);
        if (opRes.type === "success") {
          result = atom.parse(ctx);
          if (result.type !== "success") return result;
          result = new ParseSuccess(opRes.value(result.value));
        }
      }

      if (result === undefined) return atom.parse(ctx);
      return result;
    },
    pipe,
  };
}

// Chain combinator for left-associative chaining (like method calls, property access)
export function chain<T, U>(
  op: Parser<U>,
  join: (left: T, right: U) => T,
) {
  return (atom: Parser<T>): Parser<T> => {
    return {
      parse(ctx) {
        let result: ParseResult<T> = atom.parse(ctx);
        if (result.type !== "success") return result;

        while (!ctx.isAtEnd()) {
          const opRes = op.parse(ctx);
          if (opRes.type !== "success") break;

          const right = atom.parse(ctx);
          if (right.type !== "success") return right;

          result = new ParseSuccess(join(result.value, opRes.value));
        }

        return result;
      },
      pipe,
    };
  };
}

export function literal<T extends string>(text: T): Parser<Identifier> {
  return {
    parse(context: ParserContext): ParseResult<Identifier> {
      const identifier = token("Identifier").parse(context);
      if (identifier.type !== "success") {
        return identifier;
      }

      if (identifier.value.text === text) {
        return new ParseSuccess<Identifier>(identifier.value);
      }

      return ParseFailure.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Expected ${text}, got ${identifier.value.text}`,
        identifier.value.span,
      );
    },
    pipe,
  };
}

export function keywordAsIdentifer(): Parser<Identifier> {
  return {
    parse(context: ParserContext): ParseResult<Identifier> {
      const token = context.peek();
      if ("asIdentifier" in token) {
        return new ParseSuccess(token.asIdentifier());
      }

      return ParseFailure.error(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Expected identifier, got ${token.kind}`,
        token.span,
      );
    },
    pipe,
  };
}
