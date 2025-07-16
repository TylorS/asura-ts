import * as Parser from "../Parser.ts";
import * as AST from "../../ast/mod.ts";
import { Symbol } from "../../tokens/Token.ts";
import { pipe } from "../Pipeable.ts";
import { DiagnosticCode } from "../../diagnostics/Diagnostic.ts";
import { regexLiteral } from "./Expression.ts";

export function type(): Parser.Parser<AST.Type> {
  return Parser.lazy(unionType);
}

export function unionType(): Parser.Parser<AST.Type> {
  return intersectionType().pipe(
    Parser.separatedBy(Parser.symbol("|")),
    Parser.map((types) =>
      types.length === 1 ? types[0] : new AST.UnionType(
        types,
        new AST.Span(types[0].span.start, types[types.length - 1].span.end),
      )
    ),
  );
}

export function intersectionType(): Parser.Parser<AST.Type> {
  return primaryType().pipe(
    Parser.separatedBy(Parser.symbol("&")),
    Parser.map((types) =>
      types.length === 1 ? types[0] : new AST.IntersectionType(
        types,
        new AST.Span(types[0].span.start, types[types.length - 1].span.end),
      )
    ),
  );
}

export function primaryType(): Parser.Parser<AST.Type> {
  return Parser.or(
    Parser.lazy(functionType),
    Parser.lazy(parenthesizedType),
    Parser.lazy(baseLiteral),
    Parser.lazy(typeReference),
    Parser.lazy(regexLiteralType),
    Parser.lazy(arrayType),
    Parser.lazy(recordType),
    Parser.lazy(tupleType),
    Parser.lazy(effectType),
  );
}

function parenthesizedType(): Parser.Parser<AST.Type> {
  return Parser.seq(
    Parser.symbol("("),
    type(),
    Parser.symbol(")"),
  ).pipe(Parser.map(([_before, type, _after]) => type));
}

export function arrayType(): Parser.Parser<AST.ArrayType> {
  return Parser.seq(
    Parser.literal("Array"),
    Parser.symbol("<"),
    type(),
    Parser.symbol(">"),
  ).pipe(
    Parser.map(([_open, _lessThan, type, _greaterThan]) =>
      new AST.ArrayType(
        type,
        new AST.Span(_open.span.start, _greaterThan.span.end),
      )
    ),
  );
}

function baseLiteral(): Parser.Parser<AST.Type> {
  return {
    parse(context: Parser.ParserContext): Parser.ParseResult<AST.Type> {
      const token = context.consumeIf(
        (token) =>
          token.kind === "BigDecimalLiteral" ||
          token.kind === "BigIntegerLiteral" ||
          token.kind === "BooleanLiteral" ||
          token.kind === "FloatLiteral" ||
          token.kind === "IntegerLiteral" ||
          token.kind === "StringLiteral" ||
          token.kind === "Identifier",
      );

      if (token === null) {
        const token = context.peek();
        return new Parser.ParseFailure([
          Parser.ParseError.error(
            DiagnosticCode.UNEXPECTED_TOKEN,
            `Unexpected token: ${token.kind}`,
            token.span,
          ),
        ]);
      }

      if (token.kind === "BigDecimalLiteral") {
        return new Parser.ParseSuccess(
          new AST.BigDecimalLiteralType(token.text, token.span),
        );
      }
      if (token.kind === "BigIntegerLiteral") {
        return new Parser.ParseSuccess(
          new AST.BigIntLiteralType(BigInt(token.text), token.span),
        );
      }
      if (token.kind === "BooleanLiteral") {
        return new Parser.ParseSuccess(
          new AST.BooleanLiteralType(token.text === "true", token.span),
        );
      }
      if (token.kind === "FloatLiteral") {
        return new Parser.ParseSuccess(
          new AST.FloatLiteralType(Number.parseFloat(token.text), token.span),
        );
      }
      if (token.kind === "IntegerLiteral") {
        return new Parser.ParseSuccess(
          new AST.IntegerLiteralType(
            Number.parseInt(token.text, 10),
            token.span,
          ),
        );
      }
      if (token.kind === "StringLiteral") {
        return new Parser.ParseSuccess(
          new AST.StringLiteralType(token.text.slice(1, -1), token.span),
        );
      }

      if (token.text === "BigDecimal") {
        return new Parser.ParseSuccess(new AST.BigDecimalType(token.span));
      }
      if (token.text === "BigInt") {
        return new Parser.ParseSuccess(new AST.BigIntType(token.span));
      }
      if (token.text === "Boolean") {
        return new Parser.ParseSuccess(new AST.BooleanType(token.span));
      }
      if (token.text === "Float") {
        return new Parser.ParseSuccess(new AST.FloatType(token.span));
      }
      if (token.text === "Int") {
        return new Parser.ParseSuccess(new AST.IntegerType(token.span));
      }
      if (token.text === "String") {
        return new Parser.ParseSuccess(new AST.StringType(token.span));
      }
      if (token.text === "Regex") {
        return new Parser.ParseSuccess(new AST.RegexType(token.span));
      }

      context.setPosition(context.getPosition() - 1);
      return new Parser.ParseFailure([
        Parser.ParseError.error(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Unexpected token: ${token.kind}`,
          token.span,
        ),
      ]);
    },
    pipe,
  };
}

export function effectType(): Parser.Parser<AST.EffectType> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(typeParametersList()),
    Parser.lazy(effectField).pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.optional,
      Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    ),
  ).pipe(
    Parser.map(([name, typeParameters, fields]) =>
      new AST.EffectType(
        name,
        typeParameters?.typeParameters ?? [],
        fields.content ?? [],
        new AST.Span(
          name.span.start,
          fields.after.span.end,
        ),
      )
    ),
  );
}

function effectField(): Parser.Parser<AST.EffectField> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.symbol(":"),
    type(),
  ).pipe(
    Parser.map(([name, _colon, type]) => new AST.EffectField(name, type)),
  );
}

export function recordType(): Parser.Parser<AST.RecordType> {
  return Parser.lazy(recordTypeField).pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.optional,
    Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    Parser.map(({ before, content, after }) =>
      new AST.RecordType(
        content ?? [],
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

export function regexLiteralType(): Parser.Parser<AST.RegexLiteralType> {
  return regexLiteral().pipe(
    Parser.map((regex) =>
      new AST.RegexLiteralType(regex.pattern, regex.flags, regex.span)
    ),
  );
}

export function tupleType(): Parser.Parser<AST.TupleType> {
  return tupleElements().pipe(
    Parser.delimitedBy(Parser.symbol("["), Parser.symbol("]")),
    Parser.map(({ before, content, after }) =>
      new AST.TupleType(
        content,
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

const fieldName = Parser.seq(
  Parser.token("Identifier"),
  Parser.optional(Parser.symbol("?")),
  Parser.symbol(":"),
).pipe(
  Parser.map(([name, optional, _colon]) => ({
    name,
    optional: optional !== null,
  })),
);

function tupleElement(): Parser.Parser<AST.TupleElement> {
  return Parser.seq(
    Parser.optional(fieldName),
    Parser.or(spreadType(), type()),
  ).pipe(
    Parser.map(([fieldName, type]) =>
      new AST.TupleElement(
        type,
        fieldName?.name ?? null,
        fieldName?.optional ?? false,
        new AST.Span(
          fieldName?.name?.span.start ?? type.span.start,
          type.span.end,
        ),
      )
    ),
  );
}

function tupleElements(): Parser.Parser<AST.TupleElement[]> {
  return tupleElement().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.optional,
    Parser.map((elements) => elements ?? []),
  );
}

function spreadType(): Parser.Parser<AST.SpreadType> {
  return Parser.seq(
    Parser.symbol("..."),
    typeReference(),
  ).pipe(
    Parser.map(([_, type]) =>
      new AST.SpreadType(type, new AST.Span(type.span.start, type.span.end))
    ),
  );
}

export function functionType(): Parser.Parser<AST.FunctionType> {
  return Parser.seq(
    Parser.optional(typeParametersList()),
    functionParameterType().pipe(
      Parser.separatedBy(Parser.symbol(",")),
      Parser.optional,
      Parser.delimitedBy(Parser.symbol("("), Parser.symbol(")")),
    ),
    Parser.symbol("=>"),
    Parser.optional(effectRecordSignature()),
    type(),
  ).pipe(
    Parser.map(([typeParameters, parameters, _arrow, effects, returnType]) =>
      new AST.FunctionType(
        typeParameters?.typeParameters ?? [],
        parameters.content ?? [],
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
    Parser.optional(fieldName),
    Parser.optional(effectRecordSignature()),
    type(),
  ).pipe(
    Parser.map(([name, effects, type]) =>
      new AST.FunctionParameterType(
        name?.name ?? null,
        name?.optional ?? false,
        effects,
        type,
        new AST.Span(name?.name?.span.start ?? type.span.start, type.span.end),
      )
    ),
  );
}

export function effectRecordSignature(): Parser.Parser<
  AST.EffectRecordSignature
> {
  return typeReference().pipe(
    Parser.separatedBy(Parser.symbol(",")),
    Parser.optional,
    Parser.delimitedBy(Parser.symbol("{"), Parser.symbol("}")),
    Parser.map(({ before, content, after }) =>
      new AST.EffectRecordSignature(
        content ?? [],
        new AST.Span(before.span.start, after.span.end),
      )
    ),
  );
}

export function typeReference(): Parser.Parser<AST.TypeReference> {
  return Parser.seq(
    Parser.token("Identifier"),
    Parser.optional(typeArgumentListWithHoles()),
  ).pipe(
    Parser.map(([identifier, typeArguments]) => {
      return new AST.TypeReference(
        identifier,
        typeArguments?.typeArguments ?? [],
        new AST.Span(
          identifier.span.start,
          typeArguments?.close.span.end ?? identifier.span.end,
        ),
      );
    }),
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
  return Parser.or(typeHole(), type()).pipe(
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
  return Parser.or(Parser.literal("_"), Parser.symbol("_")).pipe(
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
  return Parser.seq(
    typeReference(),
    Parser.optional(
      Parser.seq(
        Parser.symbol(":"),
        type(),
      ),
    ),
  ).pipe(
    Parser.map(([reference, rawConstraints]) => {
      const type = rawConstraints?.[1];
      const constraints = type?.kind === "IntersectionType"
        ? type.types
        : type
        ? [type]
        : [];

      return new AST.TypeParameter(
        reference,
        constraints,
        new AST.Span(
          reference.span.start,
          constraints.at(-1)?.span.end ?? reference.span.end,
        ),
      );
    }),
  );
}
