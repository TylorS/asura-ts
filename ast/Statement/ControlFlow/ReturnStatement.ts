import { Expression } from "../../Expression/mod.ts";
import { Span } from "../../../tokens/Span.ts";

export class ReturnStatement {
  readonly kind = "ReturnStatement";

  constructor(readonly expression: Expression | null, readonly span: Span) {}
}
