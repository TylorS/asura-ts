import { Identifier } from "../Identifer.ts";
import { Type } from "./Type.ts";
import { TypeParameter } from "./mod.ts";

export class EffectType {
  readonly kind = "EffectType";
  
  constructor(
    readonly name: Identifier,
    readonly parameters: TypeParameter[],
    readonly fields: EffectField[]
  ) {}
}

export class EffectField {
  readonly kind = "EffectField";
  constructor(
    readonly name: Identifier,
    readonly type: Type
  ) {}
}
