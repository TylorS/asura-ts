import { Identifier } from "../../Identifer.ts";
import { Type } from "../../Type/mod.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { Span } from "../../Span.ts";

export class TypeAliasDeclaration {
  readonly kind = "TypeAliasDeclaration";

  constructor(
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly type: Type,
    readonly span: Span
  ) {}
}
