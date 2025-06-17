import { Expression } from "../../Expression/mod.ts";
import { Span } from "../../Span.ts";

export class ReturnStatement {
  readonly kind = "ReturnStatement";

  constructor(readonly expression: Expression, readonly span: Span) {}
}