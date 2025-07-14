import * as AST from "../../ast/mod.ts";
import * as Parser from "../Parser.ts";
import { block } from "./Statement.ts";
import { effectRecordSignature, type, typeParametersList } from "./Type.ts";

export function expression(): Parser.Parser<AST.Expression> {
  return Parser.or(
    Parser.lazy(parenthesizedExpression),
    Parser.lazy(literals),
    Parser.lazy(arrayLiteral),
    Parser.lazy(recordLiteral),
    Parser.lazy(matchExpression),
    Parser.lazy(functionExpression),
    Parser.lazy(unaryExpression),
    Parser.lazy(binaryExpression),
  );
}

function parenthesizedExpression(): Parser.Parser<AST.Expression> {
  return Parser.seq(
    Parser.symbol("("),
    Parser.lazy(expression),
    Parser.symbol(")"),
  ).pipe(
    Parser.map(([_open, content, _close]) => content),
  );
}

export function arrayLiteral(): Parser.Parser<AST.ArrayLiteral> {
  return expression().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("["), Parser.symbol("]")),
    Parser.map(({ before, content, after }) =>
      new AST.ArrayLiteral(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

export function recordLiteral(): Parser.Parser<AST.RecordLiteral> {
  return field().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    Parser.map(({ before, content, after }) =>
      new AST.RecordLiteral(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

function field(): Parser.Parser<AST.RecordField> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol(":"),
    expression(),
  ).pipe(
    Parser.map(([name, _colon, value]) => new AST.RecordField(name, value)),
  );
}

export function literals() {
  return Parser.or(
    regexLiteral(),
    Parser.token("IntegerLiteral").pipe(
      Parser.map((token) =>
        new AST.IntegerLiteral(Number.parseInt(token.text, 10), token.span)
      ),
    ),
    Parser.token("FloatLiteral").pipe(
      Parser.map((token) =>
        new AST.FloatLiteral(Number.parseFloat(token.text), token.span)
      ),
    ),
    Parser.token("BigIntegerLiteral").pipe(
      Parser.map((token) =>
        new AST.BigIntLiteral(BigInt(token.text), token.span)
      ),
    ),
    Parser.token("BigDecimalLiteral").pipe(
      Parser.map((token) => {
        const [before, after] = token.text.split(".");
        return new AST.BigDecimalLiteral(
          BigInt(before),
          BigInt(after),
          token.span,
        );
      }),
    ),
    Parser.token("BooleanLiteral").pipe(
      Parser.map((token) =>
        new AST.BooleanLiteral(token.text === "true", token.span)
      ),
    ),
    Parser.token("StringLiteral").pipe(
      Parser.map((token) => new AST.StringLiteral(token.text.slice(1, -1), token.span)),
    ),
  );
}

function regexLiteral() {
  return Parser.sequence(
    Parser.zeroOrMore(Parser.or(
      Parser.token("Identifier"),
      Parser.token("Whitespace"),
      Parser.token("Symbol"),
    )).pipe(
      Parser.delimitedBy(Parser.symbol("/"), Parser.symbol("/")),
    ),
    Parser.optional(
      Parser.token("Identifier"),
    ),
  ).pipe(
    Parser.map(([{ before, content, after }, flags]) => {
      const start = before.span.start;
      const end = flags ? flags.span.end : after.span.end;
      const text = content.map((c) => c.text).join("");
      return new AST.RegexLiteral(
        text,
        flags?.text ?? null,
        new AST.Span(start, end),
      );
    }),
  );
}

export function matchExpression(): Parser.Parser<AST.MatchExpression> {
  return Parser.seq(
    Parser.token("match"),
    expression(),
    Parser.oneOrMore(matchCase()).pipe(
      Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    ),
  ).pipe(
    Parser.map(
      (
        [
          match,
          expression,
          { content: cases, after },
        ],
      ) => {
        return new AST.MatchExpression(
          expression,
          cases,
          new AST.Span(match.span.start, after.span.end),
        );
      },
    ),
  );
}

function matchCase(): Parser.Parser<AST.MatchCase> {
  return Parser.seq(
    matchCasePattern(),
    Parser.optional(matchCaseGuard()),
    returnExpressionOrBlock(),
  ).pipe(
    Parser.map(
      ([pattern, guard, expressionOrBlock]) => {
        return new AST.MatchCase(
          pattern,
          guard,
          expressionOrBlock,
          new AST.Span(pattern.span.start, expressionOrBlock.span.end),
        );
      },
    ),
  );
}

export function returnExpressionOrBlock(): Parser.Parser<AST.Expression | AST.Block> {
  return Parser.or(
    Parser.seq(Parser.symbol("=>"), expression()).pipe(
      Parser.map(([_arrow, expression]) => expression),
    ),
    Parser.lazy(block),
  );
}

function matchCasePattern(): Parser.Parser<AST.Pattern> {
  return Parser.or(
    literalPattern(),
    variablePattern(),
    wildcardPattern(),
    tupleConstructorPattern(),
    recordConstructorPattern(),
    voidConstructorPattern(),
    tuplePattern(),
  );
}

function literalPattern(): Parser.Parser<AST.LiteralPattern> {
  return literals().pipe(
    Parser.map((literal) => new AST.LiteralPattern(literal, literal.span)),
  );
}

function variablePattern(): Parser.Parser<AST.VariablePattern> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(Parser.symbol(":")),
    type(),
  ).pipe(
    Parser.map(([identifier, _colon, type]) =>
      new AST.VariablePattern(
        identifier,
        type,
        new AST.Span(identifier.span.start, type.span.end),
      )
    ),
  );
}

function wildcardPattern(): Parser.Parser<AST.WildcardPattern> {
  return Parser.symbol("_").pipe(
    Parser.map((wildcard) => new AST.WildcardPattern(wildcard.span)),
  );
}

function voidConstructorPattern(): Parser.Parser<AST.VoidConstructorPattern> {
  return Parser.token("Identifier").pipe(
    Parser.map((identifier) =>
      new AST.VoidConstructorPattern(identifier, identifier.span)
    ),
  );
}

function tupleConstructorPattern(): Parser.Parser<AST.TupleConstructorPattern> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol("("),
    Parser.lazy(matchCasePattern).pipe(
      Parser.separatedBy(Parser.symbol(",")),
    ),
    Parser.symbol(")"),
  ).pipe(
    Parser.map((
      [
        identifier,
        _openParen,
        patterns,
        close,
      ],
    ) =>
      new AST.TupleConstructorPattern(
        identifier,
        patterns,
        new AST.Span(identifier.span.start, close.span.end),
      )
    ),
  );
}

function recordConstructorPattern(): Parser.Parser<
  AST.RecordConstructorPattern
> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol("{"),
    Parser.lazy(recordPatternField).pipe(
      Parser.separatedBy(Parser.symbol(",")),
    ),
    Parser.symbol("}"),
  ).pipe(
    Parser.map((
      [
        identifier,
        _openBrace,
        fields,
        close,
      ],
    ) =>
      new AST.RecordConstructorPattern(
        identifier,
        fields,
        new AST.Span(identifier.span.start, close.span.end),
      )
    ),
  );
}

function recordPatternField(): Parser.Parser<AST.RecordPatternField> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(Parser.symbol(":")),
    Parser.optional(matchCasePattern()),
  ).pipe(
    Parser.map(([name, _colon, pattern]) =>
      new AST.RecordPatternField(
        name,
        pattern,
        new AST.Span(name.span.start, pattern?.span.end ?? name.span.end),
      )
    ),
  );
}

function tuplePattern(): Parser.Parser<AST.TuplePattern> {
  return Parser.seq(
    Parser.symbol("["),
    Parser.lazy(matchCasePattern).pipe(
      Parser.separatedBy(Parser.symbol(",")),
    ),
    Parser.symbol("]"),
  ).pipe(
    Parser.map(([open, patterns, close]) =>
      new AST.TuplePattern(
        patterns,
        new AST.Span(open.span.start, close.span.end),
      )
    ),
  );
}

function matchCaseGuard(): Parser.Parser<AST.Expression> {
  return Parser.seq(Parser.token("if"), expression()).pipe(
    Parser.map(([_if, guard]) => guard),
  );
}

export function functionExpression(): Parser.Parser<AST.FunctionExpression> {
  return Parser.seq(
    Parser.token("fun"),
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
          funKeyword,
          typeParameters,
          _openParen,
          parameters,
          _closeParen,
          _colon,
          effects,
          returnType,
          body,
        ],
      ) => {
        return new AST.FunctionExpression(
          typeParameters?.typeParameters ?? [],
          parameters,
          returnType,
          effects,
          body,
          new AST.Span(funKeyword.span.start, body.span.end),
        );
      },
    ),
  );
}

export function functionParameter(): Parser.Parser<AST.FunctionParameter> {
  return Parser.seq(
    Parser.or(Parser.token("Identifier"), Parser.keywordAsIdentifer()),
    Parser.symbol(":"),
    Parser.optional(effectRecordSignature()),
    type(),
  ).pipe(
    Parser.map((
      [
        identifier,
        _colon,
        effectRecordSignature,
        type,
      ],
    ) =>
      new AST.FunctionParameter(
        identifier,
        effectRecordSignature,
        type,
        new AST.Span(identifier.span.start, type.span.end),
      )
    ),
  );
}

export function unaryOperator(): Parser.Parser<AST.OperatorNode> {
  return Parser.or(
    Parser.symbol("-"),
    Parser.symbol("!"),
  ).pipe(
    Parser.map((symbol) => new AST.OperatorNode(symbol.text, symbol.span)),
  );
}

export function unaryExpression(): Parser.Parser<AST.UnaryExpression> {
  return Parser.sequence(
    unaryOperator(),
    expression(),
  ).pipe(
    Parser.map(([operator, operand]) =>
      new AST.UnaryExpression(
        operator,
        operand,
        new AST.Span(operator.span.start, operand.span.end),
      )
    ),
  );
}

export function binaryExpression(): Parser.Parser<AST.Expression> {
  return Parser.precedence(
    expression(),
    [
      // Exponentiation (right-associative)
      Parser.PrecedenceLevel.right(
        Parser.symbol("**").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
      ),

      // Multiplicative (*, /, %) (left-associative)
      Parser.PrecedenceLevel.left(
        Parser.symbol("*").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
        Parser.symbol("/").pipe(
          Parser.map((symbol) => (left, right) =>
            new AST.BinaryExpression(
              left,
              new AST.OperatorNode(symbol.text, symbol.span),
              right,
              new AST.Span(left.span.start, right.span.end),
            )
          ),
        ),
        Parser.symbol("%").pipe(
          Parser.map((symbol) => (left, right) =>
            new AST.BinaryExpression(
              left,
              new AST.OperatorNode(symbol.text, symbol.span),
              right,
              new AST.Span(left.span.start, right.span.end),
            )
          ),
        ),
      ),

      // Additive (+, -) (left-associative)
      Parser.PrecedenceLevel.left(
        Parser.symbol("+").pipe(
          Parser.map((symbol) => (left, right): AST.Expression =>
            new AST.BinaryExpression(
              left,
              new AST.OperatorNode(symbol.text, symbol.span),
              right,
              new AST.Span(left.span.start, right.span.end),
            )
          ),
        ),
        Parser.symbol("-").pipe(
          Parser.map((symbol) => (left, right): AST.Expression =>
            new AST.BinaryExpression(
              left,
              new AST.OperatorNode(symbol.text, symbol.span),
              right,
              new AST.Span(left.span.start, right.span.end),
            )
          ),
        ),
      ),

      // Comparison (==, !=, <, <=, >, >=) (none-associative)
      Parser.PrecedenceLevel.none(
        Parser.symbol("==").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
        Parser.symbol("!=").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
        Parser.symbol("<").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
        Parser.symbol("<=").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
        Parser.symbol(">").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
        Parser.symbol(">=").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
      ),

      // Logical AND (&&) (left-associative)
      Parser.PrecedenceLevel.left(
        Parser.symbol("&&").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
      ),

      // Logical OR (||) (left-associative)
      Parser.PrecedenceLevel.left(
        Parser.symbol("||").pipe(
          Parser.map(
            (symbol) =>
            (left: AST.Expression, right: AST.Expression): AST.Expression =>
              new AST.BinaryExpression(
                left,
                new AST.OperatorNode(symbol.text, symbol.span),
                right,
                new AST.Span(left.span.start, right.span.end),
              ),
          ),
        ),
      ),
    ],
  );
}
