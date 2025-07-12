import { Identifier } from "../../Identifer.ts";
import { Expression } from "../../Expression/mod.ts";
import { Span } from "../../../tokens/Span.ts";
import { Block } from "../../Expression/Block.ts";
import { BreakStatement } from "./BreakStatement.ts";
import { ContinueStatement } from "./ContinueStatement.ts";

export class ForOfStatement {
  readonly kind = "ForOfStatement";

  constructor(
    readonly label: Identifier | null,
    readonly variable: Identifier,
    readonly iterable: Expression,
    readonly body: Block<BreakStatement | ContinueStatement>,
    readonly span: Span,
  ) {}
}
