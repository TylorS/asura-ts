// Symbol mappings for the Higher-Kinded TypeScript language
// Format: { ConvenientName: 'LiteralValue' }

export const SYMBOLS = {
  // Arithmetic Operators
  Plus: "+",
  Minus: "-",
  Multiply: "*",
  Divide: "/",

  // Comparison Operators
  Equal: "==",
  NotEqual: "!=",
  LessThan: "<",
  GreaterThan: ">",
  LessThanOrEqual: "<=",
  GreaterThanOrEqual: ">=",

  // Increment/Decrement Operators
  Increment: "++",
  Decrement: "--",

  // Assignment and Arrow
  Assign: "=",
  Arrow: "=>",

  // Logical Operators
  NullCoalescing: "??",

  // Type Operators
  Union: "|",
  Intersection: "&",
  Spread: "...", // Also used for array/rest spread
  Range: "..",

  // Punctuation - Brackets
  OpenParen: "(",
  CloseParen: ")",
  OpenBrace: "{",
  CloseBrace: "}",
  OpenBracket: "[",
  CloseBracket: "]",

  // Punctuation - Separators
  Semicolon: ";",
  Colon: ":",
  Comma: ",",
  Dot: ".",

  // Special Characters
  Underscore: "_", // Wildcard/hole
  Exclamation: "!", // Never type
  Question: "?", // Optional (if needed)
  Backslash: "\\", // Escape character

  // String Delimiters
  DoubleQuote: '"',
  SingleQuote: "'",

  // Template/Interpolation (if needed)
  Backtick: "`",
  Dollar: "$",

  // Comments
  SingleLineComment: "//",
  MultiLineCommentStart: "/*",
  MultiLineCommentEnd: "*/",


  // Whitespace
  Space: " ",
  Tab: "\t",
  Newline: "\n",
  CarriageReturn: "\r",
} as const;

export type SymbolKind = keyof typeof SYMBOLS;
export type SymbolValue = (typeof SYMBOLS)[SymbolKind];

// Reverse mapping for convenience
export const SYMBOL_VALUES = Object.fromEntries(
  Object.entries(SYMBOLS).map(([key, value]) => [value, key]),
) as {
  [K in SymbolKind as (typeof SYMBOLS)[K]]: K;
};

export type GetSymbolName<T extends SymbolValue> = (typeof SYMBOL_VALUES)[T];

// Helper function to get symbol name from value
export function getSymbolName(value: SymbolValue): keyof typeof SYMBOLS {
  return SYMBOL_VALUES[value];
}

// Helper function to check if a string is a known symbol
export function isSymbol(value: string): boolean {
  return value in SYMBOL_VALUES;
}

// Multi-character operators that need special handling in lexing
export const MULTI_CHAR_OPERATORS = new Set<string>(
  Object.values(SYMBOLS).filter((value) => value.length > 1),
);

export function getPossibleMultiCharOperators(value: string) {
  const possibleOperators: string[] = [];

  for (const operator of MULTI_CHAR_OPERATORS) {
    if (operator.startsWith(value)) {
      possibleOperators.push(operator);
    }
  }

  return possibleOperators;
}
