import { Span } from "../../../tokens/Span.ts";

export class BigIntLiteral {
  readonly kind = "BigIntLiteral";

  constructor(
    readonly value: bigint,
    readonly span: Span,
  ) {}
}
