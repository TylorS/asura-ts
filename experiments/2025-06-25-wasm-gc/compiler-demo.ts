import { Compiler } from "./compiler/Compiler.ts";
import { ExpressionBuilder } from "../2025-06-17-type-inference-and-type-checking/ExpressionHelpers.ts";
import { CommonExpressions } from "../2025-06-17-type-inference-and-type-checking/ExpressionHelpers.ts";

async function runCompilerDemo() {
  console.log("🚀 Asura Compiler Pipeline Demo");
  console.log("📝 Compiling expressions to WAT/WIT\n");

  const compiler = new Compiler();

  // Demo 1: Simple number literal
  console.log("=== 1. Number Literal ===");
  const numberExpr = ExpressionBuilder.num(42);
  const numberResult = await compiler.compile(numberExpr, {
    moduleName: "number-demo",
    packageName: "number-demo",
  });

  console.log("Expression: 42");
  console.log("WAT:");
  console.log(numberResult.wat);
  console.log("\nWIT:");
  console.log(numberResult.wit);
  console.log("");

  // Demo 2: Identity function
  console.log("=== 2. Identity Function ===");
  const identityExpr = CommonExpressions.identity();
  const identityResult = await compiler.compile(identityExpr, {
    moduleName: "identity-demo",
    packageName: "identity-demo",
  });

  console.log("Expression: (x) => x");
  console.log("WAT:");
  console.log(identityResult.wat);
  console.log("\nWIT:");
  console.log(identityResult.wit);
  console.log("");

  // Demo 3: Record creation
  console.log("=== 3. Record Creation ===");
  const recordExpr = CommonExpressions.person("Alice", 30);
  const recordResult = await compiler.compile(recordExpr, {
    moduleName: "record-demo",
    packageName: "record-demo",
  });

  console.log('Expression: { name: "Alice", age: 30 }');
  console.log("WAT:");
  console.log(recordResult.wat);
  console.log("\nWIT:");
  console.log(recordResult.wit);
  console.log("");

  // Demo 4: Let polymorphism
  console.log("=== 4. Let Polymorphism ===");
  const letExpr = CommonExpressions.letPolymorphism();
  const letResult = await compiler.compile(letExpr, {
    moduleName: "let-demo",
    packageName: "let-demo",
  });

  console.log('Expression: let id = (x) => x in (id(42), id("hello"))');
  console.log("WAT:");
  console.log(letResult.wat);
  console.log("\nWIT:");
  console.log(letResult.wit);
  console.log("");

  // Demo 5: Function composition
  console.log("=== 5. Function Composition ===");
  const composeExpr = CommonExpressions.compose();
  const composeResult = await compiler.compile(composeExpr, {
    moduleName: "compose-demo",
    packageName: "compose-demo",
  });

  console.log("Expression: (f) => (g) => (x) => f(g(x))");
  console.log("WAT:");
  console.log(composeResult.wat);
  console.log("\nWIT:");
  console.log(composeResult.wit);
  console.log("");
  console.log("Errors:", composeResult.errors.map((e) => e.message));

  // Demo 6: Option types
  console.log("=== 6. Option Types ===");
  const optionExpr = CommonExpressions.some(ExpressionBuilder.num(42));
  const optionResult = await compiler.compile(optionExpr, {
    moduleName: "option-demo",
    packageName: "option-demo",
  });

  console.log("Expression: Some(42)");
  console.log("WAT:");
  console.log(optionResult.wat);
  console.log("\nWIT:");
  console.log(optionResult.wit);
  console.log("");

  // Demo 7: Error handling
  console.log("=== 7. Error Handling ===");
  const errorExpr = ExpressionBuilder.app(
    ExpressionBuilder.num(42), // This should fail - can't apply a number
    ExpressionBuilder.num(10),
  );
  const errorResult = await compiler.compile(errorExpr, {
    moduleName: "error-demo",
    packageName: "error-demo",
  });

  console.log("Expression: 42(10) (invalid - applying number)");
  console.log("Errors:", errorResult.errors.map((e) => e.message));
  console.log("");

  console.log("✅ Compiler demo completed!");
  console.log("\nFeatures demonstrated:");
  console.log("- ✅ Type inference integration");
  console.log("- ✅ WAT generation");
  console.log("- ✅ WIT generation");
  console.log("- ✅ Error handling");
  console.log("- ✅ Various expression types");
  console.log("- ✅ Polymorphic functions");
  console.log("- ✅ Records and variants");
}

// Run the demo
if (typeof window === "undefined") {
  runCompilerDemo();
}
