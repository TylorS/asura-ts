import { IRModule, IRFunction, IROperation } from "./CodeGenerator.ts";
import { WatModule, WatFunction, WatParam, WatLocal, WatInstruction } from "../wat/types.ts";
import { Type } from "../../2025-06-17-type-inference-and-type-checking/Type.ts";

export interface WasmTranslationOptions {
  moduleName?: string;
  optimize?: boolean;
}

export class WasmTranslator {
  translate(ir: IRModule, options: WasmTranslationOptions = {}): WatModule {
    const watModule: WatModule = {
      name: options.moduleName,
      imports: [],
      exports: [],
      functions: [],
      memories: [],
      tables: [],
      globals: [],
    };

    // Convert functions
    for (const irFunc of ir.functions) {
      const watFunc = this.translateFunction(irFunc);
      watModule.functions.push(watFunc);
    }

    // Convert imports
    for (const irImport of ir.imports) {
      watModule.imports.push({
        module: irImport.module,
        name: irImport.name,
        kind: irImport.kind,
        type: irImport.type ? this.typeToString(irImport.type) : undefined,
      });
    }

    // Convert exports
    for (const irExport of ir.exports) {
      watModule.exports.push({
        name: irExport.name,
        kind: irExport.kind,
        index: irExport.index,
      });
    }

    // Convert memories
    for (const irMemory of ir.memories) {
      watModule.memories.push({
        name: irMemory.name,
        min: irMemory.min,
        max: irMemory.max,
      });
    }

    // Convert tables
    for (const irTable of ir.tables) {
      watModule.tables.push({
        name: irTable.name,
        elementType: irTable.elementType,
        min: irTable.min,
        max: irTable.max,
      });
    }

    // Convert globals
    for (const irGlobal of ir.globals) {
      watModule.globals.push({
        name: irGlobal.name,
        type: this.typeToWatType(irGlobal.type),
        mutable: irGlobal.mutable,
        init: irGlobal.init.map(op => this.translateOperation(op)),
      });
    }

    return watModule;
  }

  private translateFunction(irFunc: IRFunction): WatFunction {
    const params: WatParam[] = irFunc.params.map(param => ({
      name: param.name,
      type: this.typeToWatType(param.type),
    }));

    const locals: WatLocal[] = irFunc.locals.map(local => ({
      name: local.name,
      type: this.typeToWatType(local.type),
    }));

    const body: WatInstruction[] = irFunc.body.map(op => this.translateOperation(op));

    return {
      name: irFunc.name,
      params,
      results: [this.typeToWatType(irFunc.returnType)],
      locals,
      body,
    };
  }

  private translateOperation(operation: IROperation): WatInstruction {
    switch (operation.kind) {
      case "i32.const":
        return { opcode: "i32.const", operands: operation.operands as number[] };

      case "f64.const":
        return { opcode: "f64.const", operands: operation.operands as number[] };

      case "local.get":
        return { opcode: "local.get", operands: operation.operands as string[] };

      case "local.set":
        return { opcode: "local.set", operands: operation.operands as string[] };

      case "call":
        return { opcode: "call", operands: [] };

      case "i32.add":
        return { opcode: "i32.add", operands: [] };

      case "i32.sub":
        return { opcode: "i32.sub", operands: [] };

      case "i32.mul":
        return { opcode: "i32.mul", operands: [] };

      case "i32.div_s":
        return { opcode: "i32.div_s", operands: [] };

      case "f64.add":
        return { opcode: "f64.add", operands: [] };

      case "f64.sub":
        return { opcode: "f64.sub", operands: [] };

      case "f64.mul":
        return { opcode: "f64.mul", operands: [] };

      case "f64.div":
        return { opcode: "f64.div", operands: [] };

      case "memory.allocate":
        return { opcode: "memory.grow", operands: [0] };

      case "memory.store":
        return { opcode: "i32.store", operands: operation.operands as number[] };

      case "memory.load":
        return { opcode: "i32.load", operands: operation.operands as number[] };

      case "field.get":
        return { opcode: "struct.get", operands: operation.operands as string[] };

      case "field.set":
        return { opcode: "struct.set", operands: operation.operands as string[] };

      case "variant.create":
        return { opcode: "variant.new", operands: operation.operands as string[] };

      case "match.case":
        return { opcode: "block", operands: operation.operands as string[] };

      case "effect.operation":
        return { opcode: "call", operands: operation.operands as string[] };

      case "handle.start":
        return { opcode: "block", operands: [] };

      case "handle.end":
        return { opcode: "end", operands: [] };

      case "handler.define":
        return { opcode: "block", operands: operation.operands as string[] };

      case "func.start":
        // This should not be translated as an instruction - it's a function definition marker
        return { opcode: "nop", operands: [] };

      case "func.end":
        // This should not be translated as an instruction - it's a function definition marker
        return { opcode: "nop", operands: [] };

      case "string.const":
        // For strings, we'll use a placeholder for now - in a real implementation
        // this would allocate memory and store the string
        return { opcode: "i32.const", operands: [0] }; // String reference placeholder

      default:
        // For unsupported operations, generate a no-op
        console.warn(`Unsupported operation: ${operation.kind}`);
        return { opcode: "nop", operands: [] };
    }
  }

  private typeToWatType(type: Type): "i32" | "i64" | "f32" | "f64" {
    switch (type.kind) {
      case "PrimitiveType":
        switch (type.name) {
          case "number":
            return "f64"; // Default to f64 for numbers
          case "string":
            return "i32"; // String references as i32
          case "boolean":
            return "i32"; // Booleans as i32
          case "unit":
            return "i32"; // Unit as i32
          default:
            return "i32";
        }

      case "FunctionType":
        return "i32"; // Function references as i32

      case "RecordType":
        return "i32"; // Record references as i32

      case "VariantType":
        return "i32"; // Variant references as i32

      case "TypeVariable":
        return "i32"; // Type variables default to i32

      case "ApplicationType":
        return "i32"; // Type applications as i32

      case "ForallType":
        return "i32"; // Forall types as i32

      case "TypeConstructor":
        return "i32"; // Type constructors as i32

      case "EffectType":
        return "i32"; // Effect types as i32

      case "HandlerType":
        return "i32"; // Handler types as i32

      default:
        return "i32"; // Default to i32 for unknown types
    }
  }

  private typeToString(type: Type): string {
    // Convert Asura types to WAT type strings
    switch (type.kind) {
      case "PrimitiveType":
        return `(param ${this.typeToWatType(type)})`;

      case "FunctionType": {
        const params = type.parameters.map(p => this.typeToWatType(p)).join(" ");
        const returnType = this.typeToWatType(type.returnType);
        return `(func (param ${params}) (result ${returnType}))`;
      }

      case "TypeVariable":
        return `(param ${this.typeToWatType(type)})`;

      case "RecordType":
        return `(param ${this.typeToWatType(type)})`;

      case "VariantType":
        return `(param ${this.typeToWatType(type)})`;

      case "ApplicationType":
        return `(param ${this.typeToWatType(type)})`;

      case "ForallType":
        return `(param ${this.typeToWatType(type)})`;

      case "TypeConstructor":
        return `(param ${this.typeToWatType(type)})`;

      case "EffectType":
        return `(param ${this.typeToWatType(type)})`;

      case "HandlerType":
        return `(param ${this.typeToWatType(type)})`;

      default:
        return `(param ${this.typeToWatType(type)})`;
    }
  }
} 