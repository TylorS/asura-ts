import * as AST from "../../ast/mod.ts";
import * as Parser from "../Parser.ts";
import { expression } from "./Expression.ts";

export function resumeExpression(): Parser.Parser<AST.ResumeExpression> {
  return Parser.seq(
    Parser.token("resume"),
    expression().pipe(
      Parser.delimitedBy(Parser.symbol("("), Parser.symbol(")")),
    ),
  ).pipe(
    Parser.map(([resumeKeyword, { content, after }]) => {
      return new AST.ResumeExpression(
        content,
        new AST.Span(resumeKeyword.span.start, after.span.end),
      );
    }),
  );
} 
