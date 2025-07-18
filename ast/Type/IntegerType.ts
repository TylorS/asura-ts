import { Span } from "../../tokens/Span.ts";

export class IntegerLiteralType {
  readonly kind = "IntegerLiteralType";

  constructor(
    readonly value: number,
    readonly span: Span,
  ) {}
}

export class IntegerType {
  readonly kind = "IntegerType";

  constructor(
    readonly span: Span,
  ) {}
}
