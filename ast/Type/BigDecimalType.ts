import { Span } from "../../tokens/Span.ts";

export class BigDecimalLiteralType {
  readonly kind = "BigDecimalLiteralType";

  constructor(
    readonly value: string, // Using string to represent decimal values
    readonly span: Span,
  ) {}
}

export class BigDecimalType {
  readonly kind = "BigDecimalType";

  constructor(
    readonly span: Span,
  ) {}
}
