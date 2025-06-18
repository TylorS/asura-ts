import { Span } from "../../tokens/Span.ts";
import { TypeHole } from "./mod.ts";
import { Type } from "./Type.ts";

export class TypeReference {
  readonly kind = "TypeReference";

  constructor(
    readonly name: string,
    readonly typeArguments: ReadonlyArray<TypeArgument | TypeHole>,
    readonly span: Span
  ) {}
}

export class TypeArgument {
  readonly kind = "TypeArgument";

  constructor(
    readonly type: Type,
    readonly span: Span
  ) {}
}