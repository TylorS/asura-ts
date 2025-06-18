import { Span } from "../../tokens/Span.ts";

export class BooleanLiteralType {
  readonly kind = "BooleanLiteralType";

  constructor(
    readonly value: boolean,
    readonly span: Span
  ) {}
}
