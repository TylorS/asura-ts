import { Identifier } from "../Identifer.ts";
import { Span } from "../../tokens/Span.ts";
import { SpreadType } from "./SpreadType.ts";
import { Type } from "./Type.ts";

export interface RecordFieldType {
  readonly name: Identifier;
  readonly type: Type;
  readonly optional: boolean;
}

export class RecordLiteralType {
  readonly kind = "RecordLiteralType";

  constructor(
    readonly fields: ReadonlyArray<RecordFieldType | SpreadType>,
    readonly span: Span
  ) {}
}
