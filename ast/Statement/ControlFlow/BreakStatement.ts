import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";

export class BreakStatement {
  readonly kind = "BreakStatement";

  constructor(
    readonly label: Identifier | null,
    readonly span: Span,
  ) {}
}
