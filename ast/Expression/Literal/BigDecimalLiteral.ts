import { Span } from "../../../tokens/Span.ts";

export class BigDecimalLiteral {
  readonly kind = "BigDecimalLiteral";

  constructor(
    readonly before: bigint,
    readonly after: bigint,
    readonly span: Span,
  ) {}
}
