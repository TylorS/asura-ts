import { describe, expect, it } from "vitest";
import * as AST from "../../ast/mod.ts";
import { ParserContext } from "../Parser.ts";
import { tokenizeToArray } from "../../tokens/Tokenizer.ts";
import { DiagnosticCollection } from "../../diagnostics/mod.ts";
import {
  type,
  bigDecimalType,
  bigIntType,
  booleanType,
  floatType,
  integerType,
  stringType,
  regexType,
  recordType,
  tupleType,
  unionType,
  intersectionType,
  functionType,
  typeReference,
  typeParametersList,
  effectRecordSignature,
} from "./Type.ts";

function createParserContext(source: string): ParserContext {
  const tokens = tokenizeToArray(source);
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

describe("Type Parser", () => {
  describe("primitive types", () => {
    it("should parse integer type", () => {
      const context = createParserContext("Int");
      const result = integerType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.IntegerType);
      }
    });

    it("should parse float type", () => {
      const context = createParserContext("Float");
      const result = floatType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FloatType);
      }
    });

    it("should parse big integer type", () => {
      const context = createParserContext("BigInt");
      const result = bigIntType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BigIntType);
      }
    });

    it("should parse big decimal type", () => {
      const context = createParserContext("BigDecimal");
      const result = bigDecimalType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BigDecimalType);
      }
    });

    it("should parse boolean type", () => {
      const context = createParserContext("Boolean");
      const result = booleanType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BooleanType);
      }
    });

    it("should parse string type", () => {
      const context = createParserContext("String");
      const result = stringType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.StringType);
      }
    });

    it("should parse regex type", () => {
      const context = createParserContext("Regex");
      const result = regexType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RegexType);
      }
    });
  });

  describe("literal types", () => {
    it("should parse integer literal type", () => {
      const context = createParserContext("42");
      const result = type().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.IntegerLiteralType);
        expect((result.value as AST.IntegerLiteralType).value).toBe(42);
      }
    });

    it("should parse float literal type", () => {
      const context = createParserContext("3.14");
      const result = type().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FloatLiteralType);
        expect((result.value as AST.FloatLiteralType).value).toBe(3.14);
      }
    });

    it("should parse big integer literal type", () => {
      const context = createParserContext("42n");
      const result = type().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BigIntLiteralType);
        expect((result.value as AST.BigIntLiteralType).value).toBe(BigInt(42));
      }
    });

    it("should parse boolean literal type", () => {
      const context = createParserContext("true");
      const result = type().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.BooleanLiteralType);
        expect((result.value as AST.BooleanLiteralType).value).toBe(true);
      }
    });

    it("should parse string literal type", () => {
      const context = createParserContext('"hello"');
      const result = type().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.StringLiteralType);
        expect((result.value as AST.StringLiteralType).value).toBe("hello");
      }
    });

    it("should parse regex literal type", () => {
      const context = createParserContext("/[a-z]+/g");
      const result = type().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RegexLiteralType);
        const regexType = result.value as AST.RegexLiteralType;
        expect(regexType.pattern).toBe("[a-z]+");
        expect(regexType.flags).toBe("g");
      }
    });
  });

  describe("record types", () => {
    it("should parse empty record type", () => {
      const context = createParserContext("{}");
      const result = recordType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RecordType);
        expect((result.value as AST.RecordType).fields).toEqual([]);
      }
    });

    it("should parse record type with fields", () => {
      const context = createParserContext("{ name: String, age: Int }");
      const result = recordType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RecordType);
        const recordType = result.value as AST.RecordType;
        expect(recordType.fields).toHaveLength(2);
        const field0 = recordType.fields[0] as AST.RecordFieldType;
        expect(field0.name.text).toBe("name");
        expect(field0.type).toBeInstanceOf(AST.StringType);
        const field1 = recordType.fields[1] as AST.RecordFieldType;
        expect(field1.name.text).toBe("age");
        expect(field1.type).toBeInstanceOf(AST.IntegerType);
      }
    });

    it("should parse record type with optional fields", () => {
      const context = createParserContext("{ name: String, age?: Int }");
      const result = recordType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RecordType);
        const recordType = result.value as AST.RecordType;
        const field1 = recordType.fields[1] as AST.RecordFieldType;
        expect(field1.optional).toBe(true);
      }
    });
  });

  describe("tuple types", () => {
    it("should parse empty tuple type", () => {
      const context = createParserContext("[]");
      const result = tupleType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TupleType);
        expect((result.value as AST.TupleType).elements).toEqual([]);
      }
    });

    it("should parse tuple type with elements", () => {
      const context = createParserContext("[String, Int, Boolean]");
      const result = tupleType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TupleType);
        const tupleType = result.value as AST.TupleType;
        expect(tupleType.elements).toHaveLength(3);
        expect(tupleType.elements[0].type).toBeInstanceOf(AST.StringType);
        expect(tupleType.elements[1].type).toBeInstanceOf(AST.IntegerType);
        expect(tupleType.elements[2].type).toBeInstanceOf(AST.BooleanType);
      }
    });

    it("should parse tuple type with named elements", () => {
      const context = createParserContext("[name: String, age: Int]");
      const result = tupleType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TupleType);
        const tupleType = result.value as AST.TupleType;
        expect(tupleType.elements[0].name?.text).toBe("name");
        expect(tupleType.elements[1].name?.text).toBe("age");
      }
    });

    it("should parse tuple type with optional elements", () => {
      const context = createParserContext("[name: String, age?: Int]");
      const result = tupleType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TupleType);
        const tupleType = result.value as AST.TupleType;
        expect(tupleType.elements[1].optional).toBe(true);
      }
    });
  });

  describe("union types", () => {
    it("should parse union type", () => {
      const context = createParserContext("String | Int | Boolean");
      const result = unionType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.UnionType);
        const unionType = result.value as AST.UnionType;
        expect(unionType.types).toHaveLength(3);
        expect(unionType.types[0]).toBeInstanceOf(AST.StringType);
        expect(unionType.types[1]).toBeInstanceOf(AST.IntegerType);
        expect(unionType.types[2]).toBeInstanceOf(AST.BooleanType);
      }
    });
  });

  describe("intersection types", () => {
    it("should parse intersection type", () => {
      const context = createParserContext("Printable & Serializable");
      const result = intersectionType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.IntersectionType);
        const intersectionType = result.value as AST.IntersectionType;
        expect(intersectionType.types).toHaveLength(2);
        expect(intersectionType.types[0]).toBeInstanceOf(AST.TypeReference);
        expect(intersectionType.types[1]).toBeInstanceOf(AST.TypeReference);
      }
    });
  });

  describe("function types", () => {
    it("should parse simple function type", () => {
      const context = createParserContext("(Int, String) -> Boolean");
      const result = functionType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionType);
        const funcType = result.value as AST.FunctionType;
        expect(funcType.parameters).toHaveLength(2);
        expect(funcType.returnType).toBeInstanceOf(AST.BooleanType);
      }
    });

    it("should parse function type with effects", () => {
      const context = createParserContext("(String) -> {IO} String");
      const result = functionType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionType);
        const funcType = result.value as AST.FunctionType;
        expect(funcType.effects).toBeInstanceOf(AST.EffectRecordSignature);
      }
    });

    it("should parse function type with type parameters", () => {
      const context = createParserContext("<T>(T) -> T");
      const result = functionType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionType);
        const funcType = result.value as AST.FunctionType;
        expect(funcType.typeParameters).toHaveLength(1);
      }
    });
  });

  describe("type references", () => {
    it("should parse simple type reference", () => {
      const context = createParserContext("MyType");
      const result = typeReference().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TypeReference);
        const typeRef = result.value as AST.TypeReference;
        expect(typeRef.name.text).toBe("MyType");
        expect(typeRef.typeArguments).toEqual([]);
      }
    });

    it("should parse type reference with type arguments", () => {
      const context = createParserContext("List<Int>");
      const result = typeReference().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TypeReference);
        const typeRef = result.value as AST.TypeReference;
        expect(typeRef.name.text).toBe("List");
        expect(typeRef.typeArguments).toHaveLength(1);
        expect(typeRef.typeArguments[0]).toBeInstanceOf(AST.IntegerType);
      }
    });

    it("should parse type reference with multiple type arguments", () => {
      const context = createParserContext("Map<String, Int>");
      const result = typeReference().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TypeReference);
        const typeRef = result.value as AST.TypeReference;
        expect(typeRef.name.text).toBe("Map");
        expect(typeRef.typeArguments).toHaveLength(2);
        expect(typeRef.typeArguments[0]).toBeInstanceOf(AST.StringType);
        expect(typeRef.typeArguments[1]).toBeInstanceOf(AST.IntegerType);
      }
    });

    it("should parse type reference with type holes", () => {
      const context = createParserContext("List<_>");
      const result = typeReference().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.TypeReference);
        const typeRef = result.value as AST.TypeReference;
        expect(typeRef.typeArguments).toHaveLength(1);
        expect(typeRef.typeArguments[0]).toBeInstanceOf(AST.TypeHole);
      }
    });
  });

  describe("type parameters", () => {
    it("should parse type parameters list", () => {
      const context = createParserContext("<T, U>");
      const result = typeParametersList().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.typeParameters).toHaveLength(2);
        expect(result.value.typeParameters[0].reference.name.text).toBe("T");
        expect(result.value.typeParameters[1].reference.name.text).toBe("U");
      }
    });

    it("should parse type parameters with constraints", () => {
      const context = createParserContext("<T: Printable & Serializable>");
      const result = typeParametersList().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value.typeParameters).toHaveLength(1);
        const typeParam = result.value.typeParameters[0];
        expect(typeParam.constraints).toHaveLength(2);
      }
    });
  });

  describe("effect record signatures", () => {
    it("should parse empty effect record signature", () => {
      const context = createParserContext("{}");
      const result = effectRecordSignature().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectRecordSignature);
        expect((result.value as AST.EffectRecordSignature).references).toEqual([]);
      }
    });

    it("should parse effect record signature with effects", () => {
      const context = createParserContext("{ IO, Console }");
      const result = effectRecordSignature().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.EffectRecordSignature);
        const effectSig = result.value as AST.EffectRecordSignature;
        expect(effectSig.references).toHaveLength(2);
        expect(effectSig.references[0]).toBeInstanceOf(AST.TypeReference);
        expect(effectSig.references[1]).toBeInstanceOf(AST.TypeReference);
      }
    });
  });

  describe("complex types", () => {
    it("should parse nested record types", () => {
      const context = createParserContext("{ user: { name: String, age: Int }, active: Boolean }");
      const result = recordType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.RecordType);
        const recordType = result.value as AST.RecordType;
        expect(recordType.fields).toHaveLength(2);
        expect(recordType.fields[0].type).toBeInstanceOf(AST.RecordType);
      }
    });

    it("should parse function type with complex parameters", () => {
      const context = createParserContext("({ name: String }, [Int, Boolean]) -> String");
      const result = functionType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.FunctionType);
        const funcType = result.value as AST.FunctionType;
        expect(funcType.parameters).toHaveLength(2);
        expect(funcType.parameters[0].type).toBeInstanceOf(AST.RecordType);
        expect(funcType.parameters[1].type).toBeInstanceOf(AST.TupleType);
      }
    });

    it("should parse union of function types", () => {
      const context = createParserContext("(Int) -> String | (String) -> Int");
      const result = unionType().parse(context);
      
      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toBeInstanceOf(AST.UnionType);
        const unionType = result.value as AST.UnionType;
        expect(unionType.types).toHaveLength(2);
        expect(unionType.types[0]).toBeInstanceOf(AST.FunctionType);
        expect(unionType.types[1]).toBeInstanceOf(AST.FunctionType);
      }
    });
  });
}); 