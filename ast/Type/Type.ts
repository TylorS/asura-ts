import { ArrayType } from "./ArrayType.ts";
import { BigDecimalLiteralType, BigDecimalType } from "./BigDecimalType.ts";
import { BigIntLiteralType, BigIntType } from "./BigIntType.ts";
import { BooleanLiteralType, BooleanType } from "./BooleanType.ts";
import { FloatLiteralType, FloatType } from "./FloatType.ts";
import { FunctionType } from "./FunctionType.ts";
import { IntegerLiteralType, IntegerType } from "./IntegerType.ts";
import { IntersectionType } from "./IntersectionType.ts";
import { RegexLiteralType, RegexType } from "./RegexType.ts";
import { RecordType } from "./RecordType.ts";
import { StringLiteralType, StringType } from "./StringType.ts";
import { TupleType } from "./TupleType.ts";
import { TypeReference } from "./TypeReference.ts";
import { UnionType } from "./UnionType.ts";
import { EffectType } from "./EffectType.ts";

export type Type =
  | ArrayType
  | BigDecimalType
  | BigDecimalLiteralType
  | BigIntType
  | BigIntLiteralType
  | BooleanType
  | BooleanLiteralType
  | EffectType
  | FloatType
  | FloatLiteralType
  | FunctionType
  | IntegerType
  | IntegerLiteralType
  | IntersectionType
  | RecordType
  | RecordType
  | RegexType
  | RegexLiteralType
  | StringType
  | StringLiteralType
  | TupleType
  | TypeReference
  | UnionType;
