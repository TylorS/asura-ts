import { ForInStatement } from "./ForInStatement.ts";
import { ForOfStatement } from "./ForOfStatement.ts";
import { ForStatement } from "./ForStatement.ts";
import { IfStatement } from "./IfStatement.ts";
import { WhileStatement } from "./WhileStatement.ts";

export type ControlFlow =
  | ForInStatement
  | ForOfStatement
  | ForStatement
  | IfStatement
  | WhileStatement;
