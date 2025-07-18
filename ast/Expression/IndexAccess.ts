import { Expression } from "./Expression.ts";
import { Span } from "../../tokens/Span.ts";

export class IndexAccess {
  readonly kind = "IndexAccess";

  constructor(
    public readonly object: Expression,
    public readonly index: Expression,
    public readonly span: Span,
  ) {}

  toString(): string {
    return `${this.object.toString()}[${this.index.toString()}]`;
  }
}
