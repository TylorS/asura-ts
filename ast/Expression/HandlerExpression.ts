import { Expression } from "./Expression.ts";
import { Span } from "../../tokens/Span.ts";
import { Identifier } from "../Identifer.ts";
import { TypeReference } from "../Type/TypeReference.ts";

export class HandlerExpression {
  readonly kind = "HandlerExpression";

  constructor(
    readonly effectName: TypeReference,
    readonly handlers: readonly HandlerCase[],
    readonly span: Span,
  ) { }
}

export class HandlerCase {
  readonly kind = "HandlerCase";

  constructor(
    readonly operation: Identifier,
    readonly body: Expression,
    readonly span: Span,
  ) { }
} 