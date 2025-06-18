import { Identifier } from "../Identifer.ts";
import { Span } from "../../tokens/Span.ts";
import { SpreadType } from "./SpreadType.ts";
import { Type } from "./Type.ts";

export class TupleLiteralType {
  readonly kind = "TupleLiteralType";

  constructor(
    readonly elements: ReadonlyArray<TupleElement>,
    readonly span: Span
  ) {}
}

export class TupleElement {
  readonly kind = "TupleElement";

  constructor(
    readonly type: Type | SpreadType,
    readonly name: Identifier | null,
    readonly span: Span
  ) {}
}