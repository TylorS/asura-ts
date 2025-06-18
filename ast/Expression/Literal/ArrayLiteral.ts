import { Span } from "../../../tokens/Span.ts";
import { Expression } from "../Expression.ts";

export class ArrayLiteral {
  readonly kind = "ArrayLiteral";

  constructor(
    readonly elements: readonly Expression[],
    readonly span: Span,
  ) {}
}
