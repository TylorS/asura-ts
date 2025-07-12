import { Span } from "../../tokens/Span.ts";

export enum Operator {
  Add = "+",
  Subtract = "-",
  Multiply = "*",
  Divide = "/",
  Modulus = "%",
  Exponent = "**",
  Equal = "==",
  NotEqual = "!=",
  LessThan = "<",
  LessThanOrEqual = "<=",
  GreaterThan = ">",
  GreaterThanOrEqual = ">=",
  And = "&&",
  Or = "||",

  // Unary Operators
  Negate = "-",
  Not = "!",
}

export class OperatorNode {
  readonly kind = "Operator";
  constructor(readonly operator: Operator, readonly span: Span) {}
}
