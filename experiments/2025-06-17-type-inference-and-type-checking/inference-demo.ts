import { TypeInferenceEngine } from "./TypeInference.ts";
import { TypePrinter } from "./TypeHelpers.ts";
import { Expression, ExpressionPrinter } from "./Expression.ts";
import { ExpressionBuilder } from "./ExpressionHelpers.ts";

const engine = new TypeInferenceEngine();

function runSimpleInferenceDemo() {
  console.log("🧠 Simple Asura Type Inference Demo");
  console.log("🔍 Testing basic type inference without complex examples!");
  console.log("");

  // Test 1: Number literal
  console.log("=== 1. Number Literal ===");
  testExpression(ExpressionBuilder.num(42));

  // Test 2: String literal
  console.log("=== 2. String Literal ===");
  testExpression(ExpressionBuilder.str("hello"));

  // Test 3: Simple identity function
  console.log("=== 3. Identity Function ===");
  testExpression(ExpressionBuilder.lambda("x", ExpressionBuilder.var("x")));

  // Test 4: Simple record
  console.log("=== 4. Record Literal ===");
  testExpression(
    ExpressionBuilder.record({
      name: ExpressionBuilder.str("Alice"),
      age: ExpressionBuilder.num(30),
    })
  );

  // Test 5: Functon composition
  console.log("=== 5. Function Composition ===");
  testExpression(
    ExpressionBuilder.lambda(
      "f",
      ExpressionBuilder.lambda(
        "g",
        ExpressionBuilder.lambda(
          "x",
          ExpressionBuilder.app(
            ExpressionBuilder.var("f"),
            ExpressionBuilder.app(
              ExpressionBuilder.var("g"),
              ExpressionBuilder.var("x")
            )
          )
        )
      )
    )
  );

  console.log("✨ Simple inference demo completed!");
}

function testExpression(expression: Expression) {
  try {
    console.log(`Expression: ${ExpressionPrinter.print(expression)}`);
    const result = engine.infer(expression);
    console.log(`Inferred type: ${TypePrinter.print(result.type)}`);
    console.log("✓ Success!");
  } catch (error) {
    console.log("✗ Failed:", (error as Error).message);
    console.log("Stack:", (error as Error).stack);
  }
}

// Run the demo
runSimpleInferenceDemo();
