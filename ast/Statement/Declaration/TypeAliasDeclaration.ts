import { Identifier } from "../../Identifer.ts";
import { Type } from "../../Type/mod.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { Span } from "../../../tokens/Span.ts";
import { ExportKeyword } from "./ExportKeyword.ts";

export class TypeAliasDeclaration {
  readonly kind = "TypeAliasDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly type: Type,
    readonly span: Span
  ) {}
}
