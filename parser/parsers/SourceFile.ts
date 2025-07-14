import * as AST from "../../ast/mod.ts";
import * as Parser from "../Parser.ts";
import { statement } from "./Statement.ts";

const INITIAL_SPAN = new AST.SpanLocation(1, 1, 0);

export function sourceFile(fileName: string): Parser.Parser<AST.SourceFile> {
  return Parser.zeroOrMore(statement()).pipe(
    Parser.map((statements) =>
      new AST.SourceFile(
        fileName,
        statements,
        new AST.Span(
          INITIAL_SPAN,
          statements[statements.length - 1]?.span.end ?? INITIAL_SPAN,
        ),
      )
    ),
  );
}
