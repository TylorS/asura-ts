import { Expression } from "../../Expression/Expression.ts";
import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";
import { EffectRecordSignature } from "../../Type/EffectRecordSignature.ts";
import { Type, TypeParameter } from "../../Type/mod.ts";
import { ExportKeyword } from "../../../tokens/Token.ts";
import { FunctionParameter } from "../../Expression/FunctionExpression.ts";
import { Block } from "../../Expression/Block.ts";

export class FunctionDeclaration {
  readonly kind = "FunctionDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly parameters: ReadonlyArray<FunctionParameter>,
    readonly effects: EffectRecordSignature | null,
    readonly returnType: Type,
    readonly body: Expression | Block,
    readonly span: Span,
  ) {}
}
