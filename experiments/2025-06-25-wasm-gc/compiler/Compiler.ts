import { Expression } from "../../2025-06-17-type-inference-and-type-checking/Expression.ts";
import { Type } from "../../2025-06-17-type-inference-and-type-checking/Type.ts";
import { TypeInferenceEngine } from "../../2025-06-17-type-inference-and-type-checking/TypeInference.ts";
import { TypeChecker } from "../../2025-06-17-type-inference-and-type-checking/TypeChecker.ts";
import { CodeGenerator } from "./CodeGenerator.ts";
import { WasmTranslator } from "./WasmTranslator.ts";
import { WitTranslator } from "./WitTranslator.ts";
import {
  WasmCompilationOptions,
  WasmCompilationResult,
  WasmCompiler,
} from "./WasmCompiler.ts";
import { WatGenerator } from "../wat/WatGenerator.ts";

export interface CompilationResult {
  wat: string;
  wit: string;
  typeInfo: Map<string, Type>;
  errors: CompilationError[];
  wasm?: WasmCompilationResult;
}

export interface CompilationError {
  message: string;
  expression?: Expression;
  type?: Type;
  severity: "error" | "warning";
}

export interface CompilationOptions {
  moduleName?: string;
  packageName?: string;
  generateWit?: boolean;
  generateWat?: boolean;
  generateWasm?: boolean;
  optimize?: boolean;
  outputDir?: string;
  debug?: boolean;
  target?: "wasm32-unknown-unknown" | "wasm32-wasi";
  features?: string[];
  wasmToolsPath?: string;
}

export class Compiler {
  private typeInference: TypeInferenceEngine;
  private codeGenerator: CodeGenerator;
  private wasmTranslator: WasmTranslator;
  private witTranslator: WitTranslator;
  private wasmCompiler: WasmCompiler;

  constructor(options: CompilationOptions = {}) {
    this.typeInference = new TypeInferenceEngine();
    this.codeGenerator = new CodeGenerator();
    this.wasmTranslator = new WasmTranslator();
    this.witTranslator = new WitTranslator();
    this.wasmCompiler = new WasmCompiler(options.wasmToolsPath);
  }

  async compile(
    expression: Expression,
    options: CompilationOptions = {},
  ): Promise<CompilationResult> {
    const errors: CompilationError[] = [];
    const typeInfo = new Map<string, Type>();

    try {
      // Step 1: Type inference
      console.log("🔍 Performing type inference...");
      const inferenceResult = this.typeInference.infer(expression);
      console.log("✅ Type inference completed");

      // Step 2: Type checking using TypeChecker
      console.log("🔍 Performing type checking...");
      const checker = new TypeChecker();
      // Add all constraints from inference to the checker
      for (const constraint of inferenceResult.constraints ?? []) {
        checker.addConstraint(constraint);
      }
      // Solve constraints and collect errors
      const constraintErrors = checker.solveConstraints();
      for (const err of constraintErrors) {
        errors.push({
          message: err.message,
          severity: "error",
          // Optionally attach type info for debugging
          type: err.left,
        });
      }
      console.log("✅ Type checking completed");

      // Step 3: Code generation (intermediate representation)
      console.log("🏗️ Generating intermediate code...");
      const ir = this.codeGenerator.generate(expression, inferenceResult.type);
      console.log("✅ Intermediate code generated");

      // Step 4: Generate WAT
      let wat = "";
      if (options.generateWat !== false) {
        console.log("📝 Generating WAT...");
        const watModule = this.wasmTranslator.translate(ir, {
          moduleName: options.moduleName || "asura-module",
          optimize: options.optimize || false,
        });
        wat = new WatGenerator(watModule).generate();
        console.log("✅ WAT generated");
      }

      // Step 5: Generate WIT
      let wit = "";
      if (options.generateWit !== false) {
        console.log("📋 Generating WIT...");
        wit = this.witTranslator.translate(ir, {
          packageName: options.packageName || "asura-package",
        });
        console.log("✅ WIT generated");
      }

      // Step 6: Compile to WASM (if requested)
      let wasmResult: WasmCompilationResult | undefined;
      if (options.generateWasm !== false && wat) {
        console.log("🔨 Compiling to WASM...");

        // Check if wasm-tools is available
        const wasmToolsCheck = await this.wasmCompiler.checkWasmTools();
        if (!wasmToolsCheck.available) {
          console.warn(
            "⚠️ wasm-tools not available, skipping WASM compilation",
          );
          errors.push({
            message: `wasm-tools not available: ${wasmToolsCheck.error}`,
            severity: "warning",
          });
        } else {
          console.log(`✅ wasm-tools available: ${wasmToolsCheck.version}`);

          const wasmOptions: WasmCompilationOptions = {
            outputDir: options.outputDir,
            optimize: options.optimize,
            debug: options.debug,
            target: options.target,
            features: options.features,
          };

          wasmResult = await this.wasmCompiler.compile(wat, wit, wasmOptions);

          if (wasmResult.success) {
            console.log("✅ WASM compilation successful");
            console.log(`📦 Generated: ${wasmResult.wasmPath}`);
            console.log(`📏 Size: ${wasmResult.size} bytes`);

            // Validate the generated WASM
            if (wasmResult.wasmPath) {
              const validation = await this.wasmCompiler.validateWasm(
                wasmResult.wasmPath,
              );
              if (validation.valid) {
                console.log("✅ WASM validation passed");
              } else {
                console.warn("⚠️ WASM validation failed");
                errors.push({
                  message: `WASM validation failed: ${
                    validation.errors.join(", ")
                  }`,
                  severity: "warning",
                });
              }
            }
          } else {
            console.error("❌ WASM compilation failed");
            for (const error of wasmResult.errors) {
              errors.push({
                message: `WASM compilation error: ${error}`,
                severity: "error",
              });
            }
          }
        }
      }

      return {
        wat,
        wit,
        typeInfo,
        errors,
        wasm: wasmResult,
      };
    } catch (error) {
      const err = error as Error;
      errors.push({
        message: err.message,
        severity: "error",
      });

      return {
        wat: "",
        wit: "",
        typeInfo,
        errors,
      };
    }
  }

  // Helper method for compiling multiple expressions
  compileModule(
    expressions: Expression[],
    options: CompilationOptions = {},
  ): Promise<CompilationResult> {
    // For now, we'll compile the last expression as the main one
    // In the future, this could be enhanced to handle multiple expressions
    if (expressions.length === 0) {
      return Promise.resolve({
        wat: "",
        wit: "",
        typeInfo: new Map(),
        errors: [{ message: "No expressions to compile", severity: "error" }],
      });
    }

    return this.compile(expressions[expressions.length - 1], options);
  }

  // Helper method to check wasm-tools availability
  checkWasmTools(): Promise<
    { available: boolean; version?: string; error?: string }
  > {
    return this.wasmCompiler.checkWasmTools();
  }

  // Helper method to validate a WASM file
  validateWasm(
    wasmPath: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    return this.wasmCompiler.validateWasm(wasmPath);
  }

  // Helper method to get WASM file information
  getWasmInfo(wasmPath: string): Promise<{
    functions: number;
    globals: number;
    memories: number;
    tables: number;
    imports: number;
    exports: number;
    size: number;
  }> {
    return this.wasmCompiler.getWasmInfo(wasmPath);
  }
}
