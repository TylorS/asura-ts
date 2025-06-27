import { describe, it, expect } from "vitest";
import { WatGenerator } from "./WatGenerator.ts";
import { WatModule } from "./types.ts";

describe("WatGenerator", () => {
  it("should generate an empty module", () => {
    const module: WatModule = {
      imports: [],
      exports: [],
      functions: [],
      memories: [],
      tables: [],
      globals: [],
    };

    const generator = new WatGenerator(module);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`"(module)"`);
  });

  it("should generate a module with a name", () => {
    const module: WatModule = {
      name: "test-module",
      imports: [],
      exports: [],
      functions: [],
      memories: [],
      tables: [],
      globals: [],
    };

    const generator = new WatGenerator(module);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`
      "(module
        (name "test-module")
      )"
    `);
  });

  it("should generate a module with imports", () => {
    const module: WatModule = {
      imports: [
        { module: "env", name: "memory", kind: "memory" },
        { module: "env", name: "log", kind: "func", type: "(func (param i32))" },
      ],
      exports: [],
      functions: [],
      memories: [],
      tables: [],
      globals: [],
    };

    const generator = new WatGenerator(module);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`
      "(module
        (import "env" "memory" (memory))
        (import "env" "log" (func (func (param i32))))
      )"
    `);
  });

  it("should generate a module with a simple function", () => {
    const module: WatModule = {
      imports: [],
      exports: [],
      functions: [
        {
          name: "add",
          params: [
            { name: "a", type: "i32" },
            { name: "b", type: "i32" },
          ],
          results: ["i32"],
          locals: [],
          body: [
            { opcode: "local.get", operands: ["a"] },
            { opcode: "local.get", operands: ["b"] },
            { opcode: "i32.add" },
          ],
        },
      ],
      memories: [],
      tables: [],
      globals: [],
    };

    const generator = new WatGenerator(module);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`
      "(module
        (func
          (name "add")
          (param
            "a" i32
            "b" i32
          )
          (result
            i32
          )
          local.get a
          local.get b
          i32.add
        )
      )"
    `);
  });
}); 