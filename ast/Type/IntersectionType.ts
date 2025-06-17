import { Span } from "../Span.ts";
import { Type } from "./Type.ts";

export class IntersectionType {
  readonly kind = "IntersectionType";

  constructor(
    readonly types: readonly Type[],
    readonly span: Span
  ) {}
}
