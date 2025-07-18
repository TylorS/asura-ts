import { describe, expect, it } from "vitest";
import { CodeGenerator } from "./CodeGenerator.ts";
import { ExpressionBuilder } from "../../2025-06-17-type-inference-and-type-checking/ExpressionHelpers.ts";
import { WasmTranslator } from "./WasmTranslator.ts";
import { WasmCompiler } from "./WasmCompiler.ts";
import { WatGenerator } from "../wat/WatGenerator.ts";
import { Expression } from "../../2025-06-17-type-inference-and-type-checking/Expression.ts";

describe("CodeGenerator - WAT Validation", () => {
  const codeGenerator = new CodeGenerator();
  const wasmCompiler = new WasmCompiler();
  const wasmTranslator = new WasmTranslator();

  function validateWAT(expression: Expression, description: string) {
    it(`should generate valid WAT for ${description}`, async () => {
      // Generate IR
      const ir = codeGenerator.generate(expression, {
        kind: "PrimitiveType",
        name: "number",
      });

      // Convert IR to WAT module
      const watModule = wasmTranslator.translate(ir, {
        moduleName: "test-module",
      });

      // Convert WAT module to string
      const watGenerator = new WatGenerator(watModule);
      const wat = watGenerator.generate();

      // Validate WAT
      const result = await wasmCompiler.compile(wat);

      if (!result.success) {
        console.log(`WAT for ${description}:`);
        console.log(wat);
        console.log(`Errors:`, result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });
  }

  // Test 1: Number Literal
  validateWAT(
    ExpressionBuilder.num(42),
    "number literal",
  );

  // Test 2: Function Application (Lambda)
  validateWAT(
    ExpressionBuilder.app(
      ExpressionBuilder.lambda("x", ExpressionBuilder.var("x")),
      ExpressionBuilder.num(42),
    ),
    "function application with lambda",
  );

  // Test 3: Let Binding
  validateWAT(
    ExpressionBuilder.let(
      "x",
      ExpressionBuilder.num(10),
      ExpressionBuilder.var("x"),
    ),
    "let binding",
  );

  // Test 4: Record Creation
  validateWAT(
    ExpressionBuilder.record({
      name: ExpressionBuilder.str("Alice"),
      age: ExpressionBuilder.num(30),
    }),
    "record creation",
  );

  // Test 5: Complex Let with Function Application
  validateWAT(
    ExpressionBuilder.let(
      "x",
      ExpressionBuilder.num(10),
      ExpressionBuilder.app(
        ExpressionBuilder.lambda("y", ExpressionBuilder.var("y")),
        ExpressionBuilder.var("x"),
      ),
    ),
    "complex let with function application",
  );
});
