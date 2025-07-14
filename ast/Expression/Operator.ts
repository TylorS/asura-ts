import { Span } from "../../tokens/Span.ts";

export type Operator = 
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "&&"
  | "||"
  // Unary Operators
  | "-"
  | "!";

export class OperatorNode {
  readonly kind = "Operator";
  constructor(readonly text: Operator, readonly span: Span) {}
}
