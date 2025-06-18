import { Span } from "../../tokens/Span.ts";

export class FloatLiteralType {
  readonly kind = "FloatLiteralType";

  constructor(
    readonly value: number,
    readonly span: Span
  ) {}
}
