import { ArrayType } from "./ArrayType.ts";
import { BigDecimalLiteralType } from "./BigDecimalLiteralType.ts";
import { BigIntLiteralType } from "./BigIntLiteralType.ts";
import { BooleanLiteralType } from "./BooleanLiteralType.ts";
import { FloatLiteralType } from "./FloatLiteralType.ts";
import { FunctionType } from "./FunctionType.ts";
import { IntegerLiteralType } from "./IntegerLiteralType.ts";
import { IntersectionType } from "./IntersectionType.ts";
import { RegexLiteralType } from "./RegexType.ts";
import { RecordLiteralType } from "./RecordLiteralType.ts";
import { SpreadType } from "./SpreadType.ts";
import { StringLiteralType } from "./StringLiteralType.ts";
import { TupleLiteralType } from "./TupleLiteralType.ts";
import { TypeHole } from "./TypeHole.ts";
import { TypeParameter } from "./TypeParameter.ts";
import { TypeReference } from "./TypeReference.ts";
import { UnionType } from "./UnionType.ts";
import { EffectType } from "./EffectType.ts";

export type Type =
  | ArrayType
  | BigDecimalLiteralType
  | BigIntLiteralType
  | BooleanLiteralType
  | EffectType
  | FloatLiteralType
  | FunctionType
  | IntegerLiteralType
  | IntersectionType
  | RecordLiteralType
  | RegexLiteralType
  | SpreadType
  | StringLiteralType
  | TupleLiteralType
  | TypeHole
  | TypeParameter
  | TypeReference
  | UnionType;
