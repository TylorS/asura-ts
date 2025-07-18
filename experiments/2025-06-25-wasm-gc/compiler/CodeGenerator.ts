import {
  Expression,
  HandlerCase,
  MatchCase,
} from "../../2025-06-17-type-inference-and-type-checking/Expression.ts";
import {
  Type,
  TypeVariable,
} from "../../2025-06-17-type-inference-and-type-checking/Type.ts";

// Intermediate representation for WebAssembly generation
export interface IRModule {
  functions: IRFunction[];
  globals: IRGlobal[];
  imports: IRImport[];
  exports: IRExport[];
  memories: IRMemory[];
  tables: IRTable[];
}

export interface IRFunction {
  name: string;
  params: IRParameter[];
  locals: IRLocal[];
  body: IROperation[];
  returnType: Type;
}

export interface IRParameter {
  name: string;
  type: Type;
}

export interface IRLocal {
  name: string;
  type: Type;
}

export interface IRGlobal {
  name: string;
  type: Type;
  mutable: boolean;
  init: IROperation[];
}

export interface IRImport {
  module: string;
  name: string;
  kind: "func" | "memory" | "table" | "global";
  type?: Type;
}

export interface IRExport {
  name: string;
  kind: "func" | "memory" | "table" | "global";
  index: number;
}

export interface IRMemory {
  name: string;
  min: number;
  max?: number;
}

export interface IRTable {
  name: string;
  elementType: "funcref" | "externref";
  min: number;
  max?: number;
}

export interface IROperation {
  kind: string;
  operands: (string | number | IROperation)[];
  type?: Type;
}

export class CodeGenerator {
  private nextLocalId = 0;

  generate(expression: Expression, type: Type): IRModule {
    const module: IRModule = {
      functions: [],
      globals: [],
      imports: [],
      exports: [],
      memories: [],
      tables: [],
    };

    // Collect memory usage
    const memoryOps = this.collectMemoryOps(expression);
    if (memoryOps) {
      module.memories.push({ name: "mem", min: 1 });
    }

    // Generate a main function for the expression
    const mainFunction = this.generateFunction("main", expression, type);
    module.functions.push(mainFunction);

    // Export the main function
    module.exports.push({
      name: "main",
      kind: "func",
      index: 0,
    });

    return module;
  }

  // Recursively check if any memory operations are present
  private collectMemoryOps(expr: Expression): boolean {
    switch (expr.kind) {
      case "Record":
      case "FieldAccess":
        return true;
      case "Let":
        return this.collectMemoryOps(expr.value) ||
          this.collectMemoryOps(expr.body);
      case "Application":
        return this.collectMemoryOps(expr.function) ||
          this.collectMemoryOps(expr.argument);
      case "Lambda":
        return this.collectMemoryOps(expr.body);
      case "Match":
        return this.collectMemoryOps(expr.expression) ||
          Array.from(expr.cases.values()).some((c) =>
            this.collectMemoryOps(c.body)
          );
      case "EffectOperation":
        return expr.arguments.some((arg) => this.collectMemoryOps(arg));
      case "Handle":
        return this.collectMemoryOps(expr.expression) ||
          Array.from(expr.handlers.values()).some((h) =>
            this.collectMemoryOps(h.body)
          ) || this.collectMemoryOps(expr.returnCase);
      case "TypeAnnotation":
        return this.collectMemoryOps(expr.expression);
      default:
        return false;
    }
  }

  private generateFunction(
    name: string,
    expression: Expression,
    returnType: Type,
  ): IRFunction {
    const params: IRParameter[] = [];
    const locals: IRLocal[] = [];
    // Collect all locals before generating body
    this.nextLocalId = 0;
    this.collectLocals(expression, locals);
    const body = this.generateOperations(expression, locals);

    return {
      name,
      params,
      locals,
      body,
      returnType,
    };
  }

  // Recursively collect all locals needed for the function
  private collectLocals(expr: Expression, locals: IRLocal[]): void {
    switch (expr.kind) {
      case "Let": {
        // Add a local for the let variable
        const id = this.nextLocalId++;
        const localName = `local_${id}`;
        const localType: TypeVariable = {
          kind: "TypeVariable",
          id,
          name: "any",
        };
        locals.push({ name: localName, type: localType });
        this.collectLocals(expr.value, locals);
        this.collectLocals(expr.body, locals);
        break;
      }
      case "Lambda": {
        const id = this.nextLocalId++;
        const localName = expr.parameter;
        const localType: TypeVariable = {
          kind: "TypeVariable",
          id,
          name: "any",
        };
        locals.push({ name: localName, type: localType });
        this.collectLocals(expr.body, locals);
        break;
      }
      case "Application":
        this.collectLocals(expr.function, locals);
        this.collectLocals(expr.argument, locals);
        break;
      case "Record":
        for (const fieldExpr of expr.fields.values()) {
          this.collectLocals(fieldExpr, locals);
        }
        break;
      case "FieldAccess":
        this.collectLocals(expr.record, locals);
        break;
      case "Variant":
        this.collectLocals(expr.value, locals);
        break;
      case "Match":
        this.collectLocals(expr.expression, locals);
        for (const matchCase of expr.cases.values()) {
          this.collectLocals(matchCase.body, locals);
        }
        break;
      case "EffectOperation":
        for (const arg of expr.arguments) {
          this.collectLocals(arg, locals);
        }
        break;
      case "Handle":
        this.collectLocals(expr.expression, locals);
        for (const handler of expr.handlers.values()) {
          this.collectLocals(handler.body, locals);
        }
        this.collectLocals(expr.returnCase, locals);
        break;
      case "TypeAnnotation":
        this.collectLocals(expr.expression, locals);
        break;
      default:
        break;
    }
  }

  private generateOperations(
    expression: Expression,
    locals: IRLocal[],
  ): IROperation[] {
    switch (expression.kind) {
      case "Literal":
        return this.generateLiteral(expression.value);

      case "Variable":
        return this.generateVariable(expression.name);

      case "Lambda":
        return this.generateLambda(expression, locals);

      case "Application":
        return this.generateApplication(expression, locals);

      case "Let":
        return this.generateLet(expression, locals);

      case "Record":
        return this.generateRecord(expression, locals);

      case "FieldAccess":
        return this.generateFieldAccess(expression, locals);

      case "Variant":
        return this.generateVariant(expression, locals);

      case "Match":
        return this.generateMatch(expression, locals);

      case "EffectOperation":
        return this.generateEffectOperation(expression, locals);

      case "Handle":
        return this.generateHandle(expression, locals);

      case "TypeAnnotation":
        return this.generateOperations(expression.expression, locals);

      default:
        throw new Error(
          `Unsupported expression kind: ${JSON.stringify(expression, null, 2)}`,
        );
    }
  }

  private generateLiteral(value: number | string | boolean): IROperation[] {
    if (typeof value === "number") {
      // Always use f64 for numbers to match type inference
      return [{ kind: "f64.const", operands: [value] }];
    } else if (typeof value === "string") {
      // For strings, we'll need to handle them specially in WebAssembly
      // For now, return a placeholder
      return [{ kind: "string.const", operands: [value] }];
    } else {
      return [{ kind: "i32.const", operands: [value ? 1 : 0] }];
    }
  }

  private generateVariable(name: string): IROperation[] {
    return [{ kind: "local.get", operands: [name] }];
  }

  private generateLambda(
    expression: { parameter: string; body: Expression },
    locals: IRLocal[],
  ): IROperation[] {
    // For lambdas, we need to create a closure
    // This is a simplified implementation that returns a function reference
    // In a real implementation, this would create a proper closure

    // Add the parameter as a local variable
    const paramType: TypeVariable = {
      kind: "TypeVariable",
      id: this.nextLocalId++,
      name: "any",
    };
    locals.push({ name: expression.parameter, type: paramType });

    const bodyOps = this.generateOperations(expression.body, locals);

    // For now, we'll just return the body operations directly
    // In a real implementation, this would create a function and return its reference
    return bodyOps;
  }

  private generateApplication(
    expression: { function: Expression; argument: Expression },
    locals: IRLocal[],
  ): IROperation[] {
    const funcOps = this.generateOperations(expression.function, locals);
    const argOps = this.generateOperations(expression.argument, locals);
    return [
      ...funcOps,
      ...argOps,
      { kind: "call", operands: [] },
    ];
  }

  private generateLet(
    expression: { variable: string; value: Expression; body: Expression },
    locals: IRLocal[],
  ): IROperation[] {
    const valueOps = this.generateOperations(expression.value, locals);
    const bodyOps = this.generateOperations(expression.body, locals);

    // Add local for the variable
    const id = this.nextLocalId++;
    const localName = `local_${id}`;
    const localType: TypeVariable = { kind: "TypeVariable", id, name: "any" };
    locals.push({ name: localName, type: localType });

    return [
      ...valueOps,
      { kind: "local.set", operands: [localName] },
      ...bodyOps,
    ];
  }

  private generateRecord(
    expression: { fields: Map<string, Expression> },
    locals: IRLocal[],
  ): IROperation[] {
    const operations: IROperation[] = [];

    // For records, we'll need to allocate memory and store fields
    // This is a simplified implementation
    operations.push({
      kind: "memory.allocate",
      operands: [expression.fields.size],
    });

    let index = 0;
    for (const [fieldName, fieldExpr] of expression.fields) {
      const fieldOps = this.generateOperations(fieldExpr, locals);
      operations.push(...fieldOps);
      operations.push({ kind: "memory.store", operands: [index, fieldName] });
      index++;
    }

    return operations;
  }

  private generateFieldAccess(
    expression: { record: Expression; field: string },
    locals: IRLocal[],
  ): IROperation[] {
    const recordOps = this.generateOperations(expression.record, locals);
    return [
      ...recordOps,
      { kind: "field.get", operands: [expression.field] },
    ];
  }

  private generateVariant(
    expression: { tag: string; value: Expression },
    locals: IRLocal[],
  ): IROperation[] {
    const valueOps = this.generateOperations(expression.value, locals);
    return [
      ...valueOps,
      { kind: "variant.create", operands: [expression.tag] },
    ];
  }

  private generateMatch(
    expression: { expression: Expression; cases: Map<string, MatchCase> },
    locals: IRLocal[],
  ): IROperation[] {
    const exprOps = this.generateOperations(expression.expression, locals);
    const operations: IROperation[] = [...exprOps];

    // Generate match logic
    for (const [tag, matchCase] of expression.cases) {
      operations.push({ kind: "match.case", operands: [tag] });
      const caseOps = this.generateOperations(matchCase.body, locals);
      operations.push(...caseOps);
    }

    return operations;
  }

  private generateEffectOperation(
    expression: { effect: string; operation: string; arguments: Expression[] },
    locals: IRLocal[],
  ): IROperation[] {
    const operations: IROperation[] = [];

    // Generate operations for arguments
    for (const arg of expression.arguments) {
      const argOps = this.generateOperations(arg, locals);
      operations.push(...argOps);
    }

    // Generate effect operation
    operations.push({
      kind: "effect.operation",
      operands: [expression.effect, expression.operation],
    });

    return operations;
  }

  private generateHandle(
    expression: {
      expression: Expression;
      handlers: Map<string, HandlerCase>;
      returnCase: Expression;
    },
    locals: IRLocal[],
  ): IROperation[] {
    const operations: IROperation[] = [];

    // Generate handler setup
    operations.push({ kind: "handle.start", operands: [] });

    // Generate handlers
    for (const [opName, handler] of expression.handlers) {
      operations.push({ kind: "handler.define", operands: [opName] });
      const handlerOps = this.generateOperations(handler.body, locals);
      operations.push(...handlerOps);
    }

    // Generate return case
    const returnOps = this.generateOperations(expression.returnCase, locals);
    operations.push(...returnOps);

    // Generate expression to be handled
    const exprOps = this.generateOperations(expression.expression, locals);
    operations.push(...exprOps);

    operations.push({ kind: "handle.end", operands: [] });

    return operations;
  }
}
