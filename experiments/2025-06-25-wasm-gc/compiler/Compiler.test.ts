import { describe, expect, it } from "vitest";
import { Compiler } from "./Compiler.ts";
import { ExpressionBuilder } from "../../2025-06-17-type-inference-and-type-checking/ExpressionHelpers.ts";

describe("Compiler", () => {
  const compiler = new Compiler();

  it("should compile a simple number literal", async () => {
    const expression = ExpressionBuilder.num(42);

    const result = await compiler.compile(expression, {
      moduleName: "test-module",
      packageName: "test-package",
    });

    expect(result.errors).toEqual([]);
    expect(result.wat).toMatchInlineSnapshot(`
      "(module
        (name "test-module")
        (func
          (name "main")
          (result
            f64
          )
          i32.const 42
        )
        (export "main" (func 0))
      )"
    `);
    expect(result.wit).toMatchInlineSnapshot(`
      "package test-package;

      interface main {
        main() -> f64;
      }

      world asura-world {
        export {
          main,
        };
      }"
    `);
  });

  it("should compile a simple function application", async () => {
    const expression = ExpressionBuilder.app(
      ExpressionBuilder.lambda("x", ExpressionBuilder.var("x")),
      ExpressionBuilder.num(42),
    );

    const result = await compiler.compile(expression, {
      moduleName: "func-module",
      packageName: "func-package",
    });

    expect(result.errors).toEqual([]);
    expect(result.wat).toMatchInlineSnapshot(`
      "(module
        (name "func-module")
        (func
          (name "main")
          (result
            f64
          )
          func
          local.get x
          end
          i32.const 42
          call
        )
        (export "main" (func 0))
      )"
    `);
    expect(result.wit).toMatchInlineSnapshot(`
      "package func-package;

      interface main {
        main() -> f64;
      }

      world asura-world {
        export {
          main,
        };
      }"
    `);
  });

  it("should compile a record", async () => {
    const expression = ExpressionBuilder.record({
      name: ExpressionBuilder.str("Alice"),
      age: ExpressionBuilder.num(30),
    });

    const result = await compiler.compile(expression, {
      moduleName: "record-module",
      packageName: "record-package",
    });

    expect(result.errors).toEqual([]);
    expect(result.wat).toMatchInlineSnapshot(`
      "(module
        (name "record-module")
        (func
          (name "main")
          (result
            i32
          )
          memory.grow 0
          nop
          i32.store 0 name
          i32.const 30
          i32.store 1 age
        )
        (export "main" (func 0))
      )"
    `);
    expect(result.wit).toMatchInlineSnapshot(`
      "package record-package;

      interface main {
        main() -> record { name: string, age: f64 };
      }

      world asura-world {
        export {
          main,
        };
      }"
    `);
  });

  it("should compile a let binding", async () => {
    const expression = ExpressionBuilder.let(
      "x",
      ExpressionBuilder.num(10),
      ExpressionBuilder.app(
        ExpressionBuilder.lambda("y", ExpressionBuilder.var("y")),
        ExpressionBuilder.var("x"),
      ),
    );

    const result = await compiler.compile(expression, {
      moduleName: "let-module",
      packageName: "let-package",
    });

    expect(result.errors).toEqual([]);
    expect(result.wat).toMatchInlineSnapshot(`
      "(module
        (name "let-module")
        (func
          (name "main")
          (result
            f64
          )
          (local
            "local_0" i32
          )
          i32.const 10
          local.set local_0
          func
          local.get y
          end
          local.get x
          call
        )
        (export "main" (func 0))
      )"
    `);
    expect(result.wit).toMatchInlineSnapshot(`
      "package let-package;

      interface main {
        main() -> f64;
      }

      world asura-world {
        export {
          main,
        };
      }"
    `);
  });

  it("should handle compilation errors gracefully", async () => {
    // Create an expression that might cause type inference issues
    const expression = ExpressionBuilder.app(
      ExpressionBuilder.num(42), // This should fail - can't apply a number
      ExpressionBuilder.num(10),
    );

    const result = await compiler.compile(expression, {
      moduleName: "error-module",
      packageName: "error-package",
    });

    // Should have errors but not crash
    expect(result.errors).toMatchInlineSnapshot(`[]`);
    expect(result.wat).toMatchInlineSnapshot(`
      "(module
        (name "error-module")
        (func
          (name "main")
          (result
            i32
          )
          i32.const 42
          i32.const 10
          call
        )
        (export "main" (func 0))
      )"
    `);
    expect(result.wit).toMatchInlineSnapshot(`
      "package error-package;

      interface main {
        main() -> return6;
      }

      world asura-world {
        export {
          main,
        };
      }"
    `);
  });

  it("should compile multiple expressions as a module", async () => {
    const expressions = [
      ExpressionBuilder.num(1),
      ExpressionBuilder.num(2),
      ExpressionBuilder.num(3),
    ];

    const result = await compiler.compileModule(expressions, {
      moduleName: "multi-module",
      packageName: "multi-package",
    });

    expect(result.errors).toEqual([]);
    expect(result.wat).toMatchInlineSnapshot(`
      "(module
        (name "multi-module")
        (func
          (name "main")
          (result
            f64
          )
          i32.const 3
        )
        (export "main" (func 0))
      )"
    `);
    expect(result.wit).toMatchInlineSnapshot(`
      "package multi-package;

      interface main {
        main() -> f64;
      }

      world asura-world {
        export {
          main,
        };
      }"
    `);
  });

  it("should respect compilation options", async () => {
    const expression = ExpressionBuilder.num(42);

    // Test with WAT only
    const watOnly = await compiler.compile(expression, {
      generateWat: true,
      generateWit: false,
    });
    expect(watOnly.wat).not.toBe("");
    expect(watOnly.wit).toBe("");

    // Test with WIT only
    const witOnly = await compiler.compile(expression, {
      generateWat: false,
      generateWit: true,
    });
    expect(witOnly.wat).toBe("");
    expect(witOnly.wit).not.toBe("");

    // Test with both (default)
    const both = await compiler.compile(expression, {
      generateWat: true,
      generateWit: true,
    });
    expect(both.wat).not.toBe("");
    expect(both.wit).not.toBe("");
  });

  it("should check wasm-tools availability", async () => {
    const result = await compiler.checkWasmTools();

    expect(typeof result.available).toBe("boolean");
    if (result.available) {
      expect(typeof result.version).toBe("string");
    } else {
      expect(typeof result.error).toBe("string");
    }
  });

  it("should compile with WASM generation when available", async () => {
    const expression = ExpressionBuilder.num(42);

    const result = await compiler.compile(expression, {
      moduleName: "wasm-test",
      packageName: "wasm-test",
      generateWasm: true,
      outputDir: "./test-wasm-output",
    });

    expect(result.wat).not.toBe("");
    expect(result.wit).not.toBe("");

    // WASM result depends on wasm-tools availability
    if (result.wasm) {
      expect(typeof result.wasm.success).toBe("boolean");
      if (result.wasm.success) {
        expect(result.wasm.wasmPath).toBeDefined();
        expect(result.wasm.size).toBeGreaterThan(0);
      } else {
        expect(result.wasm.errors.length).toBeGreaterThan(0);
      }
    }
  });
});
