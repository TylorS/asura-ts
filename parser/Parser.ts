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
import type { RecoveryStrategy } from "./ErrorRecovery.ts";
import {
  BoundedContextStack,
  BoundedRecoveryHistory,
  DEFAULT_RECOVERY_PERFORMANCE_CONFIG,
  FastPathOptimizer,
  type RecoveryPerformanceConfig,
  RecoveryPerformanceManager,
} from "./PerformanceOptimizations.ts";

const EMPTY_SPAN = new Span(
  new SpanLocation(1, 1, 0),
  new SpanLocation(1, 1, 0),
);

export class ParserContext {
  private position: number = 0;
  private contextStack: BoundedContextStack;
  private recoveryHistory: BoundedRecoveryHistory;
  private performanceManager: RecoveryPerformanceManager;
  private fastPathOptimizer: FastPathOptimizer;

  constructor(
    readonly fileName: string,
    readonly tokens: Token[],
    readonly diagnostics: DiagnosticCollection,
    performanceConfig?: RecoveryPerformanceConfig,
  ) {
    const config = performanceConfig ?? DEFAULT_RECOVERY_PERFORMANCE_CONFIG;
    this.contextStack = new BoundedContextStack(config.maxContextStackDepth);
    this.recoveryHistory = new BoundedRecoveryHistory(
      config.maxRecoveryHistorySize,
    );
    this.performanceManager = new RecoveryPerformanceManager(config);
    this.fastPathOptimizer = new FastPathOptimizer();
  }

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
    if (!this.contextStack.push(context)) {
      // Context stack is at maximum depth, record warning
      const warning = ParseError.warning(
        DiagnosticCode.PARSER_LIMIT_EXCEEDED,
        `Context stack depth limit reached (${this.contextStack.depth()}), ignoring context push`,
        this.span(),
      );
      this.addFailure(warning);
    }
  }

  popParsingContext(): ParsingContext | null {
    return this.contextStack.pop();
  }

  getCurrentContext(): ParsingContext | null {
    return this.contextStack.getCurrent();
  }

  getContextStack(): ParsingContext[] {
    return this.contextStack.getStack();
  }

  // Recovery point management
  markRecoveryPoint(): RecoveryPoint {
    // Check cache first for performance optimization
    const cachedPoint = this.performanceManager.getCachedRecoveryPoint(this);
    if (cachedPoint) {
      return cachedPoint;
    }

    const point: RecoveryPoint = {
      position: this.position,
      diagnosticCount: this.diagnostics.getAll().length,
      timestamp: Date.now(),
    };

    // Cache the recovery point for future use
    this.performanceManager.cacheRecoveryPoint(this, point);
    return point;
  }

  restoreToRecoveryPoint(point: RecoveryPoint): void {
    this.position = point.position;
    // Note: We don't remove diagnostics as they should be preserved for reporting
  }

  // Synchronization and virtual token insertion methods
  skipToSynchronizationPoint(predicate: SyncPredicate): void {
    // Activate recovery if not already active
    this.performanceManager.activateRecovery();

    // Use predicate-based skipping with bounded limits to prevent infinite loops
    let tokensSkipped = 0;
    const maxSkip = 50; // Reasonable limit for synchronization

    while (!this.isAtEnd() && tokensSkipped < maxSkip) {
      const token = this.peek();
      if (predicate(token, this)) {
        break;
      }
      this.consume();
      tokensSkipped++;
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
    // Activate recovery if not already active
    this.performanceManager.activateRecovery();

    // Increment recovery attempts
    this.performanceManager.incrementRecoveryAttempts();

    // Record error for fast path optimization
    this.fastPathOptimizer.recordError();

    const recoveryEvent: RecoveryEvent = {
      strategy: recoveryStrategy,
      position: this.position,
      tokensSkipped: 0, // Will be updated by recovery strategies
      success: true, // Assume success unless specified otherwise
      message: error.message,
    };

    this.recoveryHistory.addEvent(recoveryEvent);
    this.addFailure(error);

    // Manage recovery history size to prevent memory bloat
    this.performanceManager.manageRecoveryHistory(this);
  }

  getRecoveryHistory(): RecoveryEvent[] {
    return this.recoveryHistory.getEvents();
  }

  // Performance optimization methods

  /**
   * Check if fast path parsing is enabled (no errors encountered)
   */
  isFastPathEnabled(): boolean {
    return this.fastPathOptimizer.isFastPathEnabled();
  }

  /**
   * Check if recovery is currently active
   */
  isRecoveryActive(): boolean {
    return this.performanceManager.isRecoveryActivated();
  }

  /**
   * Check if recovery attempt limit has been reached
   */
  canAttemptRecovery(): boolean {
    return this.performanceManager.canAttemptRecovery();
  }

  /**
   * Reset performance optimizers for new parsing operation
   */
  resetPerformanceOptimizers(): void {
    this.performanceManager.resetRecovery();
    this.fastPathOptimizer.reset();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    isRecoveryActive: boolean;
    recoveryAttempts: number;
    cacheSize: number;
    cacheHitRate: number;
    errorCount: number;
    isFastPathEnabled: boolean;
  } {
    const managerStats = this.performanceManager.getPerformanceStats();
    return {
      ...managerStats,
      errorCount: this.fastPathOptimizer.getErrorCount(),
      isFastPathEnabled: this.fastPathOptimizer.isFastPathEnabled(),
    };
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

/**
 * Delimiter recovery combinator for handling missing delimiters
 *
 * Implements recoverableDelimited combinator for open/content/close patterns.
 * Handles cases where opening delimiter is present but closing is missing,
 * and cases where both delimiters are missing. Returns structured result
 * with nullable before/content/after fields.
 *
 * @param open - Parser for opening delimiter
 * @param content - Parser for content between delimiters
 * @param close - Parser for closing delimiter
 * @param insertMissing - Whether to insert virtual tokens for missing delimiters
 * @returns Parser that returns structured result with nullable fields
 */
export function recoverableDelimited<T, U, V>(
  open: Parser<U>,
  content: Parser<T>,
  close: Parser<V>,
  insertMissing: boolean = true,
): Parser<{ before: U | null; content: T | null; after: V | null }> {
  return {
    parse(context: ParserContext): ParseResult<{
      before: U | null;
      content: T | null;
      after: V | null;
    }> {
      const allErrors: ParseError[] = [];
      let before: U | null = null;
      let contentValue: T | null = null;
      let after: V | null = null;
      let hasAnySuccess = false;

      // Skip initial whitespace
      skipWhitespace(context);

      // Try to parse opening delimiter
      const openStartPosition = context.getPosition();
      const openResult = open.parse(context);

      if (openResult.type === "success") {
        before = openResult.value;
        hasAnySuccess = true;
        skipWhitespace(context);
      } else {
        // Opening delimiter failed
        allErrors.push(...openResult.errors);
        context.setPosition(openStartPosition);

        if (insertMissing) {
          // Insert virtual opening delimiter
          const virtualOpenError = ParseError.warning(
            DiagnosticCode.INSERTED_TOKEN,
            "Inserted missing opening delimiter",
            context.span(),
            [{
              kind: "insert",
              message: "Insert opening delimiter",
              span: context.span(),
              replacement: "(", // Generic placeholder - could be made configurable
            }],
          );
          context.addRecoveryError(virtualOpenError, "DelimiterRecovery");
        }

        // Continue parsing content even without opening delimiter
        skipWhitespace(context);
      }

      // Try to parse content
      const contentStartPosition = context.getPosition();
      const contentResult = content.parse(context);

      if (contentResult.type === "success") {
        contentValue = contentResult.value;
        hasAnySuccess = true;
        skipWhitespace(context);
      } else {
        // Content parsing failed
        allErrors.push(...contentResult.errors);
        context.setPosition(contentStartPosition);

        // Add recovery information for failed content
        const contentRecoveryError = ParseError.info(
          DiagnosticCode.RECOVERED_ERROR,
          "Content parsing failed in delimited expression, continuing with closing delimiter",
          context.span(),
        );
        context.addRecoveryError(contentRecoveryError, "DelimiterRecovery");

        // Skip problematic tokens to try to find closing delimiter
        // We need to be more intelligent about this - look ahead for the closing delimiter
        let tokensSkippedForContent = 0;
        while (!context.isAtEnd()) {
          // Try to parse the closing delimiter at current position
          const closeTestPosition = context.getPosition();
          const closeTestResult = close.parse(context);

          if (closeTestResult.type === "success") {
            // Found the closing delimiter, reset position to try it in the main close parsing
            context.setPosition(closeTestPosition);
            break;
          }

          // Closing delimiter not found here, skip this token and continue
          context.consume();
          tokensSkippedForContent++;

          // Prevent infinite loops by limiting how far we look
          if (tokensSkippedForContent > 10) {
            break;
          }
        }

        skipWhitespace(context);
      }

      // Try to parse closing delimiter
      const closeStartPosition = context.getPosition();
      const closeResult = close.parse(context);

      if (closeResult.type === "success") {
        after = closeResult.value;
        hasAnySuccess = true;
        skipWhitespace(context);
      } else {
        // Closing delimiter failed
        allErrors.push(...closeResult.errors);
        context.setPosition(closeStartPosition);

        if (insertMissing) {
          // Insert virtual closing delimiter
          const virtualCloseError = ParseError.warning(
            DiagnosticCode.INSERTED_TOKEN,
            "Inserted missing closing delimiter",
            context.span(),
            [{
              kind: "insert",
              message: "Insert closing delimiter",
              span: context.span(),
              replacement: ")", // Generic placeholder - could be made configurable
            }],
          );
          context.addRecoveryError(virtualCloseError, "DelimiterRecovery");
        }

        // Try to synchronize to a reasonable recovery point
        // Look for common delimiters or statement boundaries
        const syncPredicate: SyncPredicate = (token: Token) => {
          return token.kind === "Newline" ||
            (token.kind === "Symbol" && (
              token.symbol === "Semicolon" ||
              token.symbol === "Comma" ||
              token.symbol === "CloseParen" ||
              token.symbol === "CloseBrace" ||
              token.symbol === "CloseBracket"
            ));
        };

        // Skip tokens until we find a synchronization point
        let tokensSkipped = 0;
        while (!context.isAtEnd()) {
          const token = context.peek();
          if (syncPredicate(token, context)) {
            break;
          }
          context.consume();
          tokensSkipped++;
        }

        if (tokensSkipped > 0) {
          const syncError = ParseError.info(
            DiagnosticCode.RECOVERED_AT,
            `Skipped ${tokensSkipped} tokens to find delimiter recovery point`,
            context.span(),
          );
          context.addRecoveryError(syncError, "DelimiterRecovery");
        }
      }

      // Skip final whitespace
      skipWhitespace(context);

      // Determine success based on whether we parsed anything useful
      if (hasAnySuccess) {
        return new ParseSuccess({
          before,
          content: contentValue,
          after,
        });
      } else {
        // Complete failure - couldn't parse any part
        const completeFailureError = ParseError.error(
          DiagnosticCode.UNCLOSED_DELIMITER,
          "Failed to parse delimited expression: no opening delimiter, content, or closing delimiter found",
          context.span(),
        );

        return new ParseFailure([...allErrors, completeFailureError]);
      }
    },
    pipe,
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

// ===== ERROR RECOVERY COMBINATORS =====

/**
 * Synchronization combinator with predicate-based token skipping
 *
 * Attempts to parse with the given parser, and if it fails, skips tokens
 * until the sync predicate returns true, then returns null.
 *
 * @param parser - The parser to attempt first
 * @param syncPredicate - Function that determines when to stop skipping tokens
 * @param errorMessage - Optional custom error message for synchronization failure
 * @returns Parser that returns T on success, null on synchronization, or failure if sync fails
 */
export function synchronize<T>(
  parser: Parser<T>,
  syncPredicate: SyncPredicate,
  errorMessage?: string,
): Parser<T | null> {
  return {
    parse(context: ParserContext): ParseResult<T | null> {
      // Fast path: if no errors have occurred yet, try main parser without recovery overhead
      if (context.isFastPathEnabled()) {
        const result = parser.parse(context);
        if (result.type === "success") {
          return result;
        }
        // First error encountered, fast path is now disabled
      }

      // Check if recovery attempt limit has been reached
      if (context.isRecoveryActive() && !context.canAttemptRecovery()) {
        // Too many recovery attempts, fall back to main parser only
        return parser.parse(context);
      }

      // First, try the main parser
      const startPosition = context.getPosition();
      const result = parser.parse(context);

      if (result.type === "success") {
        return result;
      }

      // Parser failed, attempt synchronization
      context.setPosition(startPosition);

      // Record the original failure
      const originalErrors = result.errors;

      // Use bounded token skipping to prevent infinite loops
      let tokensSkipped = 0;
      const maxSkip = 50; // Reasonable limit for synchronization

      while (!context.isAtEnd() && tokensSkipped < maxSkip) {
        const token = context.peek();

        if (syncPredicate(token, context)) {
          // Found synchronization point
          const syncMessage = errorMessage ||
            `Synchronized after skipping ${tokensSkipped} tokens`;

          // Add recovery information
          context.addRecoveryError(
            ParseError.info(
              DiagnosticCode.RECOVERED_ERROR,
              syncMessage,
              token.span,
            ),
            "SynchronizationRecovery",
          );

          return new ParseSuccess(null);
        }

        context.consume();
        tokensSkipped++;
      }

      // Reached end of input or skip limit without finding sync point
      const syncFailureMessage = errorMessage ||
        (tokensSkipped >= maxSkip
          ? `Failed to synchronize: reached token skip limit (${maxSkip}) without finding sync point`
          : `Failed to synchronize: reached end of input after skipping ${tokensSkipped} tokens`);

      // Return failure with both original errors and sync failure
      const syncError = ParseError.error(
        DiagnosticCode.SYNC_FAILED,
        syncFailureMessage,
        context.span(),
      );

      return new ParseFailure([...originalErrors, syncError]);
    },
    pipe,
  };
}

/**
 * Recovery combinator for strategy-based error recovery
 *
 * Tries the main parser first, and if it fails, applies a recovery strategy
 * and then uses the recovery parser. Returns the appropriate result type
 * based on which parser succeeded.
 *
 * @param parser - The main parser to attempt first
 * @param recoveryParser - The parser to use after successful recovery
 * @param strategy - The recovery strategy to apply when main parser fails
 * @returns Parser that returns T on main parser success, U on recovery success
 */
export function recover<T, U>(
  parser: Parser<T>,
  recoveryParser: Parser<U>,
  strategy: RecoveryStrategy,
): Parser<T | U> {
  return {
    parse(context: ParserContext): ParseResult<T | U> {
      // Fast path: if no errors have occurred yet, try main parser without recovery overhead
      if (context.isFastPathEnabled()) {
        const result = parser.parse(context);
        if (result.type === "success") {
          return result;
        }
        // First error encountered, fast path is now disabled
      }

      // Check if recovery attempt limit has been reached
      if (context.isRecoveryActive() && !context.canAttemptRecovery()) {
        // Too many recovery attempts, fall back to main parser only
        return parser.parse(context);
      }

      // First, try the main parser
      const startPosition = context.getPosition();
      const result = parser.parse(context);

      if (result.type === "success") {
        return result;
      }

      // Main parser failed, check if recovery strategy can handle this failure
      const failure = new ParseFailure(result.errors, result.partialResult);

      if (!strategy.canRecover(context, failure)) {
        // Strategy cannot recover from this failure, return original failure
        return failure;
      }

      // Reset position to start of failed parse
      context.setPosition(startPosition);

      // Apply recovery strategy
      const recoveryResult = strategy.recover(context, failure);

      if (!recoveryResult.success) {
        // Recovery strategy failed, return original failure with recovery info
        const recoveryError = ParseError.error(
          DiagnosticCode.RECOVERED_ERROR,
          `Recovery strategy '${strategy.name}' failed: ${recoveryResult.message}`,
          context.span(),
        );

        return new ParseFailure([...result.errors, recoveryError]);
      }

      // Recovery strategy succeeded, record the recovery
      context.addRecoveryError(
        ParseError.info(
          DiagnosticCode.RECOVERED_ERROR,
          `Applied recovery strategy '${strategy.name}': ${recoveryResult.message}`,
          context.span(),
        ),
        strategy.name,
      );

      // Update recovery history with actual tokens skipped
      const recoveryHistory = context.getRecoveryHistory();
      if (recoveryHistory.length > 0) {
        const lastEvent = recoveryHistory[recoveryHistory.length - 1];
        lastEvent.tokensSkipped = recoveryResult.tokensSkipped;
        lastEvent.success = true;
      }

      // The recovery strategy should have already positioned the context correctly
      // for the recovery parser to succeed. If the strategy reported skipping tokens,
      // we trust that it has done so.

      // Now try the recovery parser
      const recoveryParseResult = recoveryParser.parse(context);

      if (recoveryParseResult.type === "success") {
        // Recovery parser succeeded, return its result
        return recoveryParseResult;
      } else {
        // Recovery parser also failed, return combined failure information
        const combinedErrors = [
          ...result.errors, // Original parser errors
          ...recoveryParseResult.errors, // Recovery parser errors
        ];

        const recoveryFailureError = ParseError.error(
          DiagnosticCode.RECOVERED_ERROR,
          `Recovery parser failed after successful strategy '${strategy.name}'`,
          context.span(),
        );

        return new ParseFailure([...combinedErrors, recoveryFailureError]);
      }
    },
    pipe,
  };
}

/**
 * Recoverable sequence combinator for partial parsing
 *
 * Like seq() but continues parsing even when individual elements fail,
 * marking failed elements as null in the result tuple. Collects all errors
 * from failed parsers and maintains position tracking for accurate error reporting.
 *
 * @param parsers - Array of parsers to execute in sequence
 * @returns Parser that returns tuple with successful results and null for failed elements
 */
/**
 * Recoverable sequence combinator for partial parsing (without automatic whitespace handling)
 *
 * Like sequence() but continues parsing even when individual elements fail,
 * marking failed elements as null in the result tuple. Collects all errors
 * from failed parsers and maintains position tracking for accurate error reporting.
 * Does not automatically skip whitespace - parsers must handle whitespace themselves.
 *
 * @param parsers - Array of parsers to execute in sequence
 * @returns Parser that returns tuple with successful results and null for failed elements
 */
export function recoverableSequence<Parsers extends ReadonlyArray<Parser.Any>>(
  ...parsers: Parsers
): Parser<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> | null }> {
  return {
    parse(
      context: ParserContext,
    ): ParseResult<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> | null }> {
      const results: unknown[] = [];
      const allErrors: ParseError[] = [];
      let hasAnySuccess = false;

      for (let i = 0; i < parsers.length; i++) {
        const parser = parsers[i];
        const startPosition = context.getPosition();

        const result = parser.parse(context);

        if (result.type === "success") {
          results.push(result.value);
          hasAnySuccess = true;
        } else {
          // Parser failed, mark as null and collect errors
          results.push(null);
          allErrors.push(...result.errors);

          // Reset position to where this parser started
          context.setPosition(startPosition);

          // Add recovery information
          const recoveryError = ParseError.info(
            DiagnosticCode.RECOVERED_ERROR,
            `Element ${i} failed in recoverable sequence, continuing with remaining elements`,
            context.span(),
          );

          context.addRecoveryError(recoveryError, "RecoverableSequence");

          // Advance position by one token to allow next parser to try the next token
          // This is the key to recovery - we skip the problematic token
          if (!context.isAtEnd()) {
            context.consume();
          }
        }
      }

      // If we have any successful results, return success with partial results
      // If all parsers failed, return failure with all collected errors
      if (hasAnySuccess || allErrors.length === 0) {
        return new ParseSuccess(
          results as { [K in keyof Parsers]: Parser.Type<Parsers[K]> | null },
        );
      } else {
        // All parsers failed, return failure
        const sequenceError = ParseError.error(
          DiagnosticCode.RECOVERED_ERROR,
          `All elements failed in recoverable sequence`,
          context.span(),
        );

        return new ParseFailure([...allErrors, sequenceError]);
      }
    },
    pipe,
  };
}

/**
 * Recoverable sequence combinator for partial parsing (with automatic whitespace handling)
 *
 * Like seq() but continues parsing even when individual elements fail,
 * marking failed elements as null in the result tuple. Collects all errors
 * from failed parsers and maintains position tracking for accurate error reporting.
 * Automatically skips whitespace like the standard seq() combinator.
 *
 * @param parsers - Array of parsers to execute in sequence
 * @returns Parser that returns tuple with successful results and null for failed elements
 */
export function recoverableSeq<Parsers extends ReadonlyArray<Parser.Any>>(
  ...parsers: Parsers
): Parser<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> | null }> {
  return {
    parse(
      context: ParserContext,
    ): ParseResult<{ [K in keyof Parsers]: Parser.Type<Parsers[K]> | null }> {
      const results: unknown[] = [];
      const allErrors: ParseError[] = [];
      let hasAnySuccess = false;

      // Skip initial whitespace like seq does
      skipWhitespace(context);

      for (let i = 0; i < parsers.length; i++) {
        const parser = parsers[i];
        const startPosition = context.getPosition();

        const result = parser.parse(context);

        if (result.type === "success") {
          // Skip whitespace after successful parse, like seq does
          skipWhitespace(context);
          results.push(result.value);
          hasAnySuccess = true;
        } else {
          // Parser failed, mark as null and collect errors
          results.push(null);
          allErrors.push(...result.errors);

          // Reset position to where this parser started
          context.setPosition(startPosition);

          // Add recovery information
          const recoveryError = ParseError.info(
            DiagnosticCode.RECOVERED_ERROR,
            `Element ${i} failed in recoverable sequence, continuing with remaining elements`,
            context.span(),
          );

          context.addRecoveryError(recoveryError, "RecoverableSequence");

          // Advance position by one token to allow next parser to try the next token
          // This is the key to recovery - we skip the problematic token
          if (!context.isAtEnd()) {
            context.consume();
          }

          // Skip whitespace after consuming the problematic token
          skipWhitespace(context);
        }
      }

      // Skip final whitespace like seq does
      skipWhitespace(context);

      // If we have any successful results, return success with partial results
      // If all parsers failed, return failure with all collected errors
      if (hasAnySuccess || allErrors.length === 0) {
        return new ParseSuccess(
          results as { [K in keyof Parsers]: Parser.Type<Parsers[K]> | null },
        );
      } else {
        // All parsers failed, return failure
        const sequenceError = ParseError.error(
          DiagnosticCode.RECOVERED_ERROR,
          `All elements failed in recoverable sequence`,
          context.span(),
        );

        return new ParseFailure([...allErrors, sequenceError]);
      }
    },
    pipe,
  };
}
