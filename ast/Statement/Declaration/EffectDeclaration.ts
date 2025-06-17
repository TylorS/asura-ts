import { Identifier } from "../../Identifer.ts";
import { Type } from "../../Type/mod.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { Span } from "../../Span.ts";

export interface EffectSignature {
  readonly name: Identifier;
  readonly parameters: readonly Type[];
  readonly returnType: Type;
}

export class EffectDeclaration {
  readonly kind = "EffectDeclaration";

  constructor(
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly signatures: readonly EffectSignature[],
    readonly span: Span
  ) {}
}
