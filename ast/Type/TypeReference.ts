import { Span } from "../../tokens/Span.ts";
import { Identifier } from "../Identifer.ts";
import { TypeHole } from "./mod.ts";
import { Type } from "./Type.ts";

export class TypeReference {
  readonly kind = "TypeReference";

  constructor(
    readonly name: Identifier,
    readonly typeArguments: ReadonlyArray<Type | TypeHole>,
    readonly span: Span,
  ) {}
}
