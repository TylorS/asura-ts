import { Span } from "../../tokens/Span.ts";
import { TypeReference } from "./TypeReference.ts";

// TODO: Support polymorphic effects
export class EffectRecordSignature {
  readonly kind = "EffectRecordSignature";
  constructor(public readonly references: TypeReference[], public readonly span: Span) {}
}
