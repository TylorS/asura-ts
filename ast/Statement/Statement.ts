import { Comment } from "./Comment.ts";
import { ControlFlow } from "./ControlFlow/mod.ts";
import { Declaration } from "./Declaration/Declaration.ts";
import { ExpressionStatement } from "./ExpressionStatement.ts";
import { MultilineComment } from "./MultilineComment.ts";

export type Statement =
  | Comment
  | MultilineComment
  | Declaration
  | ControlFlow
  | ExpressionStatement;