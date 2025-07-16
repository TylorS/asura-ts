import { Identifier } from "../Identifer.ts";
import { Span } from "../../tokens/Span.ts";
import { Expression } from "./Expression.ts";

export class PropertyAccess {
  readonly kind = "PropertyAccess";
  
  constructor(
    public readonly object: Expression,
    public readonly property: Identifier,
    public readonly span: Span,
  ) {}

  toString(): string {
    return `${this.object.toString()}.${this.property.text}`;
  }
}
