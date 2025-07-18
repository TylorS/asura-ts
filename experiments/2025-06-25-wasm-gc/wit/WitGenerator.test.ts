import { describe, expect, it } from "vitest";
import { WitGenerator } from "./WitGenerator.ts";
import { WitPackage } from "./types.ts";

describe("WitGenerator", () => {
  it("should generate a minimal package", () => {
    const pkg: WitPackage = {
      name: "test-package",
      interfaces: [],
      worlds: [],
    };

    const generator = new WitGenerator(pkg);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`"package test-package;"`);
  });

  it("should generate a package with version", () => {
    const pkg: WitPackage = {
      name: "test-package",
      version: "1.0.0",
      interfaces: [],
      worlds: [],
    };

    const generator = new WitGenerator(pkg);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`
      "package test-package;
      version "1.0.0";"
    `);
  });

  it("should generate a package with a simple interface", () => {
    const pkg: WitPackage = {
      name: "test-package",
      interfaces: [
        {
          name: "math",
          functions: [
            {
              name: "add",
              params: [
                { name: "a", type: "u32" },
                { name: "b", type: "u32" },
              ],
              results: [{ type: "u32" }],
            },
          ],
          types: [],
        },
      ],
      worlds: [],
    };

    const generator = new WitGenerator(pkg);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`
      "package test-package;

      interface math {
        add(a: u32, b: u32) -> u32;
      }"
    `);
  });

  it("should generate a package with types", () => {
    const pkg: WitPackage = {
      name: "test-package",
      interfaces: [
        {
          name: "types",
          functions: [],
          types: [
            {
              name: "Point",
              kind: {
                kind: "record",
                fields: [
                  { name: "x", type: "f32" },
                  { name: "y", type: "f32" },
                ],
              },
            },
            {
              name: "Color",
              kind: {
                kind: "enum",
                cases: ["Red", "Green", "Blue"],
              },
            },
          ],
        },
      ],
      worlds: [],
    };

    const generator = new WitGenerator(pkg);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`
      "package test-package;

      interface types {
        type Point = record { x: f32, y: f32 };
        
        type Color = enum { Red, Green, Blue };
      }"
    `);
  });

  it("should generate a package with a world", () => {
    const pkg: WitPackage = {
      name: "test-package",
      interfaces: [
        {
          name: "host",
          functions: [
            {
              name: "log",
              params: [{ name: "message", type: "string" }],
              results: [],
            },
          ],
          types: [],
        },
      ],
      worlds: [
        {
          name: "my-world",
          imports: [{ interface: "host" }],
          exports: [],
        },
      ],
    };

    const generator = new WitGenerator(pkg);
    const result = generator.generate();

    expect(result).toMatchInlineSnapshot(`
      "package test-package;

      interface host {
        log(message: string);
      }

      world my-world {
        import {
          host,
        };
      }"
    `);
  });
});
