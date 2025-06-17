import { Span } from "../Span.ts";

export class BigDecimalLiteralType {
  readonly kind = "BigDecimalLiteralType";

  constructor(
    readonly value: string, // Using string to represent decimal values
    readonly span: Span
  ) {}
}
