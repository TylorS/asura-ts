import { Expression } from "../../Expression/mod.ts";
import { Span } from "../../../tokens/Span.ts";
import { Block } from "../../Expression/Block.ts";

export class WhileStatement {
  readonly kind = "WhileStatement";

  constructor(
    readonly condition: Expression,
    readonly body: Block,
    readonly span: Span
  ) {}
}
