import { Span } from "../../tokens/Span.ts";
import { Identifier } from "../Identifer.ts";
import { Type } from "./Type.ts";
import { TypeParameter } from "./mod.ts";

export class EffectType {
  readonly kind = "EffectType";

  constructor(
    readonly name: Identifier,
    readonly parameters: readonly TypeParameter[],
    readonly fields: readonly EffectField[],
    readonly span: Span,
  ) {}
}

export class EffectField {
  readonly kind = "EffectField";
  constructor(
    readonly name: Identifier,
    readonly type: Type,
  ) {}
}
