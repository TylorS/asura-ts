import {
  ApplicationType,
  EffectType,
  ForallType,
  FunctionType,
  RecordType,
  RowType,
  Type,
  TypeVariable,
  VariantType,
} from "./Type.ts";
import { Constraint, TypeChecker, TypeEnvironment } from "./TypeChecker.ts";
import { TypeFactory } from "./TypeHelpers.ts";
import { Expression, HandlerCase, MatchCase } from "./Expression.ts";

// Inference result
export type InferenceResult = {
  type: Type;
  constraints: Constraint[];
  effects: Type[];
};

// Unification error
export class UnificationError extends Error {
  constructor(left: Type, right: Type, reason: string) {
    super(
      `Cannot unify ${JSON.stringify(left)} with ${
        JSON.stringify(
          right,
        )
      }: ${reason}`,
    );
  }
}

// Occurs check error
export class OccursCheckError extends Error {
  constructor(variable: TypeVariable, type: Type) {
    super(
      `Occurs check failed: ${variable.name} occurs in ${JSON.stringify(type)}`,
    );
  }
}

// Type inference engine with advanced unification
export class TypeInferenceEngine extends TypeChecker {
  private effectEnvironment: Map<string, EffectType> = new Map();

  constructor() {
    super();
    this.setupBuiltinEffects();
  }

  private setupBuiltinEffects() {
    // Add some built-in effects
    const stateEffect = TypeFactory.effect("State", {
      get: {
        parameters: [],
        returnType: TypeFactory.typeVar("S"),
        resumeType: TypeFactory.typeVar("S"),
      },
      put: {
        parameters: [TypeFactory.typeVar("S")],
        returnType: TypeFactory.unit(),
        resumeType: TypeFactory.unit(),
      },
    });

    const ioEffect = TypeFactory.effect("IO", {
      read: {
        parameters: [],
        returnType: TypeFactory.string(),
        resumeType: TypeFactory.string(),
      },
      write: {
        parameters: [TypeFactory.string()],
        returnType: TypeFactory.unit(),
        resumeType: TypeFactory.unit(),
      },
    });

    this.effectEnvironment.set("State", stateEffect);
    this.effectEnvironment.set("IO", ioEffect);
  }

  // Main type inference entry point
  infer(
    expression: Expression,
    environment: TypeEnvironment = new Map(),
  ): InferenceResult {
    const result = this.inferExpression(expression, environment);

    // Solve constraints with depth limit
    this.constraints = result.constraints;
    const solved = this.solveWithLimit(100); // Limit to 100 iterations

    if (!solved) {
      console.warn(
        "Type inference failed: unsolvable constraints or hit iteration limit",
      );
      console.warn(
        "Constraints:",
        result.constraints.map((c) => `${c.kind}: ${JSON.stringify(c)}`),
      );
      throw new Error("Type inference failed: unsolvable constraints");
    }

    return {
      type: this.substitute(result.type),
      constraints: result.constraints,
      effects: result.effects.map((e) => this.substitute(e)),
    };
  }

  private inferExpression(
    expression: Expression,
    environment: TypeEnvironment,
  ): InferenceResult {
    switch (expression.kind) {
      case "Literal":
        return this.inferLiteral(expression.value);

      case "Variable":
        return this.inferVariable(expression.name, environment);

      case "Lambda":
        return this.inferLambda(
          expression.parameter,
          expression.body,
          environment,
        );

      case "Application":
        return this.inferApplication(
          expression.function,
          expression.argument,
          environment,
        );

      case "Let":
        return this.inferLet(
          expression.variable,
          expression.value,
          expression.body,
          environment,
        );

      case "Record":
        return this.inferRecord(expression.fields, environment);

      case "FieldAccess":
        return this.inferFieldAccess(
          expression.record,
          expression.field,
          environment,
        );

      case "Variant":
        return this.inferVariant(expression.tag, expression.value, environment);

      case "Match":
        return this.inferMatch(
          expression.expression,
          expression.cases,
          environment,
        );

      case "EffectOperation":
        return this.inferEffectOperation(
          expression.effect,
          expression.operation,
          expression.arguments,
          environment,
        );

      case "Handle":
        return this.inferHandle(
          expression.expression,
          expression.handlers,
          expression.returnCase,
          environment,
        );

      case "TypeAnnotation":
        return this.inferTypeAnnotation(
          expression.expression,
          expression.type,
          environment,
        );

      default:
        throw new Error(
          `Unknown expression kind: ${
            (expression as Record<string, never>).kind
          }`,
        );
    }
  }

  private inferLiteral(value: number | string | boolean): InferenceResult {
    let type: Type;
    if (typeof value === "number") {
      type = TypeFactory.number();
    } else if (typeof value === "string") {
      type = TypeFactory.string();
    } else {
      type = TypeFactory.boolean();
    }

    return { type, constraints: [], effects: [] };
  }

  private inferVariable(
    name: string,
    environment: TypeEnvironment,
  ): InferenceResult {
    const type = environment.get(name);
    if (!type) {
      throw new Error(`Unbound variable: ${name}`);
    }

    // If the variable has a polymorphic type, instantiate it
    if (type.kind === "ForallType") {
      const freshVars = type.variables.map((v) =>
        this.freshTypeVariable(v.name, v.variance)
      );
      const instantiated = this.instantiate(type, freshVars);
      return { type: instantiated, constraints: [], effects: [] };
    }

    return { type, constraints: [], effects: [] };
  }

  private inferLambda(
    parameter: string,
    body: Expression,
    environment: TypeEnvironment,
  ): InferenceResult {
    const paramType = this.freshTypeVariable("param");
    const newEnvironment = new Map(environment);
    newEnvironment.set(parameter, paramType);

    const bodyResult = this.inferExpression(body, newEnvironment);

    const functionType = TypeFactory.func(
      [paramType],
      bodyResult.type,
      bodyResult.effects,
    );

    return {
      type: functionType,
      constraints: bodyResult.constraints,
      effects: [],
    };
  }

  private inferApplication(
    func: Expression,
    arg: Expression,
    environment: TypeEnvironment,
  ): InferenceResult {
    const funcResult = this.inferExpression(func, environment);
    const argResult = this.inferExpression(arg, environment);

    const returnType = this.freshTypeVariable("return");
    const effectType = this.freshTypeVariable("effects");

    const expectedFuncType = TypeFactory.func([argResult.type], returnType, [
      effectType,
    ]);

    const constraints = [
      ...funcResult.constraints,
      ...argResult.constraints,
      {
        kind: "Equality" as const,
        left: funcResult.type,
        right: expectedFuncType,
      },
    ];

    return {
      type: returnType,
      constraints,
      effects: [effectType],
    };
  }

  private inferLet(
    variable: string,
    value: Expression,
    body: Expression,
    environment: TypeEnvironment,
  ): InferenceResult {
    const valueResult = this.inferExpression(value, environment);

    // Generalize the value type if it's not dependent on the environment
    const generalizedType = this.shouldGeneralize(valueResult.type, environment)
      ? this.generalize(
        valueResult.type,
        this.getFreeVariables(valueResult.type),
      )
      : valueResult.type;

    const newEnvironment = new Map(environment);
    newEnvironment.set(variable, generalizedType);

    const bodyResult = this.inferExpression(body, newEnvironment);

    return {
      type: bodyResult.type,
      constraints: [...valueResult.constraints, ...bodyResult.constraints],
      effects: [...valueResult.effects, ...bodyResult.effects],
    };
  }

  private inferRecord(
    fields: Map<string, Expression>,
    environment: TypeEnvironment,
  ): InferenceResult {
    const fieldTypes = new Map<string, Type>();
    let allConstraints: Constraint[] = [];
    let allEffects: Type[] = [];

    for (const [name, expr] of fields) {
      const result = this.inferExpression(expr, environment);
      fieldTypes.set(name, result.type);
      allConstraints = [...allConstraints, ...result.constraints];
      allEffects = [...allEffects, ...result.effects];
    }

    const rowType: RowType = {
      kind: "RowType",
      fields: fieldTypes,
    };

    const recordType: RecordType = {
      kind: "RecordType",
      row: rowType,
    };

    return {
      type: recordType,
      constraints: allConstraints,
      effects: allEffects,
    };
  }

  private inferFieldAccess(
    record: Expression,
    field: string,
    environment: TypeEnvironment,
  ): InferenceResult {
    const recordResult = this.inferExpression(record, environment);
    const fieldType = this.freshTypeVariable("field");

    // For field access, we need the record to have at least the specified field
    // Create a constraint that the record type contains this field
    const minimalRow: RowType = {
      kind: "RowType",
      fields: new Map([[field, fieldType]]),
      tail: this.freshTypeVariable("rest_row"),
    };

    const minimalRecordType: RecordType = {
      kind: "RecordType",
      row: minimalRow,
    };

    // Add subtype constraint instead of equality to allow for width subtyping
    const constraints = [
      ...recordResult.constraints,
      {
        kind: "Subtype" as const,
        left: recordResult.type,
        right: minimalRecordType,
        variance: "covariant" as const,
      },
    ];

    return {
      type: fieldType,
      constraints,
      effects: recordResult.effects,
    };
  }

  private inferVariant(
    tag: string,
    value: Expression,
    environment: TypeEnvironment,
  ): InferenceResult {
    const valueResult = this.inferExpression(value, environment);
    const restRow = this.freshTypeVariable("rest");

    const variantRow: RowType = {
      kind: "RowType",
      fields: new Map([[tag, valueResult.type]]),
      tail: restRow,
    };

    const variantType: VariantType = {
      kind: "VariantType",
      row: variantRow,
    };

    return {
      type: variantType,
      constraints: valueResult.constraints,
      effects: valueResult.effects,
    };
  }

  private inferMatch(
    expression: Expression,
    cases: Map<string, MatchCase>,
    environment: TypeEnvironment,
  ): InferenceResult {
    const exprResult = this.inferExpression(expression, environment);
    const resultType = this.freshTypeVariable("match_result");

    let allConstraints = [...exprResult.constraints];
    let allEffects = [...exprResult.effects];

    const variantFields = new Map<string, Type>();

    for (const [tag, matchCase] of cases) {
      const paramType = this.freshTypeVariable(`${tag}_param`);
      variantFields.set(tag, paramType);

      const newEnvironment = new Map(environment);
      newEnvironment.set(matchCase.parameter, paramType);

      const caseResult = this.inferExpression(matchCase.body, newEnvironment);

      allConstraints = [...allConstraints, ...caseResult.constraints];
      allConstraints.push({
        kind: "Equality",
        left: caseResult.type,
        right: resultType,
      });
      allEffects = [...allEffects, ...caseResult.effects];
    }

    const expectedVariantType: VariantType = {
      kind: "VariantType",
      row: {
        kind: "RowType",
        fields: variantFields,
      },
    };

    allConstraints.push({
      kind: "Equality",
      left: exprResult.type,
      right: expectedVariantType,
    });

    return {
      type: resultType,
      constraints: allConstraints,
      effects: allEffects,
    };
  }

  private inferEffectOperation(
    effect: string,
    operation: string,
    args: Expression[],
    environment: TypeEnvironment,
  ): InferenceResult {
    const effectType = this.effectEnvironment.get(effect);
    if (!effectType) {
      throw new Error(`Unknown effect: ${effect}`);
    }

    const operationType = effectType.operations.get(operation);
    if (!operationType) {
      throw new Error(`Unknown operation ${operation} for effect ${effect}`);
    }

    let allConstraints: Constraint[] = [];
    let allEffects: Type[] = [effectType];

    // Check argument types
    if (args.length !== operationType.parameters.length) {
      throw new Error(
        `Operation ${operation} expects ${operationType.parameters.length} arguments, got ${args.length}`,
      );
    }

    for (let i = 0; i < args.length; i++) {
      const argResult = this.inferExpression(args[i], environment);
      allConstraints = [...allConstraints, ...argResult.constraints];
      allConstraints.push({
        kind: "Equality",
        left: argResult.type,
        right: operationType.parameters[i],
      });
      allEffects = [...allEffects, ...argResult.effects];
    }

    return {
      type: operationType.returnType,
      constraints: allConstraints,
      effects: allEffects,
    };
  }

  private inferHandle(
    expression: Expression,
    handlers: Map<string, HandlerCase>,
    returnCase: Expression,
    environment: TypeEnvironment,
  ): InferenceResult {
    const exprResult = this.inferExpression(expression, environment);
    const returnResult = this.inferExpression(returnCase, environment);

    let allConstraints = [
      ...exprResult.constraints,
      ...returnResult.constraints,
    ];
    let allEffects = [...returnResult.effects];

    // Infer handler types
    for (const [operation, handler] of handlers) {
      // Create environment for handler parameters
      const handlerEnv = new Map(environment);
      // const paramTypes = handler.parameters.map(p => {
      //   const paramType = this.freshTypeVariable(`${operation}_${p}`)
      //   handlerEnv.set(p, paramType)
      //   return paramType
      // })

      const resumeType = this.freshTypeVariable(`${operation}_resume`);
      handlerEnv.set(
        handler.resumeParameter,
        TypeFactory.func([resumeType], returnResult.type),
      );

      const handlerBodyResult = this.inferExpression(handler.body, handlerEnv);
      allConstraints = [...allConstraints, ...handlerBodyResult.constraints];
      allConstraints.push({
        kind: "Equality",
        left: handlerBodyResult.type,
        right: returnResult.type,
      });
      allEffects = [...allEffects, ...handlerBodyResult.effects];
    }

    return {
      type: returnResult.type,
      constraints: allConstraints,
      effects: allEffects,
    };
  }

  private inferTypeAnnotation(
    expression: Expression,
    type: Type,
    environment: TypeEnvironment,
  ): InferenceResult {
    const exprResult = this.inferExpression(expression, environment);

    const constraints = [
      ...exprResult.constraints,
      { kind: "Equality" as const, left: exprResult.type, right: type },
    ];

    return {
      type,
      constraints,
      effects: exprResult.effects,
    };
  }

  // Advanced unification algorithm
  unifyAdvanced(left: Type, right: Type): boolean {
    try {
      this.unifyTypes(left, right);
      return true;
    } catch (error) {
      if (
        error instanceof UnificationError ||
        error instanceof OccursCheckError
      ) {
        return false;
      }
      throw error;
    }
  }

  private unifyTypes(left: Type, right: Type): void {
    left = this.substitute(left);
    right = this.substitute(right);

    if (this.typesEqual(left, right)) {
      return;
    }

    if (left.kind === "TypeVariable") {
      this.unifyVariable(left, right);
      return;
    }

    if (right.kind === "TypeVariable") {
      this.unifyVariable(right, left);
      return;
    }

    // Unify same kinds
    if (left.kind === right.kind) {
      switch (left.kind) {
        case "FunctionType":
          this.unifyFunction(left, right as FunctionType);
          break;
        case "RecordType":
          this.unifyRecord(left, right as RecordType);
          break;
        case "VariantType":
          this.unifyVariant(left, right as VariantType);
          break;
        case "ApplicationType":
          this.unifyApplication(left, right as ApplicationType);
          break;
        case "ForallType":
          this.unifyForall(left, right as ForallType);
          break;
        default:
          throw new UnificationError(
            left,
            right,
            `Cannot unify types of kind ${left.kind}`,
          );
      }
    } else {
      throw new UnificationError(left, right, "Different type kinds");
    }
  }

  private unifyVariable(variable: TypeVariable, type: Type): void {
    if (this.occursCheck(variable, type)) {
      throw new OccursCheckError(variable, type);
    }

    this.substitution.set(variable.id, type);
  }

  private unifyFunction(left: FunctionType, right: FunctionType): void {
    if (left.parameters.length !== right.parameters.length) {
      throw new UnificationError(left, right, "Different parameter counts");
    }

    for (let i = 0; i < left.parameters.length; i++) {
      this.unifyTypes(left.parameters[i], right.parameters[i]);
    }

    this.unifyTypes(left.returnType, right.returnType);

    if (left.effects.length !== right.effects.length) {
      throw new UnificationError(left, right, "Different effect counts");
    }

    for (let i = 0; i < left.effects.length; i++) {
      this.unifyTypes(left.effects[i], right.effects[i]);
    }
  }

  private unifyRecord(left: RecordType, right: RecordType): void {
    this.unifyRow(left.row, right.row);
  }

  private unifyVariant(left: VariantType, right: VariantType): void {
    this.unifyRow(left.row, right.row);
  }

  private unifyRow(left: RowType, right: RowType): void {
    // More sophisticated row unification for row polymorphism
    // Find common fields and unify them
    const commonFields = new Set<string>();

    for (const [name, leftType] of left.fields) {
      if (right.fields.has(name)) {
        commonFields.add(name);
        const rightType = right.fields.get(name)!;
        this.unifyTypes(leftType, rightType);
      }
    }

    // Handle remaining fields and row tails
    const leftOnlyFields = new Map<string, Type>();
    const rightOnlyFields = new Map<string, Type>();

    for (const [name, type] of left.fields) {
      if (!commonFields.has(name)) {
        leftOnlyFields.set(name, type);
      }
    }

    for (const [name, type] of right.fields) {
      if (!commonFields.has(name)) {
        rightOnlyFields.set(name, type);
      }
    }

    // Handle row tails for extensibility
    if (leftOnlyFields.size === 0 && rightOnlyFields.size === 0) {
      // Both rows have same fields, unify tails if both exist
      if (left.tail && right.tail) {
        this.unifyTypes(left.tail, right.tail);
      }
    } else if (leftOnlyFields.size > 0 && right.tail) {
      // Left has extra fields, right has tail - unify left tail with right tail containing extra fields
      const rightTailWithFields: RowType = {
        kind: "RowType",
        fields: leftOnlyFields,
        tail: right.tail,
      };
      if (left.tail) {
        this.unifyTypes(left.tail, {
          kind: "RecordType",
          row: rightTailWithFields,
        });
      }
    } else if (rightOnlyFields.size > 0 && left.tail) {
      // Right has extra fields, left has tail - unify right tail with left tail containing extra fields
      const leftTailWithFields: RowType = {
        kind: "RowType",
        fields: rightOnlyFields,
        tail: left.tail,
      };
      if (right.tail) {
        this.unifyTypes(right.tail, {
          kind: "RecordType",
          row: leftTailWithFields,
        });
      }
    } else if (
      leftOnlyFields.size === 0 &&
      rightOnlyFields.size > 0 &&
      !left.tail
    ) {
      // Left is more specific (no extra fields, no tail), right is more general
      // This is valid for width subtyping
      return;
    } else if (
      rightOnlyFields.size === 0 &&
      leftOnlyFields.size > 0 &&
      !right.tail
    ) {
      // Right is more specific (no extra fields, no tail), left is more general
      // This is valid for width subtyping
      return;
    } else {
      // Cannot unify - incompatible row structures
      throw new UnificationError(
        { kind: "RecordType", row: left },
        { kind: "RecordType", row: right },
        "Incompatible row structures",
      );
    }
  }

  private unifyApplication(
    left: ApplicationType,
    right: ApplicationType,
  ): void {
    this.unifyTypes(left.constructor, right.constructor);

    if (left.arguments.length !== right.arguments.length) {
      throw new UnificationError(left, right, "Different argument counts");
    }

    for (let i = 0; i < left.arguments.length; i++) {
      this.unifyTypes(left.arguments[i], right.arguments[i]);
    }
  }

  private unifyForall(left: ForallType, right: ForallType): void {
    if (left.variables.length !== right.variables.length) {
      throw new UnificationError(left, right, "Different variable counts");
    }

    // This is a simplified implementation - proper ForAll unification is complex
    this.unifyTypes(left.body, right.body);
  }

  private occursCheck(variable: TypeVariable, type: Type): boolean {
    type = this.substitute(type);

    if (type.kind === "TypeVariable" && type.id === variable.id) {
      return true;
    }

    switch (type.kind) {
      case "FunctionType":
        return (
          type.parameters.some((p) => this.occursCheck(variable, p)) ||
          this.occursCheck(variable, type.returnType) ||
          type.effects.some((e) => this.occursCheck(variable, e))
        );

      case "RecordType":
        return this.occursCheckRow(variable, type.row);

      case "VariantType":
        return this.occursCheckRow(variable, type.row);

      case "ApplicationType":
        return (
          this.occursCheck(variable, type.constructor) ||
          type.arguments.some((arg) => this.occursCheck(variable, arg))
        );

      case "ForallType":
        return this.occursCheck(variable, type.body);

      default:
        return false;
    }
  }

  private occursCheckRow(variable: TypeVariable, row: RowType): boolean {
    for (const fieldType of row.fields.values()) {
      if (this.occursCheck(variable, fieldType)) {
        return true;
      }
    }

    return row.tail ? this.occursCheck(variable, row.tail) : false;
  }

  private shouldGeneralize(type: Type, environment: TypeEnvironment): boolean {
    // Get free type variables in the type
    const freeVars = this.getFreeVariables(type);

    // Check if any free variables are bound in the environment
    for (const freeVar of freeVars) {
      for (const [_, envType] of environment) {
        if (this.occursCheck(freeVar, envType)) {
          return false;
        }
      }
    }

    // If no free variables are bound in the environment, we can generalize
    return true;
  }

  private getFreeVariables(type: Type): TypeVariable[] {
    const freeVars: TypeVariable[] = [];
    this.collectFreeVariables(type, freeVars);
    return freeVars;
  }

  private collectFreeVariables(type: Type, freeVars: TypeVariable[]): void {
    type = this.substitute(type);

    switch (type.kind) {
      case "TypeVariable":
        if (!freeVars.some((v) => v.id === type.id)) {
          freeVars.push(type);
        }
        break;

      case "FunctionType":
        type.parameters.forEach((p) => this.collectFreeVariables(p, freeVars));
        this.collectFreeVariables(type.returnType, freeVars);
        type.effects.forEach((e) => this.collectFreeVariables(e, freeVars));
        break;

        // Add other cases as needed
    }
  }

  private solveWithLimit(maxIterations: number): boolean {
    let iterations = 0;
    const processedConstraints = new Set<string>();

    while (iterations < maxIterations) {
      let changed = false;
      iterations++;

      // Create a copy of constraints to avoid modification during iteration
      const currentConstraints = [...this.constraints];

      for (let i = 0; i < currentConstraints.length; i++) {
        const constraint = currentConstraints[i];
        const constraintKey = JSON.stringify(constraint);

        // Skip if we've already processed this exact constraint
        if (processedConstraints.has(constraintKey)) {
          continue;
        }

        try {
          switch (constraint.kind) {
            case "Equality": {
              const leftSub = this.substitute(constraint.left);
              const rightSub = this.substitute(constraint.right);

              // If both sides are already equal after substitution, mark as processed
              if (this.typesEqual(leftSub, rightSub)) {
                processedConstraints.add(constraintKey);
                continue;
              }

              // Try to unify
              if (this.unify(leftSub, rightSub)) {
                changed = true;
                processedConstraints.add(constraintKey);
              }
              break;
            }
            case "Subtype": {
              const leftSubtype = this.substitute(constraint.left);
              const rightSubtype = this.substitute(constraint.right);

              if (
                !this.isSubtype(leftSubtype, rightSubtype, constraint.variance)
              ) {
                return false;
              }
              processedConstraints.add(constraintKey);
              break;
            }
            default:
              throw new Error(`Unknown constraint kind: ${constraint.kind}`);
          }
        } catch (error) {
          if (
            error instanceof UnificationError ||
            error instanceof OccursCheckError
          ) {
            return false;
          }
          throw error;
        }
      }

      // If no changes were made in this iteration, we're done
      if (!changed) {
        break;
      }
    }

    if (iterations >= maxIterations) {
      console.warn(
        `Constraint solving hit iteration limit of ${maxIterations}`,
      );
      return false;
    }

    return true;
  }
}
