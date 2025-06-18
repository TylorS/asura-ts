import { Identifier } from "../Identifer.ts";
import { Type } from "../mod.ts";
import { Span } from "../../tokens/Span.ts";
import { Block } from "./Block.ts";
import { Expression, Literal } from "./Expression.ts";

// Pattern types for matching
export class LiteralPattern {
  readonly kind = "LiteralPattern";

  constructor(
    readonly value: Literal,
    readonly span: Span
  ) {}
}

export class VariablePattern {
  readonly kind = "VariablePattern";

  constructor(
    readonly name: Identifier,
    readonly type: Type,
    readonly span: Span
  ) {}
}

export class WildcardPattern {
  readonly kind = "WildcardPattern";

  constructor(
    readonly span: Span
  ) {}
}

export class VoidConstructorPattern {
  readonly kind = "VoidConstructorPattern";

  constructor(
    readonly constructorName: Identifier,
    readonly span: Span
  ) {}
}

export class TupleConstructorPattern {
  readonly kind = "TupleConstructorPattern";

  constructor(
    readonly constructorName: Identifier,
    readonly patterns: readonly Pattern[],
    readonly span: Span
  ) {}
}

export class RecordConstructorPattern {
  readonly kind = "RecordConstructorPattern";

  constructor(
    readonly constructorName: Identifier,
    readonly fields: readonly RecordPatternField[],
    readonly span: Span
  ) {}
}

export interface RecordPatternField {
  readonly name: Identifier;
  readonly pattern: Pattern | null;
}

export class TuplePattern {
  readonly kind = "TuplePattern";

  constructor(
    readonly patterns: readonly Pattern[],
    readonly span: Span
  ) {}
}

export type Pattern =
  | LiteralPattern
  | VariablePattern
  | WildcardPattern
  | VoidConstructorPattern
  | TupleConstructorPattern
  | RecordConstructorPattern
  | TuplePattern;

// Match case with optional guard
export class MatchCase {
  readonly kind = "MatchCase";

  constructor(
    readonly pattern: Pattern,
    readonly guard: Expression | null,
    readonly body: Expression | Block,
    readonly span: Span
  ) {}
}

// Main match expression
export class MatchExpression {
  readonly kind = "MatchExpression";

  constructor(
    readonly expression: Expression,
    readonly cases: readonly MatchCase[],
    readonly span: Span
  ) {}
}

