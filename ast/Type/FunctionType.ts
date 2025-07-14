import { Span } from "../../tokens/Span.ts";
import { Type } from "./Type.ts";
import { TypeParameter } from "./TypeParameter.ts";
import { Identifier } from "../Identifer.ts";
import { EffectRecordSignature } from "./EffectRecordSignature.ts";

export class FunctionType {
  readonly kind = "FunctionType";

  constructor(
    readonly typeParameters: readonly TypeParameter[],
    readonly parameters: readonly FunctionParameterType[],
    readonly effects: EffectRecordSignature | null,
    readonly returnType: Type,
    readonly span: Span,
  ) {}
}

export class FunctionParameterType {
  readonly kind = "FunctionParameterType";

  constructor(
    readonly name: Identifier,
    readonly effects: EffectRecordSignature | null,
    readonly type: Type,
    readonly span: Span,
  ) {}
}
