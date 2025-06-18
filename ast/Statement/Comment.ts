import { Span } from "../../tokens/Span.ts";

export class Comment {
  readonly kind = "Comment";

  constructor(readonly text: string, readonly span: Span) {}
}