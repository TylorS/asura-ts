import { Span } from "./Span.ts";
import { SymbolKind, SYMBOLS } from "./Symbols.ts";

export type Token =
  | AsKeyword
  | BigIntegerLiteral
  | BigDecimalLiteral
  | BooleanLiteral
  | BreakKeyword
  | Comment
  | ContinueKeyword
  | DataKeyword
  | EffectKeyword
  | ExtendsKeyword
  | ElseKeyword
  | ExportKeyword
  | FloatLiteral
  | ForKeyword
  | FunKeyword
  | HandleKeyword
  | Identifier
  | IfKeyword
  | ImportKeyword
  | InKeyword
  | IntegerLiteral
  | InterfaceKeyword
  | LetKeyword
  | MutableKeyword
  | MatchKeyword
  | MultiLineComment
  | Newline
  | OfKeyword
  | ReturnKeyword
  | StringLiteral
  | Symbol<SymbolKind>
  | TypeKeyword
  | WhileKeyword
  | Whitespace
  | WithKeyword;

export abstract class Spanned<Kind extends string> {
  constructor(readonly kind: Kind, readonly span: Span) {}

  abstract toString(): string;
}

export abstract class Keyword<T extends string> extends Spanned<T> {
  constructor(text: T, span: Span) {
    super(text, span);
  }

  asIdentifier(): Identifier {
    return new Identifier(this.kind, this.span);
  }

  override toString(): string {
    return this.kind;
  }
}

// Declaration Keywords
export class ExportKeyword extends Keyword<"export"> {
  constructor(span: Span) {
    super("export", span);
  }
}

export class MutableKeyword extends Keyword<"mut"> {
  constructor(span: Span) {
    super("mut", span);
  }
}

export class DataKeyword extends Keyword<"data"> {
  constructor(span: Span) {
    super("data", span);
  }
}

export class EffectKeyword extends Keyword<"effect"> {
  constructor(span: Span) {
    super("effect", span);
  }
}

export class ExtendsKeyword extends Keyword<"extends"> {
  constructor(span: Span) {
    super("extends", span);
  }
}

export class FunKeyword extends Keyword<"fun"> {
  constructor(span: Span) {
    super("fun", span);
  }
}

export class ImportKeyword extends Keyword<"import"> {
  constructor(span: Span) {
    super("import", span);
  }
}

export class AsKeyword extends Keyword<"as"> {
  constructor(span: Span) {
    super("as", span);
  }
}

export class InterfaceKeyword extends Keyword<"interface"> {
  constructor(span: Span) {
    super("interface", span);
  }
}

export class LetKeyword extends Keyword<"let"> {
  constructor(span: Span) {
    super("let", span);
  }
}

export class TypeKeyword extends Keyword<"type"> {
  constructor(span: Span) {
    super("type", span);
  }
}

// Control Flow Keywords
export class BreakKeyword extends Keyword<"break"> {
  constructor(span: Span) {
    super("break", span);
  }
}

export class ContinueKeyword extends Keyword<"continue"> {
  constructor(span: Span) {
    super("continue", span);
  }
}

export class ElseKeyword extends Keyword<"else"> {
  constructor(span: Span) {
    super("else", span);
  }
}

export class ForKeyword extends Keyword<"for"> {
  constructor(span: Span) {
    super("for", span);
  }
}

export class IfKeyword extends Keyword<"if"> {
  constructor(span: Span) {
    super("if", span);
  }
}

export class InKeyword extends Keyword<"in"> {
  constructor(span: Span) {
    super("in", span);
  }
}

export class OfKeyword extends Keyword<"of"> {
  constructor(span: Span) {
    super("of", span);
  }
}

export class ReturnKeyword extends Keyword<"return"> {
  constructor(span: Span) {
    super("return", span);
  }
}

export class WhileKeyword extends Keyword<"while"> {
  constructor(span: Span) {
    super("while", span);
  }
}

// Expression Keywords
export class HandleKeyword extends Keyword<"handle"> {
  constructor(span: Span) {
    super("handle", span);
  }
}

export class MatchKeyword extends Keyword<"match"> {
  constructor(span: Span) {
    super("match", span);
  }
}

export class WithKeyword extends Keyword<"with"> {
  constructor(span: Span) {
    super("with", span);
  }
}

// Literals
export class Identifier extends Spanned<"Identifier"> {
  constructor(readonly text: string, span: Span) {
    super("Identifier", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class IntegerLiteral extends Spanned<"IntegerLiteral"> {
  constructor(readonly text: string, span: Span) {
    super("IntegerLiteral", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class FloatLiteral extends Spanned<"FloatLiteral"> {
  constructor(readonly text: string, span: Span) {
    super("FloatLiteral", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class BigIntegerLiteral extends Spanned<"BigIntegerLiteral"> {
  constructor(readonly text: string, span: Span) {
    super("BigIntegerLiteral", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class BigDecimalLiteral extends Spanned<"BigDecimalLiteral"> {
  constructor(readonly text: string, span: Span) {
    super("BigDecimalLiteral", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class BooleanLiteral extends Spanned<"BooleanLiteral"> {
  constructor(readonly text: "true" | "false", span: Span) {
    super("BooleanLiteral", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class StringLiteral extends Spanned<"StringLiteral"> {
  constructor(readonly text: string, span: Span) {
    super("StringLiteral", span);
  }

  override toString(): string {
    return this.text;
  }
}

// Symbols

export class Symbol<T extends SymbolKind> extends Spanned<"Symbol"> {
  constructor(
    readonly symbol: T,
    readonly text: (typeof SYMBOLS)[T],
    span: Span,
  ) {
    super("Symbol", span);
  }

  override toString(): string {
    return this.text;
  }
}

// Comments
export class Comment extends Spanned<"Comment"> {
  constructor(readonly text: string, span: Span) {
    super("Comment", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class MultiLineComment extends Spanned<"MultiLineComment"> {
  constructor(readonly text: string, span: Span) {
    super("MultiLineComment", span);
  }

  override toString(): string {
    return this.text;
  }
}

// Whitespace
export class Whitespace extends Spanned<"Whitespace"> {
  constructor(readonly text: string, span: Span) {
    super("Whitespace", span);
  }

  override toString(): string {
    return this.text;
  }
}

export class Newline extends Spanned<"Newline"> {
  constructor(span: Span) {
    super("Newline", span);
  }

  override toString(): string {
    return "\n";
  }
}
