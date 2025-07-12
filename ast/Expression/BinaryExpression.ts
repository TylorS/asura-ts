import { Expression } from "./Expression.ts";
import { Span } from "../../tokens/Span.ts";
import { OperatorNode } from "./Operator.ts";

export class BinaryExpression {
  readonly kind = "BinaryExpression";

  constructor(
    readonly left: Expression,
    readonly operator: OperatorNode,
    readonly right: Expression,
    readonly span: Span,
  ) {}
}
