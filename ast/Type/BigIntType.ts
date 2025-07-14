import { Span } from "../../tokens/Span.ts";

export class BigIntLiteralType {
  readonly kind = "BigIntLiteralType";

  constructor(
    readonly value: bigint,
    readonly span: Span,
  ) {}
}

export class BigIntType {
  readonly kind = "BigIntType";

  constructor(
    readonly span: Span,
  ) {}
}