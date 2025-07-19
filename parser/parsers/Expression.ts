import * as AST from "../../ast/mod.ts";
import { DiagnosticCode } from "../../diagnostics/Diagnostic.ts";
import * as Parser from "../Parser.ts";
import { pipe } from "../Pipeable.ts";
import { block } from "./Statement.ts";
import { effectRecordSignature, type, typeParametersList } from "./Type.ts";
import { ExpressionRecovery, DelimiterRecovery } from "../ErrorRecovery.ts";

// Demonstration function showing error recovery integration for expressions
// This function shows how error recovery can be integrated without breaking existing functionality
export function expressionWithRecovery(): Parser.Parser<AST.Expression> {
  return {
    parse(context: Parser.ParserContext): Parser.ParseResult<AST.Expression> {
      // Push parsing context for better error reporting
      context.pushParsingContext({
        name: "expression-with-recovery",
        expectedElements: ["expression"],
        recoveryStrategies: [new ExpressionRecovery(), new DelimiterRecovery()],
        metadata: { type: "expression" },
      });

      try {
        // Use the existing expression parser with recovery wrapper
        return Parser.recover(
          expression(),
          // Fallback parser that creates a placeholder expression
          {
            parse(ctx: Parser.ParserContext): Parser.ParseResult<AST.Expression> {
              const span = ctx.span();
              return new Parser.ParseSuccess(new AST.Identifier("__recovered__", span));
            },
            pipe,
          },
          new ExpressionRecovery()
        ).parse(context);
      } finally {
        context.popParsingContext();
      }
    },
    pipe,
  };
}

export function expression(): Parser.Parser<AST.Expression> {
  return Parser.or(
    Parser.lazy(binaryExpression),
    Parser.lazy(parenthesizedExpression),
  );
}

function parenthesizedExpression(): Parser.Parser<AST.Expression> {
  return Parser.lazy(expression).pipe(
    Parser.delimitedBy(Parser.symbol("("), Parser.symbol(")")),
    Parser.map(({ content }) => content),
  );
}

export function arrayLiteral(): Parser.Parser<AST.ArrayLiteral> {
  return expression().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.optional,
    Parser.delimitedBy(Parser.symbol("["), Parser.symbol("]")),
    Parser.map(({ before, content, after }) =>
      new AST.ArrayLiteral(
        content ?? [],
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

export function recordLiteral(): Parser.Parser<AST.RecordLiteral> {
  return field().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.optional,
    Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    Parser.map(({ before, content, after }) =>
      new AST.RecordLiteral(
        content ?? [],
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
      Parser.map((token) =>
        new AST.StringLiteral(token.text.slice(1, -1), token.span)
      ),
    ),
  );
}

export function regexLiteral(): Parser.Parser<AST.RegexLiteral> {
  return {
    parse(context: Parser.ParserContext): Parser.ParseResult<AST.RegexLiteral> {
      // Check if we're at end of input
      if (context.isAtEnd()) {
        return Parser.ParseFailure.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          "Expected '/' but reached end of input",
          context.span(),
        );
      }

      const startToken = context.peek();
      const startSpan = startToken.span;

      // Parse opening slash
      const open = context.peek();
      if (open.kind !== "Symbol" || open.text !== "/") {
        return Parser.ParseFailure.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Expected '/' but got ${open.kind}`,
          open.span,
        );
      }
      context.consume();

      // Parse regex pattern
      let pattern: string = "";
      let current = context.peek();
      let depth = 0; // Track bracket/brace depth
      let inCharacterClass = false;
      let escaped = false;

      while (
        current &&
        !(current.kind === "Symbol" && current.text === "/" && depth === 0 &&
          !inCharacterClass)
      ) {
        const currentText = current.toString();

        if (escaped) {
          // Handle escaped characters
          pattern += "\\" + currentText;
          escaped = false;
        } else if (currentText === "\\") {
          // Start escape sequence
          pattern += currentText;
          escaped = true;
        } else if (currentText === "[" && !inCharacterClass) {
          // Start character class
          pattern += currentText;
          inCharacterClass = true;
        } else if (currentText === "]" && inCharacterClass) {
          // End character class
          pattern += currentText;
          inCharacterClass = false;
        } else if (currentText === "(" && !inCharacterClass) {
          // Start group
          pattern += currentText;
          depth++;
        } else if (currentText === ")" && !inCharacterClass && depth > 0) {
          // End group
          pattern += currentText;
          depth--;
        } else if (currentText === "{" && !inCharacterClass) {
          // Start quantifier
          pattern += currentText;
          depth++;
        } else if (currentText === "}" && !inCharacterClass && depth > 0) {
          // End quantifier
          pattern += currentText;
          depth--;
        } else {
          // Regular character
          pattern += currentText;
        }

        context.consume();
        current = context.peek();

        // Check for end of input
        if (!current) {
          return Parser.ParseFailure.error(
            DiagnosticCode.PREMATURE_EOF,
            "Unterminated regex literal",
            startSpan,
          );
        }
      }

      // Parse closing slash
      const close = context.peek();
      if (close.kind !== "Symbol" || close.text !== "/") {
        return Parser.ParseFailure.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          "Expected '/'",
          close.span,
        );
      }
      context.consume();

      // Parse flags
      let flags: string = "";
      current = context.peek();

      while (current && current.kind === "Identifier") {
        const flagChar = current.text;
        // Validate flag characters (only allow valid regex flags)
        if (flagChar.length === 1 && /[gimsuy]/.test(flagChar)) {
          if (flags.includes(flagChar)) {
            return Parser.ParseFailure.error(
              DiagnosticCode.UNEXPECTED_TOKEN,
              `Duplicate flag '${flagChar}'`,
              current.span,
            );
          }
          flags += flagChar;
          context.consume();
          current = context.peek();
        } else {
          break;
        }
      }

      const endSpan = context.peek() ? context.peek().span : startSpan;

      return new Parser.ParseSuccess(
        new AST.RegexLiteral(
          pattern,
          flags || null,
          new AST.Span(startSpan.start, endSpan.end),
        ),
      );
    },
    pipe,
  };
}

export function matchExpression(): Parser.Parser<AST.MatchExpression> {
  return Parser.seq(
    Parser.token("match"),
    expression(),
    matchCase().pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.optional,
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
          cases ?? [],
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

export function returnExpressionOrBlock(): Parser.Parser<
  AST.Expression | AST.Block
> {
  return Parser.seq(
    Parser.symbol("=>"),
    Parser.or(
      Parser.lazy(block),
      expression(),
    ),
  ).pipe(
    Parser.map(([_arrow, expressionOrBlock]) => expressionOrBlock),
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
    Parser.symbol(":"),
    type(),
  ).pipe(
    Parser.map(([identifier, _, type]) =>
      new AST.VariablePattern(
        identifier,
        type,
        new AST.Span(
          identifier.span.start,
          type?.span.end ?? identifier.span.end,
        ),
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
    type(),
  ).pipe(
    Parser.map((
      [
        identifier,
        _colon,
        type,
      ],
    ) =>
      new AST.FunctionParameter(
        identifier,
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
  return Parser.seq(
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

function postfixExpression(): Parser.Parser<AST.Expression> {
  return Parser.seq(
    Parser.lazy(primaryExpression),
    Parser.zeroOrMore(
      Parser.or(
        // Property access: .identifier
        Parser.seq(
          Parser.symbol("."),
          Parser.token("Identifier"),
        ).pipe(
          Parser.map(([_dot, property]) => ({
            type: "property" as const,
            property,
          })),
        ),
        // Index access: [expr]
        Parser.seq(
          Parser.symbol("["),
          Parser.lazy(expression),
          Parser.symbol("]"),
        ).pipe(
          Parser.map(([_open, index, _close]) => ({
            type: "index" as const,
            index,
          })),
        ),
        // Call: (args)
        Parser.seq(
          Parser.symbol("("),
          Parser.optional(
            Parser.lazy(expression).pipe(
              Parser.separatedBy(Parser.symbol(",")),
            ),
          ),
          Parser.symbol(")"),
        ).pipe(
          Parser.map(([_open, args, _close]) => ({
            type: "call" as const,
            args: args ?? [],
          })),
        ),
      ),
    ),
  ).pipe(
    Parser.map(([base, postfixes]) => {
      return postfixes.reduce((object: AST.Expression, op) => {
        if (op.type === "property") {
          return new AST.PropertyAccess(
            object,
            new AST.Identifier(op.property.text, op.property.span),
            new AST.Span(object.span.start, op.property.span.end),
          );
        } else if (op.type === "index") {
          return new AST.IndexAccess(
            object,
            op.index,
            new AST.Span(object.span.start, op.index.span.end),
          );
        } else if (op.type === "call") {
          return new AST.CallExpression(
            object,
            op.args,
            new AST.Span(
              object.span.start,
              op.args.length > 0
                ? op.args[op.args.length - 1].span.end
                : object.span.end,
            ),
          );
        } else {
          return object;
        }
      }, base);
    }),
  );
}

// Primary expression parser for expressions that don't involve binary operators
function primaryExpression(): Parser.Parser<AST.Expression> {
  return Parser.or(
    Parser.lazy(parenthesizedExpression),
    Parser.lazy(literals),
    Parser.lazy(arrayLiteral),
    Parser.lazy(recordLiteral),
    Parser.lazy(matchExpression),
    Parser.lazy(functionExpression),
    Parser.lazy(unaryExpression),
    Parser.lazy(callExpression),
  );
}

function callExpression(): Parser.Parser<AST.Expression> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(
      Parser.seq(
        Parser.symbol("("),
        Parser.optional(
          expression().pipe(
            Parser.separatedBy(Parser.symbol(",")),
          ),
        ),
        Parser.symbol(")"),
      ),
    ),
  ).pipe(
    Parser.map(([identifier, args]) => {
      if (!args) {
        return new AST.Identifier(identifier.text, identifier.span);
      }
      return new AST.CallExpression(
        new AST.Identifier(identifier.text, identifier.span),
        args[1] ?? [], // args[1] is the optional expression list
        new AST.Span(identifier.span.start, args[2].span.end), // args[2] is the closing parenthesis
      );
    }),
  );
}

export function binaryExpression(): Parser.Parser<AST.Expression> {
  return Parser.precedence(
    Parser.lazy(postfixExpression),
    [
      // Assignment (=, +=, -=, *=, /=, %=, **=) (right-associative) - lowest precedence
      Parser.PrecedenceLevel.right(
        Parser.or(
          Parser.symbol("="),
          Parser.symbol("+="),
          Parser.symbol("-="),
          Parser.symbol("*="),
          Parser.symbol("/="),
          Parser.symbol("%="),
          Parser.symbol("**="),
        ).pipe(
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

      // Additive (+, -) (left-associative)
      Parser.PrecedenceLevel.left(
        Parser.symbol("+").pipe(
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
        Parser.symbol("-").pipe(
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
        Parser.symbol("%").pipe(
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

      // Exponentiation (right-associative) - highest precedence
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
    ],
  );
}
