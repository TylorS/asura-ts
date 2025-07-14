import { Span } from "../../tokens/Span.ts";

export class StringLiteralType {
  readonly kind = "StringLiteralType";

  constructor(
    readonly value: string,
    readonly span: Span,
  ) {}
}

export class StringType {
  readonly kind = "StringType";

  constructor(
    readonly span: Span,
  ) {}
}