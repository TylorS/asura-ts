import { Span } from "../../../tokens/Span.ts";

export class StringLiteral {
  readonly kind = "StringLiteral";

  constructor(
    readonly value: string,
    readonly span: Span,
  ) {}
}
