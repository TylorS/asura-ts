import { Span } from "../Span.ts";

export class BigIntLiteralType {
  readonly kind = "BigIntLiteralType";

  constructor(
    readonly value: bigint,
    readonly span: Span
  ) {}
}
