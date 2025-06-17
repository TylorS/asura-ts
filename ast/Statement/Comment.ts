import { Span } from "../Span.ts";

export class Comment {
  readonly kind = "Comment";

  constructor(readonly text: string, readonly span: Span) {}
}