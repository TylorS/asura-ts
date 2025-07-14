import { Identifier } from "../../Identifer.ts";
import { Span } from "../../../tokens/Span.ts";
import { Expression } from "../Expression.ts";

export class RecordField {
  constructor(readonly name: Identifier, readonly value: Expression) {}
}

export class RecordLiteral {
  readonly kind = "RecordLiteral";

  constructor(
    readonly fields: readonly RecordField[],
    readonly span: Span,
  ) {}
}
