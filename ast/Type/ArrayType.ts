import { Span } from "../../tokens/Span.ts";
import { Type } from "./Type.ts";

export class ArrayType {
  readonly kind = "ArrayType";

  constructor(
    readonly elementType: Type,
    readonly span: Span
  ) {}
}
