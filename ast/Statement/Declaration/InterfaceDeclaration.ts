import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";
import { Type } from "../../Type/mod.ts";
import { RecordFieldType } from "../../Type/RecordLiteralType.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { ExportKeyword } from "../../../tokens/Token.ts";

export class InterfaceDeclaration {
  readonly kind = "InterfaceDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly extendedTypes: readonly Type[],
    readonly fields: readonly RecordFieldType[],
    readonly span: Span,
  ) {}
}
