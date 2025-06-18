import { Span } from "../../tokens/Span.ts";
import { TypeReference } from "./TypeReference.ts";

export class TypeParameter {
  readonly kind = "TypeParameter";

  constructor(
    readonly reference: TypeReference,
    readonly constraints: readonly TypeReference[],
    readonly span: Span,
  ) {}
}
