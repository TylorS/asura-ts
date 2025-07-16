import * as Parser from "../Parser.ts";
import * as AST from "../../ast/mod.ts";
import {
  expression,
  functionParameter,
  returnExpressionOrBlock,
} from "./Expression.ts";
import { Span } from "../../tokens/Span.ts";
import {
  effectRecordSignature,
  recordTypeField,
  type,
  typeParametersList,
  typeReference,
} from "./Type.ts";

export function statement(): Parser.Parser<AST.Statement> {
  return Parser.or(
    comment(),
    multilineComment(),
    declaration(),
    controlFlow(),
    expressionStatement(),
  );
}

function comment(): Parser.Parser<AST.Comment> {
  return Parser.token("Comment").pipe(
    Parser.map((token) => new AST.Comment(token.text, token.span)),
  );
}

function multilineComment(): Parser.Parser<AST.MultilineComment> {
  return Parser.token("MultiLineComment").pipe(
    Parser.map((token) => new AST.MultilineComment(token.text, token.span)),
  );
}

export function declaration(): Parser.Parser<AST.Declaration> {
  return Parser.or(
    exportableDeclaration(),
    importDeclaration(),
  );
}

export function exportableDeclaration(): Parser.Parser<
  AST.ExportableDeclaration
> {
  return Parser.or(
    dataDeclaration(),
    effectDeclaration(),
    functionDeclaration(),
    interfaceDeclaration(),
    letDeclaration(),
    typeAliasDeclaration(),
  );
}

export function importDeclaration(): Parser.Parser<AST.ImportDeclaration> {
  return Parser.seq(
    Parser.token("import"),
    Parser.or(namespaceImport(), namedImports()),
    Parser.literal("from'"),
    Parser.token("StringLiteral").pipe(
      Parser.map((token) => new AST.StringLiteral(token.text, token.span)),
    ),
  ).pipe(
    Parser.map(([importKeyword, imports, _from, specifier]) => {
      return new AST.ImportDeclaration(
        importKeyword,
        imports,
        specifier,
        new AST.Span(importKeyword.span.start, specifier.span.end),
      );
    }),
  );
}

function namespaceImport(): Parser.Parser<AST.NamespaceImport> {
  return Parser.seq(
    Parser.symbol("*"),
    Parser.literal("as"),
    Parser.token("Identifier"),
  ).pipe(
    Parser.map(([_, _as, _identifier]) => {
      return new AST.NamespaceImport(_identifier);
    }),
  );
}

function namedImports(): Parser.Parser<AST.NamedImports> {
  return namedImport().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
  ).pipe(
    Parser.map(({ content }) =>
      new AST.NamedImports(
        content,
        new AST.Span(
          content[0].span.start,
          content[content.length - 1].span.end,
        ),
      )
    ),
  );
}

function namedImport(): Parser.Parser<AST.NamedImport> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(
      Parser.seq(Parser.token("as"), Parser.token("Identifier")),
    ),
  ).pipe(
    Parser.map(([name, alias]) => {
      return new AST.NamedImport(
        name,
        alias?.[0] ?? null,
        alias?.[1] ?? null,
        new AST.Span(name.span.start, alias?.[1]?.span.end ?? name.span.end),
      );
    }),
  );
}

export function dataDeclaration(): Parser.Parser<AST.DataDeclaration> {
  return Parser.seq(
    Parser.optional(Parser.token("export")),
    Parser.token("data"),
    Parser.token("Identifier"),
    Parser.optional(typeParametersList()),
    Parser.symbol("="),
    dataConstructor().pipe(
      Parser.separatedBy(Parser.symbol("|")),
    ),
  ).pipe(
    Parser.map(
      (
        [
          exportKeyword,
          dataKeyword,
          name,
          typeParameters,
          _equals,
          constructors,
        ],
      ) => {
        return new AST.DataDeclaration(
          exportKeyword,
          name,
          typeParameters?.typeParameters ?? [],
          constructors,
          new AST.Span(
            exportKeyword?.span.start ?? dataKeyword.span.start,
            constructors[constructors.length - 1].span.end,
          ),
        );
      },
    ),
  );
}

function dataConstructor(): Parser.Parser<AST.DataConstructor> {
  return Parser.or(
    voidConstructor(),
    tupleConstructor(),
    recordConstructor(),
  );
}

function voidConstructor(): Parser.Parser<AST.VoidConstructor> {
  return Parser.token("Identifier").pipe(
    Parser.map((token) => new AST.VoidConstructor(token, token.span)),
  );
}

function tupleConstructor(): Parser.Parser<AST.TupleConstructor> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol("("),
    Parser.or(
      type(),
      recordConstructorField(),
    ).pipe(
      Parser.separatedBy(Parser.symbol(",")),
    ).pipe(
      Parser.delimitedBy(Parser.symbol("("), Parser.symbol(")")),
    ),
    Parser.symbol(")"),
  ).pipe(
    Parser.map(([name, _lparen, fields, _rparen]) => {
      return new AST.TupleConstructor(
        name,
        fields.content,
        new AST.Span(name.span.start, _rparen.span.end),
      );
    }),
  );
}

function recordConstructorField(): Parser.Parser<AST.RecordConstructorField> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(Parser.symbol("?")),
    Parser.symbol(":"),
    type(),
  ).pipe(
    Parser.map(([name, optional, _colon, type]) =>
      new AST.RecordConstructorField(name, type, optional !== null)
    ),
  );
}

function recordConstructor(): Parser.Parser<AST.RecordConstructor> {
  return Parser.seq(
    Parser.token("Identifier"),
    recordConstructorField().pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    ),
  ).pipe(
    Parser.map(([name, fields]) => {
      return new AST.RecordConstructor(
        name,
        fields.content,
        new AST.Span(name.span.start, fields.after.span.end),
      );
    }),
  );
}

export function effectDeclaration(): Parser.Parser<AST.EffectDeclaration> {
  return Parser.seq(
    Parser.optional(Parser.token("export")),
    Parser.token("effect"),
    Parser.token("Identifier"),
    Parser.optional(typeParametersList()),
    recordTypeField().pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    ),
  ).pipe(
    Parser.map(
      ([exportKeyword, effectKeyword, name, typeParameters, fields]) => {
        return new AST.EffectDeclaration(
          exportKeyword,
          name,
          typeParameters?.typeParameters ?? [],
          fields.content,
          new AST.Span(
            exportKeyword?.span.start ?? effectKeyword.span.start,
            fields.after.span.end,
          ),
        );
      },
    ),
  );
}

export function functionDeclaration(): Parser.Parser<AST.FunctionDeclaration> {
  return Parser.seq(
    Parser.optional(Parser.token("export")),
    Parser.token("fun"),
    Parser.token("Identifier"),
    Parser.optional(typeParametersList()),
    Parser.symbol("("),
    functionParameter().pipe(
      Parser.separatedBy(Parser.symbol(",")),
    ),
    Parser.symbol(")"),
    Parser.symbol(":"),
    Parser.optional(effectRecordSignature()),
    type(),
    returnExpressionOrBlock(),
  ).pipe(
    Parser.map(
      (
        [
          exportKeyword,
          funKeyword,
          name,
          typeParameters,
          _lparen,
          parameters,
          _rparen,
          _colon,
          effectRecordSignature,
          returnType,
          returnExpressionOrBlock,
        ],
      ) => {
        return new AST.FunctionDeclaration(
          exportKeyword,
          name,
          typeParameters?.typeParameters ?? [],
          parameters,
          effectRecordSignature,
          returnType,
          returnExpressionOrBlock,
          new AST.Span(
            exportKeyword?.span.start ?? funKeyword.span.start,
            returnExpressionOrBlock.span.end,
          ),
        );
      },
    ),
  );
}

export function interfaceDeclaration(): Parser.Parser<
  AST.InterfaceDeclaration
> {
  return Parser.seq(
    Parser.optional(Parser.token("export")),
    Parser.token("interface"),
    Parser.token("Identifier"),
    Parser.optional(typeParametersList()),
    Parser.optional(
      Parser.seq(
        Parser.token("extends"),
        Parser.oneOrMore(typeReference()),
      ),
    ),
    recordTypeField().pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    ),
  ).pipe(
    Parser.map(
      (
        [
          exportKeyword,
          _interfaceKeyword,
          name,
          typeParameters,
          extendsClause,
          fields,
        ],
      ) => {
        return new AST.InterfaceDeclaration(
          exportKeyword,
          name,
          typeParameters?.typeParameters ?? [],
          extendsClause?.[1] ?? [],
          fields.content,
          new AST.Span(
            exportKeyword?.span.start ?? _interfaceKeyword.span.start,
            fields.after.span.end,
          ),
        );
      },
    ),
  );
}

export function letDeclaration(): Parser.Parser<AST.LetDeclaration> {
  return Parser.seq(
    Parser.optional(Parser.token("export")),
    Parser.token("let"),
    Parser.optional(Parser.token("mut")),
    Parser.token("Identifier"),
    Parser.optional(Parser.seq(Parser.symbol(":"), type())),
    Parser.symbol("="),
    expression(),
  ).pipe(
    Parser.map(
      (
        [
          exportKeyword,
          letKeyword,
          mutableKeyword,
          name,
          typeAnnotation,
          _equals,
          expression,
        ],
      ) => {
        return new AST.LetDeclaration(
          exportKeyword,
          mutableKeyword,
          name,
          typeAnnotation?.[1] ?? null,
          expression,
          new AST.Span(
            exportKeyword?.span.start ?? letKeyword.span.start,
            expression.span.end,
          ),
        );
      },
    ),
  );
}

export function typeAliasDeclaration(): Parser.Parser<
  AST.TypeAliasDeclaration
> {
  return Parser.seq(
    Parser.optional(Parser.token("export")),
    Parser.token("type"),
    Parser.token("Identifier"),
    Parser.optional(typeParametersList()),
    Parser.symbol("="),
    type(),
  ).pipe(
    Parser.map(
      ([exportKeyword, typeKeyword, name, typeParameters, _equals, type]) => {
        return new AST.TypeAliasDeclaration(
          exportKeyword,
          name,
          typeParameters?.typeParameters ?? [],
          type,
          new AST.Span(
            exportKeyword?.span.start ?? typeKeyword.span.start,
            type.span.end,
          ),
        );
      },
    ),
  );
}

export function controlFlow(): Parser.Parser<AST.ControlFlow> {
  return Parser.or(
    forInStatement(),
    forOfStatement(),
    forStatement(),
    ifStatement(),
    whileStatement(),
  );
}

const BlockWithControlFlow = Parser.lazy(() =>
  block<AST.ContinueStatement | AST.BreakStatement>(
    continueStatement(),
    breakStatement(),
  )
);

export function forInStatement(): Parser.Parser<AST.ForInStatement> {
  return Parser.seq(
    Parser.optional(Parser.seq(Parser.token("Identifier"), Parser.symbol(":"))),
    Parser.token("for"),
    Parser.token("Identifier"),
    Parser.token("in"),
    expression(),
    BlockWithControlFlow,
  ).pipe(
    Parser.map(([label, _for, identifier, _in, expression, block]) => {
      return new AST.ForInStatement(
        label?.[0] ?? null,
        identifier,
        expression,
        block,
        new AST.Span(label?.[0]?.span.start ?? _for.span.start, block.span.end),
      );
    }),
  );
}

export function continueStatement(): Parser.Parser<AST.ContinueStatement> {
  return Parser.seq(
    Parser.token("continue"),
    Parser.optional(Parser.token("Identifier")),
  ).pipe(
    Parser.map(([_continue, label]) => {
      return new AST.ContinueStatement(
        label,
        label ? new Span(_continue.span.start, label.span.end) : _continue.span,
      );
    }),
  );
}

export function breakStatement(): Parser.Parser<AST.BreakStatement> {
  return Parser.seq(
    Parser.token("break"),
    Parser.optional(Parser.token("Identifier")),
  ).pipe(
    Parser.map(([_break, label]) => {
      return new AST.BreakStatement(
        label,
        label ? new Span(_break.span.start, label.span.end) : _break.span,
      );
    }),
  );
}

export function forOfStatement(): Parser.Parser<AST.ForOfStatement> {
  return Parser.seq(
    Parser.optional(Parser.seq(Parser.token("Identifier"), Parser.symbol(":"))),
    Parser.token("for"),
    Parser.token("Identifier"),
    Parser.token("of"),
    expression(),
    Parser.lazy(() =>
      block<AST.ContinueStatement | AST.BreakStatement>(
        continueStatement(),
        breakStatement(),
      )
    ),
  ).pipe(
    Parser.map(([label, _for, identifier, _of, expression, block]) => {
      return new AST.ForOfStatement(
        label?.[0] ?? null,
        identifier,
        expression,
        block,
        new AST.Span(label?.[0]?.span.start ?? _for.span.start, block.span.end),
      );
    }),
  );
}

export function forStatement(): Parser.Parser<AST.ForStatement> {
  return Parser.seq(
    Parser.optional(Parser.seq(Parser.token("Identifier"), Parser.symbol(":"))),
    Parser.token("for"),
    Parser.symbol("("),
    Parser.optional(letDeclaration()),
    Parser.symbol(";"),
    Parser.optional(expression()),
    Parser.symbol(";"),
    Parser.optional(expression()),
    Parser.symbol(")"),
    Parser.lazy(() =>
      block<AST.ContinueStatement | AST.BreakStatement>(
        continueStatement(),
        breakStatement(),
      )
    ),
  ).pipe(
    Parser.map(
      (
        [
          label,
          _for,
          _lparen,
          init,
          _semi1,
          condition,
          _semi2,
          increment,
          _rparen,
          block,
        ],
      ) => {
        return new AST.ForStatement(
          label?.[0] ?? null,
          init ?? null,
          condition ?? null,
          increment ?? null,
          block,
          new AST.Span(
            label?.[0]?.span.start ?? _for.span.start,
            block.span.end,
          ),
        );
      },
    ),
  );
}

export function ifStatement(): Parser.Parser<AST.IfStatement> {
  return Parser.seq(
    Parser.token("if"),
    Parser.symbol("("),
    expression(),
    Parser.symbol(")"),
    BlockWithControlFlow,
    Parser.optional(Parser.zeroOrMore(elseIfStatement())),
    Parser.optional(elseStatement()),
  ).pipe(
    Parser.map(([_if, _lparen, condition, _rparen, then, elseIfs, else_]) => {
      return new AST.IfStatement(
        condition,
        then,
        elseIfs ?? [],
        else_ ?? null,
        new AST.Span(_if.span.start, else_?.span.end ?? then.span.end),
      );
    }),
  );
}

export function elseIfStatement(): Parser.Parser<{
  condition: AST.Expression;
  block: AST.Block<AST.ContinueStatement | AST.BreakStatement>;
}> {
  return Parser.seq(
    Parser.token("else"),
    Parser.token("if"),
    Parser.symbol("("),
    expression(),
    Parser.symbol(")"),
    BlockWithControlFlow,
  ).pipe(
    Parser.map(([_else, _if, _lparen, condition, _rparen, block]) => {
      return {
        condition,
        block,
      };
    }),
  );
}

export function elseStatement(): Parser.Parser<
  AST.Block<AST.ContinueStatement | AST.BreakStatement>
> {
  return Parser.seq(
    Parser.token("else"),
    BlockWithControlFlow,
  ).pipe(
    Parser.map(([_else, block]) => block),
  );
}

export function whileStatement(): Parser.Parser<AST.WhileStatement> {
  return Parser.seq(
    Parser.token("while"),
    Parser.symbol("("),
    expression(),
    Parser.symbol(")"),
    BlockWithControlFlow,
  ).pipe(
    Parser.map(([_while, _lparen, condition, _rparen, block]) => {
      return new AST.WhileStatement(
        condition,
        block,
        new AST.Span(_while.span.start, block.span.end),
      );
    }),
  );
}

export function expressionStatement(): Parser.Parser<AST.ExpressionStatement> {
  return expression().pipe(
    Parser.map((expression) =>
      new AST.ExpressionStatement(expression, expression.span)
    ),
  );
}

export function block<T = never>(
  ...statements: Parser.Parser<T>[]
): Parser.Parser<AST.Block<T>> {
  return Parser.seq(
    Parser.symbol("{"),
    Parser.zeroOrMore(Parser.or(returnStatement(), Parser.lazy(statement), ...statements)),
    Parser.symbol("}"),
  ).pipe(
    Parser.map(([before, content, after]) =>
      new AST.Block<T>(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

export function returnStatement(): Parser.Parser<AST.ReturnStatement> {
  return Parser.seq(
    Parser.token("return"),
    expression(),
  ).pipe(
    Parser.map(([_return, expression]) =>
      new AST.ReturnStatement(
        expression,
        new AST.Span(_return.span.start, expression.span.end),
      )
    ),
  );
}
