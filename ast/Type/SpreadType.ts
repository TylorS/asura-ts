import { Span } from "../Span.ts";
import { TypeReference } from "./TypeReference.ts";

export class SpreadType {
  readonly kind = "SpreadType";

  constructor(
    readonly type: TypeReference,
    readonly span: Span
  ) {}
}
