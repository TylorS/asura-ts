import { Expression } from "./Expression.ts";
import { Span } from "../../tokens/Span.ts";

export class ResumeExpression {
  readonly kind = "ResumeExpression";

  constructor(
    readonly argument: Expression,
    readonly span: Span,
  ) {}
}
