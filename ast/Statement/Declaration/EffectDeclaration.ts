import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";
import { Type } from "../../Type/mod.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { ExportKeyword } from "../../../tokens/Token.ts";

export interface EffectSignature {
  readonly name: Identifier;
  readonly parameters: readonly Type[];
  readonly returnType: Type;
}

export class EffectDeclaration {
  readonly kind = "EffectDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly signatures: readonly EffectSignature[],
    readonly span: Span,
  ) {}
}
