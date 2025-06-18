import { Expression } from "../../Expression/Expression.ts";
import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";
import { EffectRecordSignature } from "../../Type/EffectRecordSignature.ts";
import { Type, TypeParameter } from "../../Type/mod.ts";
import { ExportKeyword } from "./ExportKeyword.ts";

export class FunctionDeclaration { 
  readonly kind = 'FunctionDeclaration'

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly parameters: ReadonlyArray<FunctionParameter>,
    readonly returnType: Type,
    readonly effects: EffectRecordSignature | null,
    readonly body: Expression,
    readonly span: Span
  ) {}
}

export class FunctionParameter {
  readonly kind = "FunctionParameter";

  constructor(
    readonly name: Identifier,
    readonly type: Type,
    readonly effects: EffectRecordSignature | null,
    readonly span: Span
  ) {}
}