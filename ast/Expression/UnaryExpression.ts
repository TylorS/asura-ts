import { Span } from "../../tokens/Span.ts";
import { Expression } from "./Expression.ts";
import { OperatorNode } from "./Operator.ts";

export class UnaryExpression {
  readonly kind = "UnaryExpression";
  constructor(
    readonly operator: OperatorNode,
    readonly operand: Expression,
    readonly span: Span,
  ) {}
}
