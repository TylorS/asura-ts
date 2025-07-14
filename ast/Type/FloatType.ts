import { Span } from "../../tokens/Span.ts";

export class FloatLiteralType {
  readonly kind = "FloatLiteralType";

  constructor(
    readonly value: number,
    readonly span: Span,
  ) {}
}

export class FloatType {
  readonly kind = "FloatType";

  constructor(
    readonly span: Span,
  ) {}
}