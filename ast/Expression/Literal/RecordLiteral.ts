import { Identifier } from "../../Identifer.ts";
import { Span } from "../../Span.ts";
import { Expression } from "../Expression.ts";

export interface RecordField {
  readonly name: Identifier;
  readonly value: Expression;
}

export class RecordLiteral {
  readonly kind = "RecordLiteral";

  constructor(
    readonly fields: readonly RecordField[],
    readonly span: Span
  ) {}
}
