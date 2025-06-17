import { Span } from "../Span.ts";
import { Type } from "./Type.ts";

export class UnionType {
  readonly kind = "UnionType";

  constructor(
    readonly types: readonly Type[],
    readonly span: Span
  ) {}
}
