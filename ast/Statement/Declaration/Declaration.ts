import { DataDeclaration } from "./DataDeclaration.ts";
import { EffectDeclaration } from "./EffectDeclaration.ts";
import { FunctionDeclaration } from "./FunctionDeclaration.ts";
import { InterfaceDeclaration } from "./InterfaceDeclaration.ts";
import { LetDeclaration } from "./LetDeclaration.ts";
import { TypeAliasDeclaration } from "./TypeAliasDeclaration.ts";

export type Declaration = 
  | DataDeclaration
  | EffectDeclaration
  | FunctionDeclaration
  | InterfaceDeclaration
  | LetDeclaration
  | TypeAliasDeclaration;