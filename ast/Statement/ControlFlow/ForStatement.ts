import { Expression } from "../../Expression/mod.ts";
import { Identifier } from "../../Identifer.ts";
import { Statement } from "../Statement.ts";
import { Span } from "../../../tokens/Span.ts";
import { Block } from "../../Expression/Block.ts";

export class ForStatement {
  readonly kind = "ForStatement";

  constructor(
    readonly label: Identifier | null,
    readonly initialization: Statement | null,
    readonly condition: Expression | null,
    readonly update: Expression | null,
    readonly body: Block,
    readonly span: Span
  ) {}
}
