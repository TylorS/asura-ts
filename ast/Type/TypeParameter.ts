import { Span } from "../../tokens/Span.ts";
import { Type } from "./Type.ts";
import { TypeReference } from "./TypeReference.ts";

export class TypeParameter {
  readonly kind = "TypeParameter";

  constructor(
    readonly reference: TypeReference,
    readonly constraints: readonly Type[],
    readonly span: Span,
  ) {}
}
