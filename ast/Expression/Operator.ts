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
}

export class BinaryOperator {
  readonly kind = "BinaryOperator";
  constructor(readonly operator: Operator, readonly span: Span) {}
}
