import { Expression } from "../../Expression/mod.ts";
import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";
import { Type } from "../../Type/mod.ts";
import { ExportKeyword, MutableKeyword } from "../../../tokens/Token.ts";

export class LetDeclaration {
  readonly kind = "LetDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly mutableKeyword: MutableKeyword | null,
    readonly name: Identifier,
    readonly type: Type | null,
    readonly initializer: Expression,
    readonly span: Span,
  ) {}
}
