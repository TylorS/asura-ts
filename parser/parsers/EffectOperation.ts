import * as AST from "../../ast/mod.ts";
import * as Parser from "../Parser.ts";
import { expression } from "./Expression.ts";

export function effectOperation(): Parser.Parser<AST.EffectOperation> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol("<-"),
    Parser.token("Identifier"), // effect name
    Parser.symbol("."),
    Parser.token("Identifier"), // operation
    expression().pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.optional,
      Parser.delimitedBy(Parser.symbol("("), Parser.symbol(")")),
      Parser.optional,
    ),
  ).pipe(
    Parser.map(([variable, _arrow, effectName, _dot, operation, x]) => {
      return new AST.EffectOperation(
        variable,
        effectName,
        operation,
        x?.content ?? [],
        new AST.Span(variable.span.start, (x?.after ?? operation).span.end),
      );
    }),
  );
} 
