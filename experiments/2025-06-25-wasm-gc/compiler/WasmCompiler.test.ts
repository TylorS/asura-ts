import { beforeAll, describe, expect, it } from "vitest";
import { WasmCompiler } from "./WasmCompiler.ts";

describe("WasmCompiler", () => {
  let compiler: WasmCompiler;

  beforeAll(() => {
    compiler = new WasmCompiler();
  });

  it("should check wasm-tools availability", async () => {
    const result = await compiler.checkWasmTools();

    // The result depends on whether wasm-tools is installed
    expect(typeof result.available).toBe("boolean");
    if (result.available) {
      expect(typeof result.version).toBe("string");
      expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    } else {
      expect(typeof result.error).toBe("string");
    }
  });

  it("should compile simple WAT to WASM", async () => {
    const simpleWat = `
(module
  (func (export "main") (result i32)
    i32.const 42
  )
)`;

    const result = await compiler.compile(simpleWat, undefined, {
      outputDir: "./test-wasm-output",
    });

    // If wasm-tools is available, compilation should succeed
    if (result.success) {
      expect(result.wasmPath).toBeDefined();
      expect(result.watPath).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);

      // Validate the generated WASM
      if (result.wasmPath) {
        const validation = await compiler.validateWasm(result.wasmPath);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);
      }
    } else {
      // If wasm-tools is not available, we should get appropriate errors
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("wasm-tools"))).toBe(true);
    }
  });

  it("should handle compilation errors gracefully", async () => {
    const invalidWat = `
(module
  (func (export "main") (result i32)
    invalid_instruction
  )
)`;

    const result = await compiler.compile(invalidWat, undefined, {
      outputDir: "./test-wasm-output",
    });

    // Should fail due to invalid instruction
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("invalid"))).toBe(true);
  });

  it("should compile with optimization", async () => {
    const wat = `
(module
  (func (export "main") (result i32)
    i32.const 1
    i32.const 2
    i32.add
  )
)`;

    const result = await compiler.compile(wat, undefined, {
      outputDir: "./test-wasm-output",
      optimize: true,
    });

    if (result.success) {
      expect(result.wasmPath).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    }
  });

  it("should compile with debug information", async () => {
    const wat = `
(module
  (func (export "main") (result i32)
    i32.const 42
  )
)`;

    const result = await compiler.compile(wat, undefined, {
      outputDir: "./test-wasm-output",
      debug: true,
    });

    if (result.success) {
      expect(result.wasmPath).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    }
  });

  it("should compile with specific target", async () => {
    const wat = `
(module
  (func (export "main") (result i32)
    i32.const 42
  )
)`;

    const result = await compiler.compile(wat, undefined, {
      outputDir: "./test-wasm-output",
      target: "wasm32-unknown-unknown",
    });

    if (result.success) {
      expect(result.wasmPath).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    }
  });

  it("should get WASM information", async () => {
    const wat = `
(module
  (memory (export "memory") 1)
  (global (export "global") i32 i32.const 42)
  (func (export "main") (result i32)
    i32.const 42
  )
)`;

    const result = await compiler.compile(wat, undefined, {
      outputDir: "./test-wasm-output",
    });

    if (result.success && result.wasmPath) {
      const info = await compiler.getWasmInfo(result.wasmPath);

      expect(info.functions).toBeGreaterThan(0);
      expect(info.memories).toBeGreaterThan(0);
      expect(info.globals).toBeGreaterThan(0);
      expect(info.exports).toBeGreaterThan(0);
      expect(info.size).toBeGreaterThan(0);
    }
  });

  it("should handle WIT compilation", async () => {
    const wat = `
(module
  (func (export "main") (result i32)
    i32.const 42
  )
)`;

    const wit = `
package test-package;

interface main {
  main() -> u32;
}

world test-world {
  export { main };
}`;

    const result = await compiler.compile(wat, wit, {
      outputDir: "./test-wasm-output",
    });

    if (result.success) {
      expect(result.watPath).toBeDefined();
      expect(result.witPath).toBeDefined();
      expect(result.wasmPath).toBeDefined();
    }
  });

  it("should handle custom wasm-tools path", async () => {
    // Test with a non-existent path
    const customCompiler = new WasmCompiler("/non/existent/path");
    const result = await customCompiler.checkWasmTools();

    expect(result.available).toBe(false);
    expect(result.error).toBeDefined();
  });
});
