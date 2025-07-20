import { Expression } from "../Expression/Expression.ts";
import { Span } from "../../tokens/Span.ts";
import { Identifier } from "../Identifer.ts";

export class EffectOperation {
  readonly kind = "EffectOperation";

  constructor(
    readonly variable: Identifier,
    readonly effectName: Identifier,
    readonly operation: Identifier,
    readonly args: readonly Expression[],
    readonly span: Span,
  ) {}
} 
