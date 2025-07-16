import { describe, expect, it } from "vitest";
import { tokenizeToArray } from "./Tokenizer.ts";

function formatTokens(source: string) {
  const tokens = tokenizeToArray(source);
  return tokens.map((token) => {
    const text = "text" in token ? token.text : "";
    return `${token.kind}${text ? `("${text}")` : ""}`;
  });
}

describe("Tokenizer", () => {
  it("should tokenize keywords correctly", () => {
    const source = "export data effect fun import interface let type";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "export",
        "data",
        "effect",
        "fun",
        "import",
        "interface",
        "let",
        "type",
      ]
    `);
  });

  it("should tokenize control flow keywords correctly", () => {
    const source =
      "break continue else for if in return while handle match with";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "break",
        "Whitespace(" ")",
        "continue",
        "Whitespace(" ")",
        "else",
        "Whitespace(" ")",
        "for",
        "Whitespace(" ")",
        "if",
        "Whitespace(" ")",
        "in",
        "Whitespace(" ")",
        "return",
        "Whitespace(" ")",
        "while",
        "Whitespace(" ")",
        "handle",
        "Whitespace(" ")",
        "match",
        "Whitespace(" ")",
        "with",
      ]
    `);
  });

  it("should tokenize literals correctly", () => {
    const source = `42 3.14 42n 3.14n true false "hello" 'world'`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "IntegerLiteral("42")",
        "Whitespace(" ")",
        "FloatLiteral("3.14")",
        "Whitespace(" ")",
        "BigIntegerLiteral("42")",
        "Whitespace(" ")",
        "BigDecimalLiteral("3.14")",
        "Whitespace(" ")",
        "BooleanLiteral("true")",
        "Whitespace(" ")",
        "BooleanLiteral("false")",
        "Whitespace(" ")",
        "StringLiteral(""hello"")",
        "Whitespace(" ")",
        "StringLiteral("'world'")",
      ]
    `);
  });

  it("should tokenize identifiers and keywords mixed", () => {
    const source = "let myVar = true; export const PI = 3.14;";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "let",
        "Whitespace(" ")",
        "Identifier("myVar")",
        "Whitespace(" ")",
        "Symbol("=")",
        "Whitespace(" ")",
        "BooleanLiteral("true")",
        "Symbol(";")",
        "Whitespace(" ")",
        "export",
        "Whitespace(" ")",
        "Identifier("const")",
        "Whitespace(" ")",
        "Identifier("PI")",
        "Whitespace(" ")",
        "Symbol("=")",
        "Whitespace(" ")",
        "FloatLiteral("3.14")",
        "Symbol(";")",
      ]
    `);
  });

  it("should tokenize operators and symbols correctly", () => {
    const source =
      "+ - * / == != < > <= >= ++ -- => ... = : ; , ( ) [ ] { } | &";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Symbol("+")",
        "Whitespace(" ")",
        "Symbol("-")",
        "Whitespace(" ")",
        "Symbol("*")",
        "Whitespace(" ")",
        "Symbol("/")",
        "Whitespace(" ")",
        "Symbol("==")",
        "Whitespace(" ")",
        "Symbol("!=")",
        "Whitespace(" ")",
        "Symbol("<")",
        "Whitespace(" ")",
        "Symbol(">")",
        "Whitespace(" ")",
        "Symbol("<=")",
        "Whitespace(" ")",
        "Symbol(">=")",
        "Whitespace(" ")",
        "Symbol("++")",
        "Whitespace(" ")",
        "Symbol("--")",
        "Whitespace(" ")",
        "Symbol("=>")",
        "Whitespace(" ")",
        "Symbol("...")",
        "Whitespace(" ")",
        "Symbol("=")",
        "Whitespace(" ")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Symbol(";")",
        "Whitespace(" ")",
        "Symbol(",")",
        "Whitespace(" ")",
        "Symbol("(")",
        "Whitespace(" ")",
        "Symbol(")")",
        "Whitespace(" ")",
        "Symbol("[")",
        "Whitespace(" ")",
        "Symbol("]")",
        "Whitespace(" ")",
        "Symbol("{")",
        "Whitespace(" ")",
        "Symbol("}")",
        "Whitespace(" ")",
        "Symbol("|")",
        "Whitespace(" ")",
        "Symbol("&")",
      ]
    `);
  });

  it("should tokenize comments correctly", () => {
    const source = `// Single line comment
/* Multi-line
   comment */
let x = 5; // End of line comment`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Comment("// Single line comment")",
        "Newline",
        "MultiLineComment("/* Multi-line
         comment */")",
        "Newline",
        "let",
        "Whitespace(" ")",
        "Identifier("x")",
        "Whitespace(" ")",
        "Symbol("=")",
        "Whitespace(" ")",
        "IntegerLiteral("5")",
        "Symbol(";")",
        "Whitespace(" ")",
        "Comment("// End of line comment")",
      ]
    `);
  });

  it("should tokenize strings with escapes correctly", () => {
    const source = `"hello\\nworld" 'single\\tquote' "empty" ''`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "StringLiteral(""hello\\nworld"")",
        "Whitespace(" ")",
        "StringLiteral("'single\\tquote'")",
        "Whitespace(" ")",
        "StringLiteral(""empty"")",
        "Whitespace(" ")",
        "StringLiteral("''")",
      ]
    `);
  });

  it("should tokenize numbers and floats correctly", () => {
    const source = "0 42 123 0.5 3.14159 42n 3.14n";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "IntegerLiteral("0")",
        "Whitespace(" ")",
        "IntegerLiteral("42")",
        "Whitespace(" ")",
        "IntegerLiteral("123")",
        "Whitespace(" ")",
        "FloatLiteral("0.5")",
        "Whitespace(" ")",
        "FloatLiteral("3.14159")",
        "Whitespace(" ")",
        "BigIntegerLiteral("42")",
        "Whitespace(" ")",
        "BigDecimalLiteral("3.14")",
      ]
    `);
  });

  it("should tokenize complex function correctly", () => {
    const source = `fun fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "fun",
        "Whitespace(" ")",
        "Identifier("fibonacci")",
        "Symbol("(")",
        "Identifier("n")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("number")",
        "Symbol(")")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("number")",
        "Whitespace(" ")",
        "Symbol("{")",
        "Newline",
        "Whitespace("  ")",
        "if",
        "Whitespace(" ")",
        "Symbol("(")",
        "Identifier("n")",
        "Whitespace(" ")",
        "Symbol("<=")",
        "Whitespace(" ")",
        "IntegerLiteral("1")",
        "Symbol(")")",
        "Whitespace(" ")",
        "return",
        "Whitespace(" ")",
        "Identifier("n")",
        "Symbol(";")",
        "Newline",
        "Whitespace("  ")",
        "return",
        "Whitespace(" ")",
        "Identifier("fibonacci")",
        "Symbol("(")",
        "Identifier("n")",
        "Whitespace(" ")",
        "Symbol("-")",
        "Whitespace(" ")",
        "IntegerLiteral("1")",
        "Symbol(")")",
        "Whitespace(" ")",
        "Symbol("+")",
        "Whitespace(" ")",
        "Identifier("fibonacci")",
        "Symbol("(")",
        "Identifier("n")",
        "Whitespace(" ")",
        "Symbol("-")",
        "Whitespace(" ")",
        "IntegerLiteral("2")",
        "Symbol(")")",
        "Symbol(";")",
        "Newline",
        "Symbol("}")",
      ]
    `);
  });

  it("should tokenize data type definition correctly", () => {
    const source = `data Maybe<T> = Some(T) | None;`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "data",
        "Whitespace(" ")",
        "Identifier("Maybe")",
        "Symbol("<")",
        "Identifier("T")",
        "Symbol(">")",
        "Whitespace(" ")",
        "Symbol("=")",
        "Whitespace(" ")",
        "Identifier("Some")",
        "Symbol("(")",
        "Identifier("T")",
        "Symbol(")")",
        "Whitespace(" ")",
        "Symbol("|")",
        "Whitespace(" ")",
        "Identifier("None")",
        "Symbol(";")",
      ]
    `);
  });

  it("should tokenize match expression correctly", () => {
    const source = `match result with {
  Some(value) => handle(value),
  None => return null,
}`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "match",
        "Whitespace(" ")",
        "Identifier("result")",
        "Whitespace(" ")",
        "with",
        "Whitespace(" ")",
        "Symbol("{")",
        "Newline",
        "Whitespace("  ")",
        "Identifier("Some")",
        "Symbol("(")",
        "Identifier("value")",
        "Symbol(")")",
        "Whitespace(" ")",
        "Symbol("=>")",
        "Whitespace(" ")",
        "handle",
        "Symbol("(")",
        "Identifier("value")",
        "Symbol(")")",
        "Symbol(",")",
        "Newline",
        "Whitespace("  ")",
        "Identifier("None")",
        "Whitespace(" ")",
        "Symbol("=>")",
        "Whitespace(" ")",
        "return",
        "Whitespace(" ")",
        "Identifier("null")",
        "Symbol(",")",
        "Newline",
        "Symbol("}")",
      ]
    `);
  });

  it("should handle edge cases correctly", () => {
    const source = "123.toString() 456..range";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "IntegerLiteral("123")",
        "Identifier("toString")",
        "Symbol("(")",
        "Symbol(")")",
        "Whitespace(" ")",
        "IntegerLiteral("456")",
        "Symbol(".")",
        "Identifier("range")",
      ]
    `);
  });

  it("should handle empty and minimal cases", () => {
    expect(formatTokens("")).toMatchInlineSnapshot(`[]`);
    expect(formatTokens(" ")).toMatchInlineSnapshot(`
      [
        "Whitespace(" ")",
      ]
    `);
    expect(formatTokens("\n")).toMatchInlineSnapshot(`
      [
        "Newline",
      ]
    `);
  });

  it("should tokenize multi-character operators correctly", () => {
    const source = "a == b != c <= d >= e ++ f -- g => h ... i";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Identifier("a")",
        "Whitespace(" ")",
        "Symbol("==")",
        "Whitespace(" ")",
        "Identifier("b")",
        "Whitespace(" ")",
        "Symbol("!=")",
        "Whitespace(" ")",
        "Identifier("c")",
        "Whitespace(" ")",
        "Symbol("<=")",
        "Whitespace(" ")",
        "Identifier("d")",
        "Whitespace(" ")",
        "Symbol(">=")",
        "Whitespace(" ")",
        "Identifier("e")",
        "Whitespace(" ")",
        "Symbol("++")",
        "Whitespace(" ")",
        "Identifier("f")",
        "Whitespace(" ")",
        "Symbol("--")",
        "Whitespace(" ")",
        "Identifier("g")",
        "Whitespace(" ")",
        "Symbol("=>")",
        "Whitespace(" ")",
        "Identifier("h")",
        "Whitespace(" ")",
        "Symbol("...")",
        "Whitespace(" ")",
        "Identifier("i")",
      ]
    `);
  });

  // Additional comprehensive tests
  it("should tokenize array literals correctly", () => {
    const source = `[1, 2, 3, "hello", true]`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Symbol("[")",
        "IntegerLiteral("1")",
        "Symbol(",")",
        "Whitespace(" ")",
        "IntegerLiteral("2")",
        "Symbol(",")",
        "Whitespace(" ")",
        "IntegerLiteral("3")",
        "Symbol(",")",
        "Whitespace(" ")",
        "StringLiteral(""hello"")",
        "Symbol(",")",
        "Whitespace(" ")",
        "BooleanLiteral("true")",
        "Symbol("]")",
      ]
    `);
  });

  it("should tokenize object literals correctly", () => {
    const source = `{ name: "John", age: 30, active: true }`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Symbol("{")",
        "Whitespace(" ")",
        "Identifier("name")",
        "Symbol(":")",
        "Whitespace(" ")",
        "StringLiteral(""John"")",
        "Symbol(",")",
        "Whitespace(" ")",
        "Identifier("age")",
        "Symbol(":")",
        "Whitespace(" ")",
        "IntegerLiteral("30")",
        "Symbol(",")",
        "Whitespace(" ")",
        "Identifier("active")",
        "Symbol(":")",
        "Whitespace(" ")",
        "BooleanLiteral("true")",
        "Whitespace(" ")",
        "Symbol("}")",
      ]
    `);
  });

  it("should tokenize function types correctly", () => {
    const source = `(x: number, y: string) => boolean`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Symbol("(")",
        "Identifier("x")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("number")",
        "Symbol(",")",
        "Whitespace(" ")",
        "Identifier("y")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("string")",
        "Symbol(")")",
        "Whitespace(" ")",
        "Symbol("=>")",
        "Whitespace(" ")",
        "Identifier("boolean")",
      ]
    `);
  });

  it("should tokenize union and intersection types correctly", () => {
    const source = `string | number & { id: number }`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Identifier("string")",
        "Whitespace(" ")",
        "Symbol("|")",
        "Whitespace(" ")",
        "Identifier("number")",
        "Whitespace(" ")",
        "Symbol("&")",
        "Whitespace(" ")",
        "Symbol("{")",
        "Whitespace(" ")",
        "Identifier("id")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("number")",
        "Whitespace(" ")",
        "Symbol("}")",
      ]
    `);
  });

  it("should tokenize template strings correctly", () => {
    const source = "`Hello ${name}, you are ${age} years old`";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Symbol("\`")",
        "Identifier("Hello")",
        "Whitespace(" ")",
        "Symbol("$")",
        "Symbol("{")",
        "Identifier("name")",
        "Symbol("}")",
        "Symbol(",")",
        "Whitespace(" ")",
        "Identifier("you")",
        "Whitespace(" ")",
        "Identifier("are")",
        "Whitespace(" ")",
        "Symbol("$")",
        "Symbol("{")",
        "Identifier("age")",
        "Symbol("}")",
        "Whitespace(" ")",
        "Identifier("years")",
        "Whitespace(" ")",
        "Identifier("old")",
        "Symbol("\`")",
      ]
    `);
  });

  it("should tokenize complex nested expressions correctly", () => {
    const source = `arr.filter(x => x.value > 0).map(x => x.name)`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Identifier("arr")",
        "Symbol(".")",
        "Identifier("filter")",
        "Symbol("(")",
        "Identifier("x")",
        "Whitespace(" ")",
        "Symbol("=>")",
        "Whitespace(" ")",
        "Identifier("x")",
        "Symbol(".")",
        "Identifier("value")",
        "Whitespace(" ")",
        "Symbol(">")",
        "Whitespace(" ")",
        "IntegerLiteral("0")",
        "Symbol(")")",
        "Symbol(".")",
        "Identifier("map")",
        "Symbol("(")",
        "Identifier("x")",
        "Whitespace(" ")",
        "Symbol("=>")",
        "Whitespace(" ")",
        "Identifier("x")",
        "Symbol(".")",
        "Identifier("name")",
        "Symbol(")")",
      ]
    `);
  });

  it("should tokenize type definitions correctly", () => {
    const source = `type User = { name: string; age?: number; }`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "type",
        "Whitespace(" ")",
        "Identifier("User")",
        "Whitespace(" ")",
        "Symbol("=")",
        "Whitespace(" ")",
        "Symbol("{")",
        "Whitespace(" ")",
        "Identifier("name")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("string")",
        "Symbol(";")",
        "Whitespace(" ")",
        "Identifier("age")",
        "Symbol("?")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("number")",
        "Symbol(";")",
        "Whitespace(" ")",
        "Symbol("}")",
      ]
    `);
  });

  it("should tokenize interface definitions correctly", () => {
    const source = `interface Comparable<T> {
  compare(other: T): number;
}`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "interface",
        "Whitespace(" ")",
        "Identifier("Comparable")",
        "Symbol("<")",
        "Identifier("T")",
        "Symbol(">")",
        "Whitespace(" ")",
        "Symbol("{")",
        "Newline",
        "Whitespace("  ")",
        "Identifier("compare")",
        "Symbol("(")",
        "Identifier("other")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("T")",
        "Symbol(")")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("number")",
        "Symbol(";")",
        "Newline",
        "Symbol("}")",
      ]
    `);
  });

  it("should tokenize effect definitions correctly", () => {
    const source = `effect Reader<R> {
  ask(): R;
}`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "effect",
        "Whitespace(" ")",
        "Identifier("Reader")",
        "Symbol("<")",
        "Identifier("R")",
        "Symbol(">")",
        "Whitespace(" ")",
        "Symbol("{")",
        "Newline",
        "Whitespace("  ")",
        "Identifier("ask")",
        "Symbol("(")",
        "Symbol(")")",
        "Symbol(":")",
        "Whitespace(" ")",
        "Identifier("R")",
        "Symbol(";")",
        "Newline",
        "Symbol("}")",
      ]
    `);
  });

  it("should tokenize range operators correctly", () => {
    const source = `0..10 0...10 arr[0..5]`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "IntegerLiteral("0")",
        "Symbol(".")",
        "IntegerLiteral("10")",
        "Whitespace(" ")",
        "IntegerLiteral("0")",
        "Symbol("..")",
        "IntegerLiteral("10")",
        "Whitespace(" ")",
        "Identifier("arr")",
        "Symbol("[")",
        "IntegerLiteral("0")",
        "Symbol(".")",
        "IntegerLiteral("5")",
        "Symbol("]")",
      ]
    `);
  });

  it("should tokenize optional chaining correctly", () => {
    const source = `obj?.prop?.method?.()`;
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Identifier("obj")",
        "Symbol("?")",
        "Symbol(".")",
        "Identifier("prop")",
        "Symbol("?")",
        "Symbol(".")",
        "Identifier("method")",
        "Symbol("?")",
        "Symbol(".")",
        "Symbol("(")",
        "Symbol(")")",
      ]
    `);
  });

  it("should tokenize null coalescing correctly", () => {
    const source = "a ?? b";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Identifier("a")",
        "Whitespace(" ")",
        "Symbol("??")",
        "Whitespace(" ")",
        "Identifier("b")",
      ]
    `);
  });

  it("should tokenize regex literals correctly", () => {
    const source = "/abc/ /def/gi /a\\/b/";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Symbol("/")",
        "Identifier("abc")",
        "Symbol("/")",
        "Whitespace(" ")",
        "Symbol("/")",
        "Identifier("def")",
        "Symbol("/")",
        "Identifier("gi")",
        "Whitespace(" ")",
        "Symbol("/")",
        "Identifier("a")",
        "Symbol("\\")",
        "Symbol("/")",
        "Identifier("b")",
        "Symbol("/")",
      ]
    `);
  });

  it("should distinguish regex from division operator", () => {
    const source = "a / b /c/";
    const tokens = formatTokens(source);

    expect(tokens).toMatchInlineSnapshot(`
      [
        "Identifier("a")",
        "Whitespace(" ")",
        "Symbol("/")",
        "Whitespace(" ")",
        "Identifier("b")",
        "Whitespace(" ")",
        "Symbol("/")",
        "Identifier("c")",
        "Symbol("/")",
      ]
    `);
  });
});
