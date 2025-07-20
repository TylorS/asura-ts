import { Span } from "../../tokens/Span.ts";
import { TypeReference } from "./TypeReference.ts";

export class HandlerType {
  readonly kind = "HandlerType";
  constructor(
    readonly effect: TypeReference,
    readonly span: Span,
  ) {}
}
