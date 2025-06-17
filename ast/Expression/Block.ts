import { Statement } from "../Statement/Statement.ts";
import { Span } from "../Span.ts";

export class Block {
  readonly kind = "Block";

  constructor(
    readonly statements: ReadonlyArray<Statement>,
    readonly span: Span
  ) {}
}
