import { Expression } from "../../Expression/mod.ts";
import { Span } from "../../../tokens/Span.ts";
import { Block } from "../../Expression/Block.ts";
import { BreakStatement } from "./BreakStatement.ts";
import { ContinueStatement } from "./ContinueStatement.ts";

export class WhileStatement {
  readonly kind = "WhileStatement";

  constructor(
    readonly condition: Expression,
    readonly body: Block<BreakStatement | ContinueStatement>,
    readonly span: Span,
  ) {}
}
