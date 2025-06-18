// Core type system for Asura language
// Supporting structural typing, variance, higher-kinded types, row types, effect types, and handler types

export type TypeVariable = {
  kind: "TypeVariable";
  name: string;
  id: number;
  variance?: Variance;
};

export type Variance =
  | "covariant"
  | "contravariant"
  | "invariant"
  | "bivariant";

// Higher-kinded types - types that take other types as parameters
export type TypeConstructor = {
  kind: "TypeConstructor";
  name: string;
  arity: number; // number of type parameters it takes
  parameters: TypeParameter[];
};

export type TypeParameter = {
  name: string;
  variance: Variance;
  constraint?: Type;
};

// Row types for extensible records and variants
export type RowType = {
  kind: "RowType";
  fields: Map<string, Type>;
  tail?: Type; // for row polymorphism
};

// Effect types for algebraic effects
export type EffectType = {
  kind: "EffectType";
  name: string;
  operations: Map<string, OperationType>;
};

export type OperationType = {
  parameters: Type[];
  returnType: Type;
  resumeType: Type;
};

// Handler types for effect handlers
export type HandlerType = {
  kind: "HandlerType";
  effect: EffectType;
  returnType: Type;
  operations: Map<string, HandlerOperation>;
};

export type HandlerOperation = {
  parameters: Type[];
  continuationType: Type;
  resultType: Type;
};

// Basic types
export type PrimitiveType = {
  kind: "PrimitiveType";
  name: "number" | "string" | "boolean" | "unit";
};

export type FunctionType = {
  kind: "FunctionType";
  parameters: Type[];
  returnType: Type;
  effects: Type[]; // effect row
};

export type RecordType = {
  kind: "RecordType";
  row: RowType;
};

export type VariantType = {
  kind: "VariantType";
  row: RowType;
};

export type ApplicationType = {
  kind: "ApplicationType";
  constructor: Type;
  arguments: Type[];
};

export type ForallType = {
  kind: "ForallType";
  variables: TypeVariable[];
  body: Type;
};

export type Type =
  | TypeVariable
  | TypeConstructor
  | PrimitiveType
  | FunctionType
  | RecordType
  | VariantType
  | ApplicationType
  | ForallType
  | EffectType
  | HandlerType;
