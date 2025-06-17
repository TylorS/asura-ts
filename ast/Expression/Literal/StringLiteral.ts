import { Span } from "../../Span.ts";

export class StringLiteral {
  readonly kind = "StringLiteral";

  constructor(
    readonly value: string,
    readonly span: Span
  ) {}
}
