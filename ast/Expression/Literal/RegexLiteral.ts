import { Span } from "../../../tokens/Span.ts";

export class RegexLiteral {
  readonly kind = "RegexLiteral";

  constructor(
    readonly pattern: string,
    readonly flags: string | null,
    readonly span: Span,
  ) {}
}
