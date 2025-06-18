import { TypeReference } from "./TypeReference.ts";

export class EffectRecordSignature {
  readonly kind = "EffectRecordSignature";
  constructor(public readonly references: TypeReference[]) {}
}
