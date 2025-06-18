import { Span } from "../../../tokens/Span.ts";

export class FloatLiteral {
  readonly kind = "FloatLiteral";

  constructor(
    readonly value: number,
    readonly span: Span
  ) {}
}
