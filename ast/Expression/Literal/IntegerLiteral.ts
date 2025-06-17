import { Span } from "../../Span.ts";

export class IntegerLiteral {
  readonly kind = "IntegerLiteral";

  constructor(
    readonly value: number,
    readonly span: Span
  ) {}
}
