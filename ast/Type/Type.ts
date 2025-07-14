import { ArrayType } from "./ArrayType.ts";
import { BigDecimalType, BigDecimalLiteralType } from "./BigDecimalType.ts";
import { BigIntType, BigIntLiteralType } from "./BigIntType.ts";
import { BooleanType, BooleanLiteralType } from "./BooleanType.ts";
import { FloatType, FloatLiteralType } from "./FloatType.ts";
import { FunctionType } from "./FunctionType.ts";
import { IntegerType, IntegerLiteralType } from "./IntegerType.ts";
import { IntersectionType } from "./IntersectionType.ts";
import { RegexType, RegexLiteralType } from "./RegexType.ts";
import { RecordType } from "./RecordType.ts";
import { StringType, StringLiteralType } from "./StringType.ts";
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
