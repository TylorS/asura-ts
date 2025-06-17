import { Span } from "./Span.ts";
import { Statement } from "./Statement/mod.ts";

export class SourceFile {
  constructor(
    readonly fileName: string,
    readonly statements: ReadonlyArray<Statement>,
    readonly span: Span
  ) {}
}