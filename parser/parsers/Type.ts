import * as Parser from "../Parser.ts";
import * as AST from "../../ast/mod.ts";
import { Symbol } from "../../tokens/Token.ts";

export function type(): Parser.Parser<AST.Type> {
  return Parser.or(
    Parser.lazy(bigDecimalType),
    Parser.lazy(bigDecimalLiteralType),
    Parser.lazy(bigIntType),
    Parser.lazy(bigIntLiteralType),
    Parser.lazy(booleanType),
    Parser.lazy(booleanLiteralType),
    Parser.lazy(effectType),
    Parser.lazy(floatType),
    Parser.lazy(floatLiteralType),
    Parser.lazy(functionType),
    Parser.lazy(integerType),
    Parser.lazy(integerLiteralType),
    Parser.lazy(intersectionType),
    Parser.lazy(recordType),
    Parser.lazy(recordType),
    Parser.lazy(regexType),
    Parser.lazy(regexLiteralType),
    Parser.lazy(stringType),
    Parser.lazy(stringLiteralType),
    Parser.lazy(tupleType),
    Parser.lazy(typeReference),
    Parser.lazy(unionType),
  );
}

export function bigDecimalType(): Parser.Parser<AST.BigDecimalType> {
  return Parser.literal("BigDecimal").pipe(
    Parser.map((token) => new AST.BigDecimalType(token.span)),
  );
}

export function bigDecimalLiteralType(): Parser.Parser<
  AST.BigDecimalLiteralType
> {
  return Parser.token("BigDecimalLiteral").pipe(
    Parser.map((token) =>
      new AST.BigDecimalLiteralType(token.text, token.span)
    ),
  );
}

export function bigIntType(): Parser.Parser<AST.BigIntType> {
  return Parser.literal("BigInt").pipe(
    Parser.map((token) => new AST.BigIntType(token.span)),
  );
}

export function bigIntLiteralType(): Parser.Parser<AST.BigIntLiteralType> {
  return Parser.literal("BigInt").pipe(
    Parser.map((token) =>
      new AST.BigIntLiteralType(BigInt(token.text), token.span)
    ),
  );
}

export function booleanType(): Parser.Parser<AST.BooleanType> {
  return Parser.literal("Boolean").pipe(
    Parser.map((token) => new AST.BooleanType(token.span)),
  );
}

export function booleanLiteralType(): Parser.Parser<AST.BooleanLiteralType> {
  return Parser.token("BooleanLiteral").pipe(
    Parser.map((token) =>
      new AST.BooleanLiteralType(token.text === "true", token.span)
    ),
  );
}

export function effectType(): Parser.Parser<AST.EffectType> {
  // TODO:
  return Parser.or();
}

export function floatType(): Parser.Parser<AST.FloatType> {
  return Parser.literal("Float").pipe(
    Parser.map((token) => new AST.FloatType(token.span)),
  );
}

export function floatLiteralType(): Parser.Parser<AST.FloatLiteralType> {
  return Parser.token("FloatLiteral").pipe(
    Parser.map((token) =>
      new AST.FloatLiteralType(Number.parseFloat(token.text), token.span)
    ),
  );
}

export function integerType(): Parser.Parser<AST.IntegerType> {
  return Parser.literal("Int").pipe(
    Parser.map((token) => new AST.IntegerType(token.span)),
  );
}

export function integerLiteralType(): Parser.Parser<AST.IntegerLiteralType> {
  return Parser.token("IntegerLiteral").pipe(
    Parser.map((token) =>
      new AST.IntegerLiteralType(Number.parseInt(token.text, 10), token.span)
    ),
  );
}

export function intersectionType(): Parser.Parser<AST.IntersectionType> {
  return type().pipe(
    Parser.separatedBy(Parser.symbol("&")),
    Parser.map((types) =>
      new AST.IntersectionType(
        types,
        new AST.Span(types[0].span.start, types[types.length - 1].span.end),
      )
    ),
  );
}

export function recordType(): Parser.Parser<AST.RecordType> {
  return Parser.lazy(recordTypeField).pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    Parser.map(({ before, content, after }) =>
      new AST.RecordType(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

export function recordTypeField(): Parser.Parser<AST.RecordFieldType> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(Parser.symbol("?")),
    Parser.symbol(":"),
    type(),
  ).pipe(
    Parser.map(([name, optional, _colon, type]) =>
      new AST.RecordFieldType(name, type, optional !== null)
    ),
  );
}

export function regexType(): Parser.Parser<AST.RegexType> {
  return Parser.literal("Regex").pipe(
    Parser.map((token) => new AST.RegexType(token.span)),
  );
}

export function regexLiteralType(): Parser.Parser<AST.RegexLiteralType> {
  return Parser.sequence(
    Parser.zeroOrMore(Parser.or(
      Parser.token("Identifier"),
      Parser.token("Whitespace"),
      Parser.token("Symbol"),
    )).pipe(
      Parser.delimitedBy(Parser.symbol("/"), Parser.symbol("/")),
    ),
    Parser.optional(Parser.token("Identifier")),
  ).pipe(
    Parser.map(([{ before, content, after }, flags]) =>
      new AST.RegexLiteralType(
        content.map((c) => c.text).join(""),
        flags?.text ?? null,
        new AST.Span(before.span.start, flags?.span.end ?? after.span.end),
      )
    ),
  );
}

export function stringType(): Parser.Parser<AST.StringType> {
  return Parser.literal("String").pipe(
    Parser.map((token) => new AST.StringType(token.span)),
  );
}

export function stringLiteralType(): Parser.Parser<AST.StringLiteralType> {
  return Parser.token("StringLiteral").pipe(
    Parser.map((token) => new AST.StringLiteralType(token.text, token.span)),
  );
}

export function tupleType(): Parser.Parser<AST.TupleType> {
  return tupleElement().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("["), Parser.symbol("]")),
    Parser.map(({ before, content, after }) =>
      new AST.TupleType(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

function tupleElement(): Parser.Parser<AST.TupleElement> {
  return Parser.seq(
    Parser.optional(
      Parser.seq(
        Parser.token("Identifier"),
        Parser.optional(Parser.symbol("?")),
        Parser.symbol(":"),
      ),
    ),
    Parser.or(type(), spreadType()),
  ).pipe(
    Parser.map(([name, type]) => {
      return new AST.TupleElement(
        type,
        name?.[0] ?? null,
        name?.[1] !== null,
        new AST.Span(name?.[0]?.span.start ?? type.span.start, type.span.end),
      );
    }),
  );
}

function spreadType(): Parser.Parser<AST.SpreadType> {
  return Parser.sequence(
    Parser.symbol("..."),
    typeReference(),
  ).pipe(
    Parser.map(([_, type]) =>
      new AST.SpreadType(type, new AST.Span(type.span.start, type.span.end))
    ),
  );
}

export function unionType(): Parser.Parser<AST.UnionType> {
  return type().pipe(
    Parser.separatedBy(Parser.symbol("|")),
    Parser.map((types) =>
      new AST.UnionType(
        types,
        new AST.Span(types[0].span.start, types[types.length - 1].span.end),
      )
    ),
  );
}

export function functionType(): Parser.Parser<AST.FunctionType> {
  return Parser.seq(
    Parser.optional(typeParametersList()),
    functionParameterType().pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.delimitedBy(Parser.symbol("("), Parser.symbol(")")),
    ),
    Parser.symbol("=>"),
    Parser.optional(effectRecordSignature()),
    type(),
  ).pipe(
    Parser.map(([typeParameters, parameters, _arrow, effects, returnType]) =>
      new AST.FunctionType(
        typeParameters?.typeParameters ?? [],
        parameters.content,
        effects,
        returnType,
        new AST.Span(
          typeParameters?.open.span.start ?? parameters.before.span.start,
          returnType.span.end,
        ),
      )
    ),
  );
}

function functionParameterType(): Parser.Parser<AST.FunctionParameterType> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol(":"),
    Parser.optional(effectRecordSignature()),
    type(),
  ).pipe(
    Parser.map(([name, _colon, effects, type]) =>
      new AST.FunctionParameterType(
        name,
        effects,
        type,
        new AST.Span(name.span.start, type.span.end),
      )
    ),
  );
}

export function effectRecordSignature(): Parser.Parser<
  AST.EffectRecordSignature
> {
  return Parser.zeroOrMore(typeReference()).pipe(
    Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    Parser.map(({ before, content, after }) =>
      new AST.EffectRecordSignature(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

export function typeReference(): Parser.Parser<AST.TypeReference> {
  return Parser.sequence(
    Parser.token("Identifier"),
    Parser.zeroOrMore(Parser.WHITESPACE_OR_NEWLINE),
    Parser.optional(typeArgumentListWithHoles()),
  ).pipe(
    Parser.map(([identifier, _whitespace1, typeArguments]) =>
      new AST.TypeReference(
        identifier,
        typeArguments?.typeArguments ?? [],
        new AST.Span(
          identifier.span.start,
          typeArguments?.close.span.end ?? identifier.span.end,
        ),
      )
    ),
  );
}

export function typeArgumentList(): Parser.Parser<{
  open: Symbol<"LessThan">;
  types: ReadonlyArray<AST.Type>;
  close: Symbol<"GreaterThan">;
}> {
  return type().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("<"), Parser.symbol(">")),
    Parser.map(({ before, content, after }) => ({
      open: before,
      types: content,
      close: after,
    })),
  );
}

export function typeArgumentListWithHoles(): Parser.Parser<{
  open: Symbol<"LessThan">;
  typeArguments: ReadonlyArray<AST.Type | AST.TypeHole>;
  close: Symbol<"GreaterThan">;
}> {
  return Parser.or(type(), typeHole()).pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("<"), Parser.symbol(">")),
    Parser.map(({ before, content, after }) => ({
      open: before,
      typeArguments: content,
      close: after,
    })),
  );
}

export function typeHole(): Parser.Parser<AST.TypeHole> {
  return Parser.symbol("_").pipe(
    Parser.map((hole) => new AST.TypeHole(hole.span)),
  );
}

export function typeParametersList() {
  return typeParameter().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.delimitedBy(Parser.symbol("<"), Parser.symbol(">")),
    Parser.map(({ before, content, after }) => ({
      open: before,
      typeParameters: content,
      close: after,
    })),
  );
}

export function typeParameter(): Parser.Parser<AST.TypeParameter> {
  return Parser.sequence(
    typeReference(),
    Parser.whitespace(),
    Parser.optional(
      Parser.sequence(
        Parser.symbol(":"),
        Parser.whitespace(),
        type().pipe(
          Parser.separatedBy(Parser.symbol("&")),
        ),
      ),
    ),
  ).pipe(
    Parser.map(([reference, _whitespace1, constraints]) =>
      new AST.TypeParameter(
        reference,
        constraints?.[2] ?? [],
        new AST.Span(
          reference.span.start,
          constraints?.[2]?.at(-1)?.span.end ?? reference.span.end,
        ),
      )
    ),
  );
}
