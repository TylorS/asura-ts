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
import { CallExpression } from "./CallExpression.ts";
import { Identifier } from "../Identifer.ts";
import { UnaryExpression } from "./UnaryExpression.ts";
import { PropertyAccess } from "./PropertyAccess.ts";
import { IndexAccess } from "./IndexAccess.ts";
import { HandlerExpression } from "./HandlerExpression.ts";
import { EffectOperation } from "../Statement/EffectOperation.ts";
import { ResumeExpression } from "./ResumeExpression.ts";

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
  | CallExpression
  | UnaryExpression
  | PropertyAccess
  | IndexAccess
  | HandlerExpression
  | EffectOperation
  | ResumeExpression;
