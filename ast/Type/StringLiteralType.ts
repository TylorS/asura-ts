import { Span } from "../Span.ts";

export class StringLiteralType {
  readonly kind = "StringLiteralType";

  constructor(
    readonly value: string,
    readonly span: Span
  ) {}
}
