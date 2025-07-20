import { Span } from "../../../tokens/Span.ts";
import { ExportKeyword, MutableKeyword } from "../../../tokens/Token.ts";
import { Expression } from "../../Expression/mod.ts";
import { Pattern } from "../../Expression/Pattern.ts";
import { Identifier } from "../../Identifer.ts";
import { Type } from "../../Type/mod.ts";

export class LetDeclaration {
  readonly kind = "LetDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly mutableKeyword: MutableKeyword | null,
    readonly name: Identifier | Pattern,
    readonly type: Type | null,
    readonly initializer: Expression,
    readonly span: Span,
  ) {}
}
