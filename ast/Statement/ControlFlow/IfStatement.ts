import { Expression } from "../../Expression/mod.ts";
import { Span } from "../../Span.ts";
import { Statement } from "../Statement.ts";

export class IfStatement {
  readonly kind = "IfStatement";

  constructor(
    readonly condition: Expression,
    readonly thenStatement: Statement,
    readonly elseIfStatements: ReadonlyArray<{
      readonly condition: Expression;
      readonly statement: Statement;
    }>,
    readonly elseStatement: Statement | null,
    readonly span: Span
  ) {}
}
