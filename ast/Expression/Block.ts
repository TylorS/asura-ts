import { Statement } from "../Statement/Statement.ts";
import { Span } from "../../tokens/Span.ts";

export class Block {
  readonly kind = "Block";

  constructor(
    readonly statements: ReadonlyArray<Statement>,
    readonly span: Span
  ) {}
}
