import { describe, expect, it } from "vitest";
import { pipeArguments } from "./Pipeable.ts";

describe("pipeArguments optimization", () => {
  it("should handle 0 arguments", () => {
    const self = "test";
    const args = [] as any as IArguments;
    Object.defineProperty(args, "length", { value: 0 });

    const result = pipeArguments(self, args);
    expect(result).toBe("test");
  });

  it("should handle 1 argument", () => {
    const self = 5;
    const fn1 = (x: number) => x * 2;
    const args = [fn1] as any as IArguments;
    Object.defineProperty(args, "length", { value: 1 });

    const result = pipeArguments(self, args);
    expect(result).toBe(10);
  });

  it("should handle 3 arguments", () => {
    const self = 1;
    const fn1 = (x: number) => x + 1;
    const fn2 = (x: number) => x * 2;
    const fn3 = (x: number) => x + 10;
    const args = [fn1, fn2, fn3] as any as IArguments;
    Object.defineProperty(args, "length", { value: 3 });

    const result = pipeArguments(self, args);
    expect(result).toBe(14); // ((1 + 1) * 2) + 10 = 14
  });

  it("should handle 9 arguments (max lookup table)", () => {
    const self = 0;
    const add1 = (x: number) => x + 1;
    const args = Array(9).fill(add1) as any as IArguments;
    Object.defineProperty(args, "length", { value: 9 });

    const result = pipeArguments(self, args);
    expect(result).toBe(9);
  });

  it("should handle 15 arguments (fallback to loop)", () => {
    const self = 0;
    const add1 = (x: number) => x + 1;
    const args = Array(15).fill(add1) as any as IArguments;
    Object.defineProperty(args, "length", { value: 15 });

    const result = pipeArguments(self, args);
    expect(result).toBe(15);
  });
});
