import { Compiler } from "./compiler/Compiler.ts";
import { ExpressionBuilder } from "../2025-06-17-type-inference-and-type-checking/ExpressionHelpers.ts";
import { CommonExpressions } from "../2025-06-17-type-inference-and-type-checking/ExpressionHelpers.ts";

async function runWasmCompilerDemo() {
  console.log("🚀 Asura WASM Compiler Pipeline Demo");
  console.log("📝 Compiling expressions to WAT/WIT/WASM\n");

  const compiler = new Compiler();

  // Check wasm-tools availability first
  console.log("🔍 Checking wasm-tools availability...");
  const wasmToolsCheck = await compiler.checkWasmTools();
  if (wasmToolsCheck.available) {
    console.log(`✅ wasm-tools available: ${wasmToolsCheck.version}`);
  } else {
    console.warn(`⚠️ wasm-tools not available: ${wasmToolsCheck.error}`);
    console.log("💡 Install wasm-tools with: cargo install wasm-tools");
    console.log("   Or download from: https://github.com/bytecodealliance/wasm-tools\n");
  }

  // Demo 1: Simple number literal with WASM compilation
  console.log("=== 1. Number Literal with WASM ===");
  const numberExpr = ExpressionBuilder.num(42);
  const numberResult = await compiler.compile(numberExpr, {
    moduleName: "number-demo",
    packageName: "number-demo",
    generateWasm: true,
    outputDir: "./wasm-output",
    optimize: true,
  });

  console.log("Expression: 42");
  console.log("WAT:");
  console.log(numberResult.wat);
  console.log("\nWIT:");
  console.log(numberResult.wit);
  
  if (numberResult.wasm?.success) {
    console.log("\n✅ WASM compilation successful!");
    console.log(`📦 Generated: ${numberResult.wasm.wasmPath}`);
    console.log(`📏 Size: ${numberResult.wasm.size} bytes`);
    
    // Get detailed WASM info
    if (numberResult.wasm.wasmPath) {
      try {
        const wasmInfo = await compiler.getWasmInfo(numberResult.wasm.wasmPath);
        console.log("📊 WASM Info:");
        console.log(`   Functions: ${wasmInfo.functions}`);
        console.log(`   Globals: ${wasmInfo.globals}`);
        console.log(`   Memories: ${wasmInfo.memories}`);
        console.log(`   Tables: ${wasmInfo.tables}`);
        console.log(`   Imports: ${wasmInfo.imports}`);
        console.log(`   Exports: ${wasmInfo.exports}`);
      } catch (e) {
        console.warn("⚠️ Could not get WASM info:", e);
      }
    }
  } else if (numberResult.wasm) {
    console.log("\n❌ WASM compilation failed:");
    for (const error of numberResult.wasm.errors) {
      console.log(`   ${error}`);
    }
  }
  console.log("");

  // Demo 2: Function application with WASM
  console.log("=== 2. Function Application with WASM ===");
  const funcExpr = ExpressionBuilder.app(
    ExpressionBuilder.lambda("x", ExpressionBuilder.var("x")),
    ExpressionBuilder.num(42)
  );

  const funcResult = await compiler.compile(funcExpr, {
    moduleName: "func-demo",
    packageName: "func-demo",
    generateWasm: true,
    outputDir: "./wasm-output",
    debug: true, // Include debug names
  });

  console.log("Expression: (x => x)(42)");
  console.log("WAT:");
  console.log(funcResult.wat);
  
  if (funcResult.wasm?.success) {
    console.log("\n✅ WASM compilation successful!");
    console.log(`📦 Generated: ${funcResult.wasm.wasmPath}`);
    console.log(`📏 Size: ${funcResult.wasm.size} bytes`);
  }
  console.log("");

  // Demo 3: Record creation with WASM
  console.log("=== 3. Record Creation with WASM ===");
  const recordExpr = CommonExpressions.person("Alice", 30);
  const recordResult = await compiler.compile(recordExpr, {
    moduleName: "record-demo",
    packageName: "record-demo",
    generateWasm: true,
    outputDir: "./wasm-output",
    optimize: true,
  });

  console.log("Expression: { name: \"Alice\", age: 30 }");
  console.log("WAT:");
  console.log(recordResult.wat);
  
  if (recordResult.wasm?.success) {
    console.log("\n✅ WASM compilation successful!");
    console.log(`📦 Generated: ${recordResult.wasm.wasmPath}`);
    console.log(`📏 Size: ${recordResult.wasm.size} bytes`);
  }
  console.log("");

  // Demo 4: Let binding with WASM
  console.log("=== 4. Let Binding with WASM ===");
  const letExpr = ExpressionBuilder.let(
    "x",
    ExpressionBuilder.num(10),
    ExpressionBuilder.app(
      ExpressionBuilder.lambda("y", ExpressionBuilder.var("y")),
      ExpressionBuilder.var("x")
    )
  );

  const letResult = await compiler.compile(letExpr, {
    moduleName: "let-demo",
    packageName: "let-demo",
    generateWasm: true,
    outputDir: "./wasm-output",
    target: "wasm32-unknown-unknown",
  });

  console.log("Expression: let x = 10 in (y => y)(x)");
  console.log("WAT:");
  console.log(letResult.wat);
  
  if (letResult.wasm?.success) {
    console.log("\n✅ WASM compilation successful!");
    console.log(`📦 Generated: ${letResult.wasm.wasmPath}`);
    console.log(`📏 Size: ${letResult.wasm.size} bytes`);
  }
  console.log("");

  // Demo 5: Error handling demonstration
  console.log("=== 5. Error Handling ===");
  const errorExpr = ExpressionBuilder.app(
    ExpressionBuilder.num(42), // This should fail - can't apply a number
    ExpressionBuilder.num(10)
  );
  const errorResult = await compiler.compile(errorExpr, {
    moduleName: "error-demo",
    packageName: "error-demo",
    generateWasm: true,
    outputDir: "./wasm-output",
  });

  console.log("Expression: 42(10) (invalid - applying number)");
  console.log("Errors:", errorResult.errors.map(e => e.message));
  
  if (errorResult.wasm?.success) {
    console.log("✅ WASM compilation still succeeded (with warnings)");
  }
  console.log("");

  // Demo 6: Multiple expressions as module
  console.log("=== 6. Module Compilation ===");
  const expressions = [
    ExpressionBuilder.num(1),
    ExpressionBuilder.num(2),
    ExpressionBuilder.num(3),
  ];

  const moduleResult = await compiler.compileModule(expressions, {
    moduleName: "multi-demo",
    packageName: "multi-demo",
    generateWasm: true,
    outputDir: "./wasm-output",
    features: ["gc", "function-references"],
  });

  console.log("Expressions: [1, 2, 3] (compiling last expression)");
  console.log("WAT:");
  console.log(moduleResult.wat);
  
  if (moduleResult.wasm?.success) {
    console.log("\n✅ WASM compilation successful!");
    console.log(`📦 Generated: ${moduleResult.wasm.wasmPath}`);
    console.log(`📏 Size: ${moduleResult.wasm.size} bytes`);
  }
  console.log("");

  // Summary
  console.log("✅ WASM Compiler demo completed!");
  console.log("\nFeatures demonstrated:");
  console.log("- ✅ Type inference integration");
  console.log("- ✅ WAT generation");
  console.log("- ✅ WIT generation");
  console.log("- ✅ WASM compilation with wasm-tools");
  console.log("- ✅ WASM validation");
  console.log("- ✅ WASM inspection and analysis");
  console.log("- ✅ Error handling and recovery");
  console.log("- ✅ Various compilation targets and options");
  console.log("- ✅ Optimization and debug options");
  console.log("- ✅ Multiple expression types");
  
  if (wasmToolsCheck.available) {
    console.log("\n🎉 Full WASM compilation pipeline working!");
    console.log("📁 Check the ./wasm-output directory for generated files");
  } else {
    console.log("\n💡 Install wasm-tools to enable full WASM compilation");
  }
}

// Run the demo
if (typeof window === "undefined") {
  runWasmCompilerDemo().catch(console.error);
} 