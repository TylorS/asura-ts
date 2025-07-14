import { Expression } from "../../Expression/mod.ts";
import { Span } from "../../../tokens/Span.ts";
import { Block } from "../../Expression/Block.ts";
import { ContinueStatement } from "./ContinueStatement.ts";
import { BreakStatement } from "./BreakStatement.ts";

export class IfStatement {
  readonly kind = "IfStatement";

  constructor(
    readonly condition: Expression,
    readonly then: Block<ContinueStatement | BreakStatement>,
    readonly elseIf: ReadonlyArray<{
      readonly condition: Expression;
      readonly block: Block<ContinueStatement | BreakStatement>;
    }>,
    readonly else_: Block<ContinueStatement | BreakStatement> | null,
    readonly span: Span,
  ) {}
}
