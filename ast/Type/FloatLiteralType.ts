import { Span } from "../Span.ts";

export class FloatLiteralType {
  readonly kind = "FloatLiteralType";

  constructor(
    readonly value: number,
    readonly span: Span
  ) {}
}
