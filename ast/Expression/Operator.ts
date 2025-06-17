import { Span } from "../Span.ts";

export enum Operator {
  Add = "+",
  Subtract = "-",
  Multiply = "*",
  Divide = "/",
  Modulus = "%",
  Exponent = "**",
  Equal = "==",
}

export class BinaryOperator {
  readonly kind = "BinaryOperator";

  constructor(readonly operator: Operator, readonly span: Span) {}
}
