import { Expression } from "./Expression.ts";
import { Span } from "../../tokens/Span.ts";
import { BinaryOperator } from "./Operator.ts";

export class BinaryExpression {
  readonly kind = "BinaryExpression";

  constructor(
    readonly left: Expression,
    readonly operator: BinaryOperator,
    readonly right: Expression,
    readonly span: Span,
  ) {}
}
