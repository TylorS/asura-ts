import { Span } from "../../tokens/Span.ts";
import { Expression } from "../Expression/mod.ts";

export class ExpressionStatement {
  readonly kind = "ExpressionStatement";

  constructor(
    readonly expression: Expression,
    readonly span: Span,
  ) {}
}
