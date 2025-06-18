import { Span } from "../tokens/Span.ts";

export class Identifier {
  readonly kind = "Identifier";

  constructor(
    readonly text: string,
    readonly span: Span,
  ) {}
}
