import { Span } from "../tokens/Span.ts";
import type { Token } from "../tokens/Token.ts";

// Enhanced error recovery types (imported from parser)
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

export enum DiagnosticSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
  HINT = "hint",
}

export enum DiagnosticCode {
  // Parse errors
  UNEXPECTED_TOKEN = "P001",
  EXPECTED_TOKEN = "P002",
  MISSING_SEMICOLON = "P003",
  UNCLOSED_DELIMITER = "P004",
  INVALID_SYNTAX = "P005",
  PREMATURE_EOF = "P006",

  // Recovery errors
  SKIPPED_TOKENS = "P100",
  INSERTED_TOKEN = "P101",
  RECOVERED_AT = "P102",
  INCOMPLETE_FUNCTION = "P103",

  // Semantic errors (for future)
  UNDEFINED_IDENTIFIER = "S001",
  TYPE_MISMATCH = "S002",
  DUPLICATE_DECLARATION = "S003",
}

export interface DiagnosticFix {
  kind: "insert" | "replace" | "delete";
  message: string;
  span: Span;
  replacement: string;
}

export class Diagnostic {
  constructor(
    readonly severity: DiagnosticSeverity,
    readonly code: DiagnosticCode,
    readonly message: string,
    readonly span: Span,
    readonly fileName: string,
    readonly fixes: ReadonlyArray<DiagnosticFix> = [],
    readonly relatedInformation: ReadonlyArray<DiagnosticRelatedInformation> = [],
    // Enhanced error recovery information (optional)
    readonly parsingContext?: ErrorContext,
    readonly expectedTokens?: string[],
    readonly actualToken?: Token | null,
    readonly parserStack?: string[],
    readonly recoveryAttempts?: RecoveryAttempt[],
  ) {}

  isError(): boolean {
    return this.severity === DiagnosticSeverity.ERROR;
  }

  isWarning(): boolean {
    return this.severity === DiagnosticSeverity.WARNING;
  }

  withFix(
    message: string,
    replacement: string,
    kind: DiagnosticFix["kind"] = "insert",
    span?: Span,
  ): Diagnostic {
    const fixSpan = span ?? this.span;
    const fix: DiagnosticFix = { kind, message, span: fixSpan, replacement };
    return new Diagnostic(
      this.severity,
      this.code,
      this.message,
      this.span,
      this.fileName,
      [...this.fixes, fix],
      this.relatedInformation,
      this.parsingContext,
      this.expectedTokens,
      this.actualToken,
      this.parserStack,
      this.recoveryAttempts,
    );
  }

  withRelatedInfo(message: string, span: Span, fileName: string): Diagnostic {
    const info: DiagnosticRelatedInformation = { message, span, fileName };
    return new Diagnostic(
      this.severity,
      this.code,
      this.message,
      this.span,
      this.fileName,
      this.fixes,
      [...this.relatedInformation, info],
      this.parsingContext,
      this.expectedTokens,
      this.actualToken,
      this.parserStack,
      this.recoveryAttempts,
    );
  }
}

export interface DiagnosticRelatedInformation {
  message: string;
  span: Span;
  fileName: string;
}

export class DiagnosticCollection {
  private diagnostics: Diagnostic[] = [];

  add(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  addError(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fileName: string,
  ): Diagnostic {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      code,
      message,
      span,
      fileName,
    );
    this.add(diagnostic);
    return diagnostic;
  }

  addWarning(
    code: DiagnosticCode,
    message: string,
    span: Span,
    fileName: string,
  ): Diagnostic {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.WARNING,
      code,
      message,
      span,
      fileName,
    );
    this.add(diagnostic);
    return diagnostic;
  }

  getAll(): ReadonlyArray<Diagnostic> {
    return this.diagnostics;
  }

  getErrors(): ReadonlyArray<Diagnostic> {
    return this.diagnostics.filter((d) => d.isError());
  }

  getWarnings(): ReadonlyArray<Diagnostic> {
    return this.diagnostics.filter((d) => d.isWarning());
  }

  hasErrors(): boolean {
    return this.diagnostics.some((d) => d.isError());
  }

  clear(): void {
    this.diagnostics = [];
  }

  merge(other: DiagnosticCollection): void {
    this.diagnostics.push(...other.diagnostics);
  }
}
