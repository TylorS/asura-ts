import {
  Diagnostic,
  DiagnosticCode,
  DiagnosticCollection,
  DiagnosticFix,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
} from "../diagnostics/mod.ts";
import { Span } from "../tokens/Span.ts";
import { Token } from "../tokens/Token.ts";

export class ParserContext {
  private position: number = 0;

  constructor(
    readonly fileName: string,
    readonly tokens: Token[],
    readonly diagnostics: DiagnosticCollection,
  ) { }

  // Basic token navigation
  peek(offset: number = 0): Token {
    return this.tokens[this.position + offset];
  }

  span(): Span {
    const token = this.peek();
    if (token !== undefined) {
      return token.span;
    }

    throw new Error("No token to get span from");
  }

  consume(): Token {
    if (this.position >= this.tokens.length) {
      throw new Error("Attempted to consume past end of tokens");
    }
    return this.tokens[this.position++];
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
  addDiagnostic(
    parseError: ParseError,
  ): Diagnostic {
    const diagnostic = new Diagnostic(
      parseError.severity,
      parseError.code,
      parseError.message,
      parseError.span,
      this.fileName,
      parseError.fixes,
      parseError.relatedInformation,
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
      const diagnostic = this.addDiagnostic(
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

    const diagnostic = this.addDiagnostic(
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

  getTokensRemaining(): number {
    return this.tokens.length - this.position;
  }
}

export interface Parser<T> {
  parse(context: ParserContext): ParseResult<T>;
}

export type ParseResult<T> =
  | ParseSuccess<T>
  | ParseFailure
  | ParseErrorRecovery;

export class ParseSuccess<T> {
  readonly type = "success";
  constructor(
    readonly value: T,
  ) { }
}

export class ParseFailure {
  readonly type = "failure";
  constructor(
    readonly errors: ReadonlyArray<ParseError>,
  ) { }
}

export class ParseError {
  constructor(
    readonly severity: DiagnosticSeverity,
    readonly code: DiagnosticCode,
    readonly message: string,
    readonly span: Span,
    readonly fixes: ReadonlyArray<DiagnosticFix>,
    readonly relatedInformation: ReadonlyArray<DiagnosticRelatedInformation>,
  ) { }

  addFix(fix: DiagnosticFix): ParseError {
    return new ParseError(
      this.severity,
      this.code,
      this.message,
      this.span,
      [...this.fixes, fix],
      this.relatedInformation,
    );
  }

  addRelatedInformation(relatedInformation: DiagnosticRelatedInformation): ParseError {
    return new ParseError(
      this.severity,
      this.code,
      this.message,
      this.span,
      this.fixes,
      [...this.relatedInformation, relatedInformation],
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
}

export class ParseErrorRecovery {
  readonly type = "error-recovery";
  constructor(
    readonly strategies: ReadonlyArray<ErrorRecoveryStrategy>,
  ) { }
}

export type ErrorRecoveryStrategy =
  | SkipTokensStrategy
  | InsertTokenStrategy
  | ReplaceTokenStrategy;

export interface SkipTokensStrategy {
  readonly type: "skip-until-tokens";
  readonly until: ReadonlyArray<{ readonly kind: Token["kind"], readonly consume: boolean }>;
}

export interface InsertTokenStrategy {
  readonly type: "insert-token";
  readonly token: Token;
  readonly position: number
}

export interface ReplaceTokenStrategy {
  readonly type: "replace-token";
  readonly token: Token;
}
