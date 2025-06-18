import { Span } from "../../tokens/Span.ts";

export class StringLiteralType {
  readonly kind = "StringLiteralType";

  constructor(
    readonly value: string,
    readonly span: Span
  ) {}
}
