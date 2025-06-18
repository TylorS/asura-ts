import { Span } from "../../../tokens/Span.ts";
import { AsKeyword, ImportKeyword } from "../../../tokens/Token.ts";
import { StringLiteral } from "../../Expression/Literal/StringLiteral.ts";
import { Identifier } from "../../Identifer.ts";

export class ImportDeclaration {
  readonly kind = "ImportDeclaration";

  constructor(
    readonly importKeyword: ImportKeyword,
    readonly imports: NamespaceImport | NamedImports,
    readonly specifier: StringLiteral,
    readonly span: Span,
  ) {}
}

export class NamespaceImport {
  readonly kind = "NamespaceImport";
  constructor(readonly name: Identifier, readonly span: Span) {}
}

export class NamedImports {
  readonly kind = "NamedImports";
  constructor(readonly imports: NamedImport[], readonly span: Span) {}
}

export class NamedImport {
  readonly kind = "NamedImport";
  constructor(
    readonly name: Identifier,
    readonly asKeyword: AsKeyword | null,
    readonly alias: Identifier | null,
    readonly span: Span,
  ) {}
}
