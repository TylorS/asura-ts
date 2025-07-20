import * as AST from "../../ast/mod.ts";
import * as Parser from "../Parser.ts";
import { expression, functionParameter, returnExpressionOrBlock } from "./Expression.ts";
import { effectRecordSignature, type, typeParametersList, typeReference } from "./Type.ts";

export function handlerExpression(): Parser.Parser<AST.HandlerExpression> {
  return Parser.seq(
    Parser.token("handle"),
    typeReference(),
    Parser.symbol("{"),
    Parser.or(functionHandlerCase(), handlerCase()).pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.optional,
    ),
    Parser.symbol("}"),
  ).pipe(
    Parser.map(([handleKeyword, effectName, _open, content, _close]) => {
      return new AST.HandlerExpression(
        effectName,
        content ?? [],
        new AST.Span(handleKeyword.span.start, _close.span.end),
      );
    }),
  );
}

function handlerCase(): Parser.Parser<AST.HandlerCase> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol(":"),
    expression(),
  ).pipe(
    Parser.map(([operation, _colon, body]) => {
      return new AST.HandlerCase(
        operation,
        body,
        new AST.Span(operation.span.start, body.span.end),
      );
    }),
  );
}

function functionHandlerCase(): Parser.Parser<AST.HandlerCase> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(typeParametersList()),
    Parser.symbol("("),
    functionParameter().pipe(
      Parser.separatedBy(Parser.symbol(",")),
    ),
    Parser.symbol(")"),
    Parser.optional(Parser.symbol(":")),
    Parser.optional(effectRecordSignature()),
    Parser.optional(type()),
    returnExpressionOrBlock(),
  ).pipe(
    Parser.map(([operation, typeParameters, _open, parameters, _close, _colon, effects, returnType, body]) => {
      return new AST.HandlerCase(
        operation,
        new AST.FunctionExpression(
          typeParameters?.typeParameters ?? [],
          parameters,
          returnType,
          effects,
          body,
          new AST.Span(operation.span.start, body.span.end),
        ),
        new AST.Span(operation.span.start, body.span.end),
      )
    }),
  );
}
