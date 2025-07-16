import { Expression } from "./Expression.ts";
import { Span } from "../../tokens/Span.ts";

export class CallExpression {
  readonly kind = "CallExpression";

  constructor(
    readonly callee: Expression,
    readonly args: readonly Expression[],
    readonly span: Span,
  ) {}
} 