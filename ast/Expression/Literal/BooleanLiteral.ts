import { Span } from "../../Span.ts";

export class BooleanLiteral {
  readonly kind = "BooleanLiteral";

  constructor(
    readonly value: boolean,
    readonly span: Span
  ) {}
}
