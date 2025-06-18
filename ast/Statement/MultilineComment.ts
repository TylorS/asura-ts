import { Span } from "../../tokens/Span.ts";

export class MultilineComment {
  readonly kind = "MultilineComment";

  constructor(readonly text: string, readonly span: Span) {}
}