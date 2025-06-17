import { Identifier } from "../../Identifer.ts";
import { Span } from "../../Span.ts";

export class ContinueStatement {
  readonly kind = "ContinueStatement";

  constructor(
    readonly label: Identifier | null,
    readonly span: Span
  ) {}
}
