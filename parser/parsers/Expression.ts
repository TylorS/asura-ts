import * as AST from "../../ast/mod.ts";
import * as Parser from "../Parser.ts";

export function arrayLiteral(
  element: Parser.Parser<AST.Expression>,
): Parser.Parser<AST.ArrayLiteral> {
  return element.pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimited(Parser.symbol("["), Parser.symbol("]")),
    Parser.map(({ before, content, after }) =>
      new AST.ArrayLiteral(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

export function recordLiteral(expression: Parser.Parser<AST.Expression>) {
  return field(expression).pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimited(Parser.symbol("{"), Parser.symbol("}")),
  )
}

function field(expression: Parser.Parser<AST.Expression>) { 
  return Parser.sequence(
    Parser.token("Identifier"),
    Parser.zeroOrMore(Parser.token("Whitespace")),
    Parser.symbol(":"),
    Parser.zeroOrMore(Parser.token("Whitespace")),
    expression,
  )
}

export function literals() {
  return Parser.or(
    Parser.token("IntegerLiteral").pipe(
      Parser.map((token) => new AST.IntegerLiteral(Number.parseInt(token.text, 10), token.span)),
    ),
    Parser.token("FloatLiteral").pipe(
      Parser.map((token) => new AST.FloatLiteral(Number.parseFloat(token.text), token.span)),
    ),
    Parser.token("BigIntegerLiteral").pipe(
      Parser.map((token) => new AST.BigIntLiteral(BigInt(token.text), token.span)),
    ),
    Parser.token("BigDecimalLiteral").pipe(
      Parser.map((token) => {
        const [before, after] = token.text.split(".");
        return new AST.BigDecimalLiteral(BigInt(before), BigInt(after), token.span);
      }),
    ),
    Parser.token("BooleanLiteral").pipe(
      Parser.map((token) => new AST.BooleanLiteral(token.text === "true", token.span)),
    ),
    Parser.token("StringLiteral").pipe(
      Parser.map((token) => new AST.StringLiteral(token.text, token.span)),
    ),
    Parser.sequence(
      Parser.zeroOrMore(Parser.or(
        Parser.token("Identifier"),
        Parser.token("Symbol")
      )).pipe(
        Parser.delimited(Parser.symbol("/"), Parser.symbol("/"))
      ),
      Parser.optional(
        Parser.token("Identifier")
      )
    ).pipe(
      Parser.map(([{ before, content, after }, flags]) => {
        const start = before.span.start
        const end = flags ? flags.span.end : after.span.end
        const text = content.map(c => c.text).join("")
        return new AST.RegexLiteral(text, flags?.text ?? null, new AST.Span(start, end));
      }),
    )
  );
}
