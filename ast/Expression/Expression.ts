import { BinaryExpression } from "./BinaryExpression.ts";
import type {
  ArrayLiteral,
  BigDecimalLiteral,
  BigIntLiteral,
  BooleanLiteral,
  FloatLiteral,
  IntegerLiteral,
  RecordLiteral,
  RegexLiteral,
  StringLiteral,
} from "./Literal/mod.ts";
import { MatchExpression } from "./MatchExpression.ts";
import { FunctionExpression } from "./FunctionExpression.ts";
import { Identifier } from "../Identifer.ts";
import { UnaryExpression } from "./UnaryExpression.ts";

export type Literal =
  | ArrayLiteral
  | BigDecimalLiteral
  | BigIntLiteral
  | BooleanLiteral
  | FloatLiteral
  | IntegerLiteral
  | RecordLiteral
  | RegexLiteral
  | StringLiteral;

export type Expression =
  | Identifier
  | Literal
  | BinaryExpression
  | MatchExpression
  | FunctionExpression
  | UnaryExpression
