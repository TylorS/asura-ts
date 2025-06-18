import { Span } from "../../tokens/Span.ts";

export class RegexLiteralType {
  readonly kind = "RegexLiteralType";

  constructor(
    readonly pattern: string,
    readonly flags: string | null,
    readonly span: Span,
  ) {}
}
