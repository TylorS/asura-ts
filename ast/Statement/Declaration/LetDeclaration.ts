import { Expression } from "../../Expression/mod.ts";
import { Identifier } from "../../Identifer.ts";
import { Span } from "../../Span.ts";
import { Type } from "../../Type/mod.ts";
import { ExportKeyword } from "./ExportKeyword.ts";

export class LetDeclaration {
  readonly kind = "LetDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly mutableKeyword: MutableKeyword | null,
    readonly name: Identifier,
    readonly type: Type | null,
    readonly initializer: Expression | null,
    readonly span: Span
  ) {}
}

export class MutableKeyword {
  readonly kind = "MutableKeyword";
  constructor(readonly span: Span) {}
}