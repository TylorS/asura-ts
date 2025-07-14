import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { ExportKeyword } from "../../../tokens/Token.ts";
import { RecordFieldType } from "../../Type/RecordType.ts";

export class EffectDeclaration {
  readonly kind = "EffectDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly fields: readonly RecordFieldType[],
    readonly span: Span,
  ) {}
}
