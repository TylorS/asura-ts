import { Identifier } from "../../Identifer.ts";
import { Type } from "../../Type/mod.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { RecordFieldType } from "../../Type/RecordLiteralType.ts";
import { Span } from "../../Span.ts";

export class InterfaceDeclaration {
  readonly kind = "InterfaceDeclaration";

  constructor(
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly extendedTypes: readonly Type[],
    readonly fields: readonly RecordFieldType[],
    readonly span: Span
  ) {}
}
