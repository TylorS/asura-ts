import { Span } from "../../tokens/Span.ts";

export class TypeHole {
  readonly kind = "TypeHole";

  constructor(
    readonly span: Span,
  ) {}
}
