import { Expression } from "../Expression/mod.ts";
import { Span } from "../Span.ts";

export class ExpressionStatement {
  readonly kind = "ExpressionStatement";

  constructor(
    readonly expression: Expression,
    readonly span: Span
  ) {}
}