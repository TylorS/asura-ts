import { Type, TypeParameter } from "../Type/mod.ts";
import { Span } from "../../tokens/Span.ts";
import { Identifier } from "../Identifer.ts";
import { EffectRecordSignature } from "../Type/EffectRecordSignature.ts";
import { Expression } from "./Expression.ts";

export class FunctionExpression {
  readonly kind = "FunctionExpression";

  constructor(
    readonly typeParameters: readonly TypeParameter[],
    readonly parameters: ReadonlyArray<FunctionParameter>,
    readonly returnType: Type,
    readonly effects: EffectRecordSignature | null,
    readonly body: Expression,
    readonly span: Span,
  ) {}
}

export class FunctionParameter {
  readonly kind = "FunctionParameter";

  constructor(
    readonly name: Identifier,
    readonly type: Type,
    readonly effects: EffectRecordSignature | null,
    readonly span: Span,
  ) {}
}
