import {
  ApplicationType,
  EffectType,
  ForallType,
  FunctionType,
  HandlerOperation,
  HandlerType,
  OperationType,
  PrimitiveType,
  RecordType,
  RowType,
  Type,
  TypeConstructor,
  TypeVariable,
  Variance,
  VariantType,
} from "./Type.ts";

// Type environment for variable bindings
export type TypeEnvironment = Map<string, Type>;

// Constraint system for type inference
export type Constraint =
  | { kind: "Equality"; left: Type; right: Type }
  | { kind: "Subtype"; left: Type; right: Type; variance: Variance }
  | { kind: "RowExtension"; base: Type; extension: Type; result: Type }
  | { kind: "EffectSubsumption"; required: Type[]; provided: Type[] };

export interface TypeConstraintError {
  message: string;
  constraint: Constraint;
  left?: Type;
  right?: Type;
}

// Type-checking context
export class TypeChecker {
  private nextTypeId = 0;
  protected constraints: Constraint[] = [];
  protected substitution: Map<number, Type> = new Map();

  // Generate fresh type variables
  freshTypeVariable(name: string = "t", variance?: Variance): TypeVariable {
    return {
      kind: "TypeVariable",
      name: `${name}${this.nextTypeId}`,
      id: this.nextTypeId++,
      variance,
    };
  }

  // Apply type substitution
  substitute(type: Type): Type {
    switch (type.kind) {
      case "TypeVariable":
        return this.substitution.get(type.id) ?? type;

      case "FunctionType":
        return {
          ...type,
          parameters: type.parameters.map((p: Type) => this.substitute(p)),
          returnType: this.substitute(type.returnType),
          effects: type.effects.map((e) => this.substitute(e)),
        };

      case "RecordType":
        return {
          ...type,
          row: this.substituteRow(type.row),
        };

      case "VariantType":
        return {
          ...type,
          row: this.substituteRow(type.row),
        };

      case "ApplicationType":
        return {
          ...type,
          constructor: this.substitute(type.constructor),
          arguments: type.arguments.map((arg) => this.substitute(arg)),
        };

      case "ForallType":
        return {
          ...type,
          variables: type.variables.map((v: TypeVariable) =>
            this.substitution.has(v.id)
              ? (this.substitute(v) as TypeVariable)
              : v
          ),
          body: this.substitute(type.body),
        };

      default:
        return type;
    }
  }

  private substituteRow(row: RowType): RowType {
    const newFields = new Map();
    for (const [name, type] of row.fields) {
      newFields.set(name, this.substitute(type));
    }
    return {
      ...row,
      fields: newFields,
      tail: row.tail ? this.substitute(row.tail) : undefined,
    };
  }

  // Structural subtyping with variance
  isSubtype(
    left: Type,
    right: Type,
    variance: Variance = "covariant",
  ): boolean {
    left = this.substitute(left);
    right = this.substitute(right);

    // Same type
    if (this.typesEqual(left, right)) return true;

    // Variance handling
    switch (variance) {
      case "contravariant":
        return this.isSubtype(right, left, "covariant");
      case "invariant":
        return this.typesEqual(left, right);
      case "bivariant":
        return (
          this.isSubtype(left, right, "covariant") ||
          this.isSubtype(right, left, "covariant")
        );
    }

    // Structural subtyping rules
    switch (left.kind) {
      case "FunctionType":
        if (right.kind === "FunctionType") {
          return this.isFunctionSubtype(left, right);
        }
        break;

      case "RecordType":
        if (right.kind === "RecordType") {
          return this.isRecordSubtype(left, right);
        }
        break;

      case "VariantType":
        if (right.kind === "VariantType") {
          return this.isVariantSubtype(left, right);
        }
        break;

      case "ApplicationType":
        if (right.kind === "ApplicationType") {
          return this.isApplicationSubtype(left, right);
        }
        break;

      case "ForallType":
        if (right.kind === "ForallType") {
          return this.isForallSubtype(left, right);
        }
        break;
    }

    return false;
  }

  private isFunctionSubtype(left: FunctionType, right: FunctionType): boolean {
    // Parameters are contravariant
    if (left.parameters.length !== right.parameters.length) return false;

    for (let i = 0; i < left.parameters.length; i++) {
      if (
        !this.isSubtype(
          right.parameters[i],
          left.parameters[i],
          "contravariant",
        )
      ) {
        return false;
      }
    }

    // Return type is covariant
    if (!this.isSubtype(left.returnType, right.returnType)) return false;

    // Effect subtyping - left effects must be subset of right effects
    return this.areEffectsSubsumed(left.effects, right.effects);
  }

  private isRecordSubtype(left: RecordType, right: RecordType): boolean {
    // Width subtyping: left can have more fields than right
    for (const [name, rightType] of right.row.fields) {
      const leftType = left.row.fields.get(name);
      if (!leftType || !this.isSubtype(leftType, rightType)) {
        return false;
      }
    }
    return true;
  }

  private isVariantSubtype(left: VariantType, right: VariantType): boolean {
    // Width subtyping: left can have fewer alternatives than right
    for (const [name, leftType] of left.row.fields) {
      const rightType = right.row.fields.get(name);
      if (!rightType || !this.isSubtype(leftType, rightType)) {
        return false;
      }
    }
    return true;
  }

  private isApplicationSubtype(
    left: ApplicationType,
    right: ApplicationType,
  ): boolean {
    if (!this.typesEqual(left.constructor, right.constructor)) return false;

    // Check variance of type constructor parameters
    if (left.arguments.length !== right.arguments.length) return false;

    // For now, assume covariant - in practice you'd check the constructor's variance annotations
    for (let i = 0; i < left.arguments.length; i++) {
      if (!this.isSubtype(left.arguments[i], right.arguments[i])) {
        return false;
      }
    }
    return true;
  }

  private areEffectsSubsumed(required: Type[], provided: Type[]): boolean {
    // Every required effect must be available in provided effects
    return required.every((req) =>
      provided.some((prov) => this.isSubtype(req, prov))
    );
  }

  private isForallSubtype(left: ForallType, right: ForallType): boolean {
    // For polymorphic subtyping, left must be more general than right
    // This is a simplified implementation - in practice this is quite complex
    if (left.variables.length !== right.variables.length) return false;

    // Create fresh variables for the right type
    const freshVars = right.variables.map((v) =>
      this.freshTypeVariable(v.name, v.variance)
    );

    // Substitute the fresh variables in right's body
    const rightBodySubst = this.substituteForallVars(
      right.body,
      right.variables,
      freshVars,
    );

    // Check if left's body is subtype of substituted right body
    return this.isSubtype(left.body, rightBodySubst);
  }

  private substituteForallVars(
    type: Type,
    oldVars: TypeVariable[],
    newVars: TypeVariable[],
  ): Type {
    // Create substitution map
    const substMap = new Map<number, Type>();
    for (let i = 0; i < oldVars.length; i++) {
      substMap.set(oldVars[i].id, newVars[i]);
    }

    // Apply substitution
    const oldSubst = this.substitution;
    this.substitution = substMap;
    const result = this.substitute(type);
    this.substitution = oldSubst;

    return result;
  }

  // Higher-kinded type application
  applyTypeConstructor(constructor: TypeConstructor, args: Type[]): Type {
    if (constructor.arity !== args.length) {
      throw new Error(
        `Type constructor ${constructor.name} expects ${constructor.arity} arguments, got ${args.length}`,
      );
    }

    // Create application type
    return {
      kind: "ApplicationType",
      constructor,
      arguments: args,
    };
  }

  // Row type operations
  extendRow(base: RowType, extension: Map<string, Type>): RowType {
    const newFields = new Map([...base.fields]);
    for (const [name, type] of extension) {
      if (newFields.has(name)) {
        throw new Error(`Row already contains field ${name}`);
      }
      newFields.set(name, type);
    }

    return {
      kind: "RowType",
      fields: newFields,
      tail: base.tail,
    };
  }

  restrictRow(base: RowType, fieldsToRemove: string[]): RowType {
    const newFields = new Map(base.fields);
    for (const field of fieldsToRemove) {
      newFields.delete(field);
    }

    return {
      kind: "RowType",
      fields: newFields,
      tail: base.tail,
    };
  }

  // Effect handler type-checking
  checkHandler(handler: HandlerType, effect: EffectType): boolean {
    // Handler must implement all operations of the effect
    for (const [opName, opType] of effect.operations) {
      const handlerOp = handler.operations.get(opName);
      if (!handlerOp) return false;

      if (!this.checkHandlerOperation(handlerOp, opType)) {
        return false;
      }
    }
    return true;
  }

  private checkHandlerOperation(
    handlerOp: HandlerOperation,
    effectOp: OperationType,
  ): boolean {
    // Parameters must match
    if (handlerOp.parameters.length !== effectOp.parameters.length) {
      return false;
    }

    for (let i = 0; i < handlerOp.parameters.length; i++) {
      if (!this.typesEqual(handlerOp.parameters[i], effectOp.parameters[i])) {
        return false;
      }
    }

    // Continuation type must match resume type
    return this.typesEqual(handlerOp.continuationType, effectOp.resumeType);
  }

  // Utility: type equality
  protected typesEqual(left: Type, right: Type): boolean {
    left = this.substitute(left);
    right = this.substitute(right);

    if (left.kind !== right.kind) return false;

    switch (left.kind) {
      case "TypeVariable":
        return left.id === (right as TypeVariable).id;

      case "PrimitiveType":
        return left.name === (right as PrimitiveType).name;

      case "FunctionType": {
        const rightFunc = right as FunctionType;
        return (
          left.parameters.length === rightFunc.parameters.length &&
          left.parameters.every((p, i) =>
            this.typesEqual(p, rightFunc.parameters[i])
          ) &&
          this.typesEqual(left.returnType, rightFunc.returnType) &&
          left.effects.length === rightFunc.effects.length &&
          left.effects.every((e, i) => this.typesEqual(e, rightFunc.effects[i]))
        );
      }

      case "RecordType":
        return this.rowsEqual(left.row, (right as RecordType).row);

      case "VariantType":
        return this.rowsEqual(left.row, (right as VariantType).row);

      case "ApplicationType": {
        const rightApp = right as ApplicationType;
        return (
          this.typesEqual(left.constructor, rightApp.constructor) &&
          left.arguments.length === rightApp.arguments.length &&
          left.arguments.every((arg, i) =>
            this.typesEqual(arg, rightApp.arguments[i])
          )
        );
      }
      case "ForallType": {
        const rightForall = right as ForallType;
        return (
          left.variables.length === rightForall.variables.length &&
          left.variables.every((v, i) =>
            this.typesEqual(v, rightForall.variables[i])
          ) &&
          this.typesEqual(left.body, rightForall.body)
        );
      }
      case "EffectType": {
        const rightEffect = right as EffectType;
        return (
          left.name === rightEffect.name &&
          left.operations.size === rightEffect.operations.size &&
          Array.from(left.operations.entries()).every(([name, op]) => {
            const rightOp = rightEffect.operations.get(name);
            return rightOp && this.operationTypesEqual(op, rightOp);
          })
        );
      }
      case "HandlerType": {
        const rightHandler = right as HandlerType;
        return (
          this.typesEqual(left.effect, rightHandler.effect) &&
          this.typesEqual(left.returnType, rightHandler.returnType) &&
          left.operations.size === rightHandler.operations.size &&
          Array.from(left.operations.entries()).every(([name, op]) => {
            const rightOp = rightHandler.operations.get(name);
            return rightOp && this.handlerOperationsEqual(op, rightOp);
          })
        );
      }
      default:
        return false;
    }
  }

  private rowsEqual(left: RowType, right: RowType): boolean {
    if (left.fields.size !== right.fields.size) return false;

    for (const [name, leftType] of left.fields) {
      const rightType = right.fields.get(name);
      if (!rightType || !this.typesEqual(leftType, rightType)) {
        return false;
      }
    }

    return (
      ((!left.tail && !right.tail) ||
        (left.tail && right.tail && this.typesEqual(left.tail, right.tail))) ??
        false
    );
  }

  // Add constraint
  addConstraint(constraint: Constraint): void {
    this.constraints.push(constraint);
  }

  /**
   * Public constraint solver. Returns a list of errors for unsatisfied constraints.
   */
  public solveConstraints(): TypeConstraintError[] {
    const errors: TypeConstraintError[] = [];
    for (const constraint of this.constraints) {
      switch (constraint.kind) {
        case "Equality": {
          const success = this.unify(constraint.left, constraint.right);

          if (!success) {
            errors.push({
              message: `Type equality failed`,
              constraint,
              left: constraint.left,
              right: constraint.right,
            });
          }
          break;
        }
        case "Subtype": {
          const success = this.isSubtype(
            constraint.left,
            constraint.right,
            constraint.variance,
          );
          if (!success) {
            errors.push({
              message: `Type is not a subtype as required by constraint`,
              constraint,
              left: constraint.left,
              right: constraint.right,
            });
          }
          break;
        }
        case "RowExtension": {
          // Not implemented: always succeed for now
          break;
        }
        case "EffectSubsumption": {
          // Not implemented: always succeed for now
          break;
        }
      }
    }
    return errors;
  }

  protected unify(left: Type, right: Type): boolean {
    left = this.substitute(left);
    right = this.substitute(right);

    // Early return if types are already equal
    if (this.typesEqual(left, right)) {
      return true;
    }

    if (left.kind === "TypeVariable") {
      // Simple occurs check
      if (this.containsVariable(right, left.id)) {
        return false;
      }
      this.substitution.set(left.id, right);
      return true;
    }

    if (right.kind === "TypeVariable") {
      // Simple occurs check
      if (this.containsVariable(left, right.id)) {
        return false;
      }
      this.substitution.set(right.id, left);
      return true;
    }

    // For functions, unify parameters and return types
    if (left.kind === "FunctionType" && right.kind === "FunctionType") {
      if (left.parameters.length !== right.parameters.length) {
        return false;
      }

      // Unify parameters
      for (let i = 0; i < left.parameters.length; i++) {
        if (!this.unify(left.parameters[i], right.parameters[i])) {
          return false;
        }
      }

      // Unify return types
      if (!this.unify(left.returnType, right.returnType)) {
        return false;
      }

      // Unify effects (simplified)
      if (left.effects.length !== right.effects.length) {
        return false;
      }

      for (let i = 0; i < left.effects.length; i++) {
        if (!this.unify(left.effects[i], right.effects[i])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  private containsVariable(type: Type, varId: number): boolean {
    if (type.kind === "TypeVariable") {
      return type.id === varId;
    }

    switch (type.kind) {
      case "FunctionType":
        return type.parameters.some((p) => this.containsVariable(p, varId)) ||
          this.containsVariable(type.returnType, varId) ||
          type.effects.some((e) => this.containsVariable(e, varId));

      case "RecordType":
        return this.containsVariableInRow(type.row, varId);

      case "ApplicationType":
        return this.containsVariable(type.constructor, varId) ||
          type.arguments.some((a) => this.containsVariable(a, varId));

      case "ForallType":
        return this.containsVariable(type.body, varId);

      default:
        return false;
    }
  }

  private containsVariableInRow(row: RowType, varId: number): boolean {
    for (const fieldType of row.fields.values()) {
      if (this.containsVariable(fieldType, varId)) {
        return true;
      }
    }
    return row.tail ? this.containsVariable(row.tail, varId) : false;
  }

  private operationTypesEqual(
    left: OperationType,
    right: OperationType,
  ): boolean {
    return (
      left.parameters.length === right.parameters.length &&
      left.parameters.every((p, i) =>
        this.typesEqual(p, right.parameters[i])
      ) &&
      this.typesEqual(left.returnType, right.returnType) &&
      this.typesEqual(left.resumeType, right.resumeType)
    );
  }

  private handlerOperationsEqual(
    left: HandlerOperation,
    right: HandlerOperation,
  ): boolean {
    return (
      left.parameters.length === right.parameters.length &&
      left.parameters.every((p, i) =>
        this.typesEqual(p, right.parameters[i])
      ) &&
      this.typesEqual(left.continuationType, right.continuationType) &&
      this.typesEqual(left.resultType, right.resultType)
    );
  }

  // Type instantiation for ForAll types
  instantiate(forallType: ForallType, args: Type[]): Type {
    if (forallType.variables.length !== args.length) {
      throw new Error(
        `Cannot instantiate ForAll type: expected ${forallType.variables.length} type arguments, got ${args.length}`,
      );
    }

    // Create substitution for type variables
    const substMap = new Map<number, Type>();
    for (let i = 0; i < forallType.variables.length; i++) {
      substMap.set(forallType.variables[i].id, args[i]);
    }

    // Apply substitution to the body
    const oldSubst = this.substitution;
    this.substitution = substMap;
    const result = this.substitute(forallType.body);
    this.substitution = oldSubst;

    return result;
  }

  // Generalize a type to a ForAll type
  generalize(type: Type, freeVars: TypeVariable[]): ForallType {
    return {
      kind: "ForallType",
      variables: freeVars,
      body: type,
    };
  }
}

export class UnificationError extends Error {
  constructor(public left: Type, public right: Type, message: string) {
    super(
      `Cannot unify ${JSON.stringify(left)} with ${
        JSON.stringify(right)
      }: ${message}`,
    );
  }
}

export class OccursCheckError extends Error {
  constructor(public variable: Type, public type: Type) {
    super(
      `Occurs check failed: ${JSON.stringify(variable)} occurs in ${
        JSON.stringify(type)
      }`,
    );
  }
}
