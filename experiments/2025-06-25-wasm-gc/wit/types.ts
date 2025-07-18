// Types for WIT (WebAssembly Interface Types) generation

export interface WitPackage {
  name: string;
  version?: string;
  interfaces: WitInterface[];
  worlds: WitWorld[];
}

export interface WitInterface {
  name: string;
  functions: WitFunction[];
  types: WitType[];
}

export interface WitFunction {
  name: string;
  params: WitParameter[];
  results: WitResult[];
}

export interface WitParameter {
  name: string;
  type: WitTypeReference;
}

export interface WitResult {
  name?: string;
  type: WitTypeReference;
}

export interface WitWorld {
  name: string;
  imports: WitImport[];
  exports: WitExport[];
}

export interface WitImport {
  interface: string;
  alias?: string;
}

export interface WitExport {
  interface: string;
  alias?: string;
}

export interface WitType {
  name: string;
  kind: WitTypeKind;
}

export type WitTypeKind =
  | { kind: "primitive"; type: WitPrimitiveType }
  | { kind: "record"; fields: WitField[] }
  | { kind: "variant"; cases: WitCase[] }
  | { kind: "enum"; cases: string[] }
  | { kind: "union"; types: WitTypeReference[] }
  | { kind: "option"; type: WitTypeReference }
  | { kind: "result"; ok?: WitTypeReference; error?: WitTypeReference }
  | { kind: "list"; type: WitTypeReference };

export type WitPrimitiveType =
  | "u8"
  | "u16"
  | "u32"
  | "u64"
  | "s8"
  | "s16"
  | "s32"
  | "s64"
  | "float32"
  | "float64"
  | "char"
  | "bool"
  | "string";

export interface WitField {
  name: string;
  type: WitTypeReference;
}

export interface WitCase {
  name: string;
  type?: WitTypeReference;
}

export type WitTypeReference = string | { name: string; package?: string };
