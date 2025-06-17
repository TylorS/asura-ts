import { DataDeclaration } from "./DataDeclaration.ts";
import { EffectDeclaration } from "./EffectDeclaration.ts";
import { FunctionDeclaration } from "./FunctionDeclaration.ts";
import { ImportDeclaration } from "./ImportDeclaration.ts";
import { InterfaceDeclaration } from "./InterfaceDeclaration.ts";
import { LetDeclaration } from "./LetDeclaration.ts";
import { TypeAliasDeclaration } from "./TypeAliasDeclaration.ts";

export type ExportableDeclaration =
  | DataDeclaration
  | EffectDeclaration
  | FunctionDeclaration
  | InterfaceDeclaration
  | LetDeclaration
  | TypeAliasDeclaration;

export type Declaration = ExportableDeclaration | ImportDeclaration;
