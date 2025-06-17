import { Identifier } from "../../Identifer.ts";
import { Expression } from "../../Expression/mod.ts";
import { Type } from "../../Type/mod.ts";
import { Span } from "../../Span.ts";

export class LetDeclaration {
  readonly kind = "LetDeclaration";

  constructor(
    readonly name: Identifier,
    readonly type: Type | null,
    readonly initializer: Expression | null,
    readonly span: Span
  ) {}
}
