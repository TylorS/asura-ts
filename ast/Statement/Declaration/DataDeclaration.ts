import { Identifier } from "../../Identifer.ts";
import { Span } from "../../Span.ts";
import { Type } from "../../Type/mod.ts";
import { TypeParameter } from "../../Type/TypeParameter.ts";
import { ExportKeyword } from "./ExportKeyword.ts";

// VoidConstructor: like "Nothing"
export class VoidConstructor {
  readonly kind = "VoidConstructor";

  constructor(
    readonly name: Identifier,
    readonly span: Span
  ) {}
}

// TupleConstructor: like "Left(E)" - positional parameters
export class TupleConstructor {
  readonly kind = "TupleConstructor";

  constructor(
    readonly name: Identifier,
    readonly parameters: readonly Type[],
    readonly span: Span
  ) {}
}

// RecordConstructor: like "Left{error:E}" - named fields
export interface RecordConstructorField {
  readonly name: Identifier;
  readonly type: Type;
}

export class RecordConstructor {
  readonly kind = "RecordConstructor";

  constructor(
    readonly name: Identifier,
    readonly fields: readonly RecordConstructorField[],
    readonly span: Span
  ) {}
}

export type DataConstructor = 
  | VoidConstructor
  | TupleConstructor
  | RecordConstructor;

export class DataDeclaration {
  readonly kind = "DataDeclaration";

  constructor(
    readonly exportKeyword: ExportKeyword | null,
    readonly name: Identifier,
    readonly typeParameters: readonly TypeParameter[],
    readonly constructors: readonly DataConstructor[],
    readonly span: Span
  ) {}
}
