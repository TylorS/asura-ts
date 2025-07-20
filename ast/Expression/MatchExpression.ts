import { Span } from "../../tokens/Span.ts";
import { Block } from "./Block.ts";
import { Expression } from "./Expression.ts";
import { Pattern } from "./Pattern.ts";

// Match case with optional guard
export class MatchCase {
  readonly kind = "MatchCase";

  constructor(
    readonly pattern: Pattern,
    readonly guard: Expression | null,
    readonly body: Expression | Block,
    readonly span: Span,
  ) {}
}

// Main match expression
export class MatchExpression {
  readonly kind = "MatchExpression";

  constructor(
    readonly expression: Expression,
    readonly cases: readonly MatchCase[],
    readonly span: Span,
  ) {}
}
