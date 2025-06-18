import { Span } from "../../../tokens/Span.ts";

export class BigDecimalLiteral {
  readonly kind = "BigDecimalLiteral";

  constructor(
    readonly value: string, // Using string to represent decimal values
    readonly span: Span,
  ) {}
}
