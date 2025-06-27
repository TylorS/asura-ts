import { IRModule, IRFunction } from "./CodeGenerator.ts";
import { WitGenerator } from "../wit/WitGenerator.ts";
import { WitPackage, WitInterface, WitFunction, WitParameter, WitResult, WitType, WitTypeKind } from "../wit/types.ts";
import { Type, ApplicationType, ForallType, FunctionType, RecordType, VariantType } from "../../2025-06-17-type-inference-and-type-checking/Type.ts";

export interface WitTranslationOptions {
  packageName?: string;
  version?: string;
}

export class WitTranslator {
  translate(ir: IRModule, options: WitTranslationOptions = {}): string {
    const witPackage: WitPackage = {
      name: options.packageName || "asura-package",
      version: options.version,
      interfaces: [],
      worlds: [],
    };

    // Create main interface from functions
    if (ir.functions.length > 0) {
      const mainInterface = this.createInterface("main", ir.functions);
      witPackage.interfaces.push(mainInterface);
    }

    // Create world that exports the main interface
    const world = {
      name: "asura-world",
      imports: [],
      exports: ir.functions.length > 0 ? [{ interface: "main" }] : [],
    };
    witPackage.worlds.push(world);

    const generator = new WitGenerator(witPackage);
    return generator.generate();
  }

  private createInterface(name: string, functions: IRFunction[]): WitInterface {
    const witFunctions: WitFunction[] = functions.map(func => this.translateFunction(func));
    const types: WitType[] = [];

    return {
      name,
      functions: witFunctions,
      types,
    };
  }

  private translateFunction(irFunc: IRFunction): WitFunction {
    const params: WitParameter[] = irFunc.params.map(param => ({
      name: param.name,
      type: this.typeToWitType(param.type),
    }));

    const results: WitResult[] = [{
      type: this.typeToWitType(irFunc.returnType),
    }];

    return {
      name: irFunc.name,
      params,
      results,
    };
  }

  private typeToWitType(type: Type): string {
    switch (type.kind) {
      case "PrimitiveType":
        return this.primitiveTypeToWit(type.name);

      case "FunctionType":
        return this.functionTypeToWit(type);

      case "RecordType":
        return this.recordTypeToWit(type);

      case "VariantType":
        return this.variantTypeToWit(type);

      case "TypeVariable":
        return type.name;

      case "ApplicationType":
        return this.applicationTypeToWit(type);

      case "ForallType":
        return this.forallTypeToWit(type);

      case "TypeConstructor":
        return type.name;

      case "EffectType":
        return `effect<${type.name}>`;

      case "HandlerType":
        return `handler<${type.effect.name}>`;

      default:
        return "u32"; // Default fallback
    }
  }

  private primitiveTypeToWit(name: string): string {
    switch (name) {
      case "number":
        return "f64";
      case "string":
        return "string";
      case "boolean":
        return "bool";
      case "unit":
        return "unit";
      default:
        return "u32";
    }
  }

  private functionTypeToWit(type: FunctionType): string {
    const params = type.parameters.map((p, i) => `param${i}: ${this.typeToWitType(p)}`).join(", ");
    const returnType = this.typeToWitType(type.returnType);
    return `(${params}) -> ${returnType}`;
  }

  private recordTypeToWit(type: RecordType): string {
    const fields = Array.from(type.row.fields.entries())
      .map(([name, fieldType]) => `${name}: ${this.typeToWitType(fieldType)}`)
      .join(", ");
    return `record { ${fields} }`;
  }

  private variantTypeToWit(type: VariantType): string {
    const cases = Array.from(type.row.fields.entries())
      .map(([name, caseType]) => {
        if (caseType.kind === "PrimitiveType" && caseType.name === "unit") {
          return name;
        }
        return `${name}(${this.typeToWitType(caseType)})`;
      })
      .join(", ");
    return `variant { ${cases} }`;
  }

  private applicationTypeToWit(type: ApplicationType): string {
    const constructorName = this.getTypeConstructorName(type.constructor);
    const args = type.arguments.map(arg => this.typeToWitType(arg)).join(", ");
    return `${constructorName}<${args}>`;
  }

  private forallTypeToWit(type: ForallType): string {
    const vars = type.variables.map(v => v.name).join(", ");
    const body = this.typeToWitType(type.body);
    return `forall<${vars}> ${body}`;
  }

  private getTypeConstructorName(constructor: Type): string {
    if (constructor.kind === "TypeConstructor") {
      return constructor.name;
    }
    return "unknown";
  }

  // Helper method to create WIT type definitions
  createWitType(type: Type, name: string): WitType {
    return {
      name,
      kind: this.typeToWitTypeKind(type),
    };
  }

  private typeToWitTypeKind(type: Type): WitTypeKind {
    switch (type.kind) {
      case "PrimitiveType":
        return {
          kind: "primitive",
          type: this.primitiveTypeToWitPrimitive(type.name),
        };

      case "RecordType":
        return {
          kind: "record",
          fields: Array.from(type.row.fields.entries()).map(([name, fieldType]) => ({
            name,
            type: this.typeToWitType(fieldType),
          })),
        };

      case "VariantType":
        return {
          kind: "variant",
          cases: Array.from(type.row.fields.entries()).map(([name, caseType]) => ({
            name,
            type: caseType.kind === "PrimitiveType" && caseType.name === "unit" 
              ? undefined 
              : this.typeToWitType(caseType),
          })),
        };

      case "ApplicationType": {
        // Handle common type constructors
        const constructorName = this.getTypeConstructorName(type.constructor);
        if (constructorName === "Option" || constructorName === "Maybe") {
          return {
            kind: "option",
            type: this.typeToWitType(type.arguments[0]),
          };
        }
        if (constructorName === "List" || constructorName === "Array") {
          return {
            kind: "list",
            type: this.typeToWitType(type.arguments[0]),
          };
        }
        if (constructorName === "Either" || constructorName === "Result") {
          return {
            kind: "result",
            ok: this.typeToWitType(type.arguments[0]),
            error: this.typeToWitType(type.arguments[1]),
          };
        }
        // Default to union for other type applications
        return {
          kind: "union",
          types: type.arguments.map(arg => this.typeToWitType(arg)),
        };
      }

      case "FunctionType":
        return {
          kind: "primitive",
          type: "u32", // Functions as references
        };

      case "TypeVariable":
        return {
          kind: "primitive",
          type: "u32", // Type variables as generic
        };

      case "ForallType":
        return {
          kind: "primitive",
          type: "u32", // Forall types as generic
        };

      case "TypeConstructor":
        return {
          kind: "primitive",
          type: "u32", // Type constructors as references
        };

      case "EffectType":
        return {
          kind: "primitive",
          type: "u32", // Effect types as references
        };

      case "HandlerType":
        return {
          kind: "primitive",
          type: "u32", // Handler types as references
        };

      default:
        return {
          kind: "primitive",
          type: "u32",
        };
    }
  }

  private primitiveTypeToWitPrimitive(name: string): "u8" | "u16" | "u32" | "u64" | "s8" | "s16" | "s32" | "s64" | "float32" | "float64" | "char" | "bool" | "string" {
    switch (name) {
      case "number":
        return "float64";
      case "string":
        return "string";
      case "boolean":
        return "bool";
      case "unit":
        return "u32"; // Unit as u32
      default:
        return "u32";
    }
  }
} 