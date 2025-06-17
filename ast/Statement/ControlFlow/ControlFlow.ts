import { BreakStatement } from "./BreakStatement.ts";
import { ContinueStatement } from "./ContinueStatement.ts";
import { ForInStatement } from "./ForInStatement.ts";
import { ForOfStatement } from "./ForOfStatement.ts";
import { ForStatement } from "./ForStatement.ts";
import { IfStatement } from "./IfStatement.ts";
import { ReturnStatement } from "./ReturnStatement.ts";
import { WhileStatement } from "./WhileStatement.ts";

export type ControlFlow =
  | BreakStatement
  | ContinueStatement
  | ForInStatement
  | ForOfStatement
  | ForStatement
  | IfStatement
  | ReturnStatement
  | WhileStatement;
