import { Span } from "../../tokens/Span.ts";
import { ReturnStatement } from "../Statement/ControlFlow/ReturnStatement.ts";
import { Statement } from "../Statement/Statement.ts";

export class Block<T = never> {
  readonly kind = "Block";

  constructor(
    readonly statements: ReadonlyArray<Statement | ReturnStatement | T>,
    readonly span: Span,
  ) {}
}
