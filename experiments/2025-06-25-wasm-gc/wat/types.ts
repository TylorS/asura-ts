// Types for WAT (WebAssembly Text) generation

export interface WatModule {
  name?: string;
  imports: WatImport[];
  exports: WatExport[];
  functions: WatFunction[];
  memories: WatMemory[];
  tables: WatTable[];
  globals: WatGlobal[];
}

export interface WatImport {
  module: string;
  name: string;
  kind: "func" | "memory" | "table" | "global";
  type?: string;
}

export interface WatExport {
  name: string;
  kind: "func" | "memory" | "table" | "global";
  index: number;
}

export interface WatFunction {
  name?: string;
  params: WatParam[];
  results: WatType[];
  locals: WatLocal[];
  body: WatInstruction[];
}

export interface WatParam {
  name?: string;
  type: WatType;
}

export interface WatLocal {
  name?: string;
  type: WatType;
}

export interface WatMemory {
  name?: string;
  min: number;
  max?: number;
}

export interface WatTable {
  name?: string;
  elementType: "funcref" | "externref";
  min: number;
  max?: number;
}

export interface WatGlobal {
  name?: string;
  type: WatType;
  mutable: boolean;
  init: WatInstruction[];
}

export type WatType = "i32" | "i64" | "f32" | "f64";

export interface WatInstruction {
  opcode: string;
  operands?: (string | number)[];
}
