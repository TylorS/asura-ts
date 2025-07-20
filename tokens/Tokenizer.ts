import { Span, SpanLocation } from "./Span.ts";
import {
  getPossibleMultiCharOperators,
  MULTI_CHAR_OPERATORS,
  SymbolKind,
  SYMBOLS,
  SymbolValue,
} from "./Symbols.ts";
import {
  BigDecimalLiteral,
  BigIntegerLiteral,
  BooleanLiteral,
  BreakKeyword,
  Comment,
  ContinueKeyword,
  DataKeyword,
  EffectKeyword,
  ElseKeyword,
  // Keywords
  ExportKeyword,
  ExtendsKeyword,
  FloatLiteral,
  ForKeyword,
  FunKeyword,
  HandleKeyword,
  Identifier,
  IfKeyword,
  ImportKeyword,
  InKeyword,
  IntegerLiteral,
  InterfaceKeyword,
  JoinKeyword,
  LetKeyword,
  MatchKeyword,
  MultiLineComment,
  MutableKeyword,
  Newline,
  OfKeyword,
  ResumeKeyword,
  ReturnKeyword,
  StringLiteral,
  Symbol,
  Token,
  TypeKeyword,
  WhileKeyword,
  Whitespace,
  WithKeyword,
} from "./Token.ts";

// Keywords mapping
const KEYWORDS = {
  "export": ExportKeyword,
  "data": DataKeyword,
  "effect": EffectKeyword,
  "fun": FunKeyword,
  "import": ImportKeyword,
  "interface": InterfaceKeyword,
  "join": JoinKeyword,
  "let": LetKeyword,
  "type": TypeKeyword,
  "break": BreakKeyword,
  "continue": ContinueKeyword,
  "else": ElseKeyword,
  "for": ForKeyword,
  "if": IfKeyword,
  "in": InKeyword,
  "of": OfKeyword,
  "resume": ResumeKeyword,
  "return": ReturnKeyword,
  "while": WhileKeyword,
  "handle": HandleKeyword,
  "match": MatchKeyword,
  "with": WithKeyword,
  "mut": MutableKeyword,
  "extends": ExtendsKeyword,
} as const;

// Tokenizer state machine states
enum TokenState {
  START,
  IN_IDENTIFIER,
  IN_NUMBER,
  IN_NUMBER_DOT,
  IN_FLOAT,
  IN_STRING_DOUBLE,
  IN_STRING_SINGLE,
  IN_STRING_ESCAPE,
  IN_COMMENT_SINGLE,
  IN_COMMENT_MULTI,
  IN_COMMENT_MULTI_STAR,
  IN_OPERATOR,
  IN_WHITESPACE,
}

export class IncrementalTokenizer {
  private position: number = 0;
  private line: number = 0;
  private column: number = 0;

  // Current token being built
  private currentState: TokenState = TokenState.START;
  private currentBuffer: string = "";
  private tokenStartLocation: SpanLocation | null = null;
  private stringQuoteChar: string = "";

  constructor(private readonly source: string) {}

  // Main incremental tokenizer - yields tokens as they're completed
  *tokenize(): Generator<Token, void, unknown> {
    while (this.position < this.source.length) {
      const char = this.source[this.position];
      const token = this.processCharacter(char);

      if (token) {
        yield token;
      }

      this.advance();
    }

    // Handle any remaining token at end of input
    const finalToken = this.finishCurrentToken();
    if (finalToken) {
      yield finalToken;
    }
  }

  private processCharacter(char: string): Token | null {
    switch (this.currentState) {
      case TokenState.START:
        return this.handleStartState(char);

      case TokenState.IN_IDENTIFIER:
        return this.handleIdentifierState(char);

      case TokenState.IN_NUMBER:
        return this.handleNumberState(char);

      case TokenState.IN_NUMBER_DOT:
        return this.handleNumberDotState(char);

      case TokenState.IN_FLOAT:
        return this.handleFloatState(char);

      case TokenState.IN_STRING_DOUBLE:
      case TokenState.IN_STRING_SINGLE:
        return this.handleStringState(char);

      case TokenState.IN_STRING_ESCAPE:
        return this.handleStringEscapeState(char);

      case TokenState.IN_COMMENT_SINGLE:
        return this.handleSingleCommentState(char);

      case TokenState.IN_COMMENT_MULTI:
        return this.handleMultiCommentState(char);

      case TokenState.IN_COMMENT_MULTI_STAR:
        return this.handleMultiCommentStarState(char);

      case TokenState.IN_OPERATOR:
        return this.handleOperatorState(char);

      case TokenState.IN_WHITESPACE:
        return this.handleWhitespaceState(char);

      default:
        throw new Error(`Unknown state: ${this.currentState}`);
    }
  }

  private handleStartState(char: string): Token | null {
    // Handle whitespace - emit tokens instead of skipping
    if (char === "\n") {
      const span = new Span(
        this.getCurrentLocation(),
        this.getCurrentLocation(),
      );
      return new Newline(span);
    }

    if (/[ \t\r]/.test(char)) {
      this.startNewToken();
      this.currentState = TokenState.IN_WHITESPACE;
      this.currentBuffer = char;
      return null;
    }

    this.startNewToken();

    // Start of identifier or keyword
    if (/[a-zA-Z_]/.test(char)) {
      this.currentState = TokenState.IN_IDENTIFIER;
      this.currentBuffer = char;
      return null;
    }

    // Start of number
    if (/[0-9]/.test(char)) {
      this.currentState = TokenState.IN_NUMBER;
      this.currentBuffer = char;
      return null;
    }

    // Start of string
    if (char === '"') {
      this.currentState = TokenState.IN_STRING_DOUBLE;
      this.stringQuoteChar = '"';
      this.currentBuffer = char;
      return null;
    }

    if (char === "'") {
      this.currentState = TokenState.IN_STRING_SINGLE;
      this.stringQuoteChar = "'";
      this.currentBuffer = char;
      return null;
    }

    // Start of comment
    if (char === "/") {
      this.currentState = TokenState.IN_OPERATOR;
      this.currentBuffer = char;
      return null;
    }

    // Check for multi-character operators
    const possibleOps = getPossibleMultiCharOperators(char);
    if (possibleOps.length > 0) {
      this.currentState = TokenState.IN_OPERATOR;
      this.currentBuffer = char;
      return null;
    }

    // Single-character symbol
    for (const [symbolKind, symbolValue] of Object.entries(SYMBOLS)) {
      if (symbolValue === char) {
        return this.createSymbolToken(symbolKind as SymbolKind, char);
      }
    }

    // Unknown character - skip for now
    return null;
  }

  private handleIdentifierState(char: string): Token | null {
    // Continue identifier
    if (/[a-zA-Z0-9_]/.test(char)) {
      this.currentBuffer += char;
      return null;
    }

    // End of identifier - create token and handle current character
    const token = this.createIdentifierOrKeywordToken();
    this.resetToStart();

    // Don't advance - let the next iteration handle this character
    this.position--;
    this.column--;

    return token;
  }

  private handleNumberState(char: string): Token | null {
    // Continue number
    if (/[0-9]/.test(char)) {
      this.currentBuffer += char;
      return null;
    }

    // Start of float
    if (char === ".") {
      this.currentState = TokenState.IN_NUMBER_DOT;
      this.currentBuffer += char;
      return null;
    }

    // BigInt suffix
    if (char === "n") {
      const token = this.createBigIntegerToken();
      this.resetToStart();
      return token;
    }

    // End of number
    const token = this.createIntegerToken();
    this.resetToStart();

    // Don't advance - let the next iteration handle this character
    this.position--;
    this.column--;

    return token;
  }

  private handleNumberDotState(char: string): Token | null {
    // Must be followed by a digit for valid float
    if (/[0-9]/.test(char)) {
      this.currentState = TokenState.IN_FLOAT;
      this.currentBuffer += char;
      return null;
    }

    // Not a valid float - backtrack
    // This is a number followed by a dot
    const numberPart = this.currentBuffer.slice(0, -1);
    const numberToken = new IntegerLiteral(
      numberPart,
      new Span(this.tokenStartLocation!, this.getCurrentLocation()),
    );

    // Reset and start over with the dot
    this.resetToStart();
    this.position--;
    this.column--;

    return numberToken;
  }

  private handleFloatState(char: string): Token | null {
    // Continue float
    if (/[0-9]/.test(char)) {
      this.currentBuffer += char;
      return null;
    }

    // BigDecimal suffix
    if (char === "n") {
      const token = this.createBigDecimalToken();
      this.resetToStart();
      return token;
    }

    // End of float
    const token = this.createFloatToken();
    this.resetToStart();

    // Don't advance
    this.position--;
    this.column--;

    return token;
  }

  private handleStringState(char: string): Token | null {
    this.currentBuffer += char;

    // End of string
    if (char === this.stringQuoteChar) {
      const token = this.createStringToken();
      this.resetToStart();
      return token;
    }

    // Start of escape sequence
    if (char === "\\") {
      this.currentState = TokenState.IN_STRING_ESCAPE;
      return null;
    }

    // Continue string
    return null;
  }

  private handleStringEscapeState(char: string): Token | null {
    this.currentBuffer += char;
    // Return to string state after escape
    this.currentState = this.stringQuoteChar === '"'
      ? TokenState.IN_STRING_DOUBLE
      : TokenState.IN_STRING_SINGLE;
    return null;
  }

  private handleSingleCommentState(char: string): Token | null {
    // End of line comment
    if (char === "\n") {
      const token = new Comment(this.currentBuffer, this.createSpan());
      this.resetToStart();
      // Don't advance - let newline be processed normally
      this.position--;
      this.column--;
      return token;
    }

    // Continue comment
    this.currentBuffer += char;
    return null;
  }

  private handleWhitespaceState(char: string): Token | null {
    // Continue whitespace
    if (/[ \t\r]/.test(char)) {
      this.currentBuffer += char;
      return null;
    }

    // End of whitespace
    const token = new Whitespace(this.currentBuffer, this.createSpan());
    this.resetToStart();

    // Don't advance - let the next iteration handle this character
    this.position--;
    this.column--;

    return token;
  }

  private handleMultiCommentState(char: string): Token | null {
    this.currentBuffer += char;

    if (char === "*") {
      this.currentState = TokenState.IN_COMMENT_MULTI_STAR;
    }
    return null;
  }

  private handleMultiCommentStarState(char: string): Token | null {
    this.currentBuffer += char;

    if (char === "/") {
      // End of multi-line comment
      const token = new MultiLineComment(this.currentBuffer, this.createSpan());
      this.resetToStart();
      return token;
    }

    if (char === "*") {
      // Stay in star state
      return null;
    }

    // Back to regular comment state
    this.currentState = TokenState.IN_COMMENT_MULTI;
    return null;
  }

  private handleOperatorState(char: string): Token | null {
    const newBuffer = this.currentBuffer + char;

    // Check for comment start
    if (this.currentBuffer === "/" && char === "/") {
      this.currentState = TokenState.IN_COMMENT_SINGLE;
      this.currentBuffer = newBuffer; // Include both slashes
      return null;
    }

    if (this.currentBuffer === "/" && char === "*") {
      this.currentState = TokenState.IN_COMMENT_MULTI;
      this.currentBuffer = newBuffer; // Include /*
      return null;
    }

    // Check if this could be a longer operator
    const possibleOps = getPossibleMultiCharOperators(newBuffer);

    if (possibleOps.length > 0) {
      // Could be a longer operator - add the character and continue
      this.currentBuffer = newBuffer;

      // Check if we have an exact match
      if (possibleOps.includes(newBuffer)) {
        // We have a complete operator, but check if it could be longer
        const longerOps = possibleOps.filter((op) =>
          op.length > newBuffer.length
        );
        if (longerOps.length === 0) {
          // No longer operators possible - emit this one
          const token = this.createOperatorToken(newBuffer);
          this.resetToStart();
          return token;
        }
      }

      return null;
    }

    // Check if current buffer is a valid multi-char operator before breaking
    if (MULTI_CHAR_OPERATORS.has(this.currentBuffer)) {
      const token = this.createOperatorToken(this.currentBuffer);
      this.resetToStart();

      // Don't advance - handle current character next
      this.position--;
      this.column--;

      return token;
    }

    // No longer operator possible - emit current buffer as single operator
    const token = this.createOperatorToken(this.currentBuffer);
    this.resetToStart();

    // Don't advance - handle current character next
    this.position--;
    this.column--;

    return token;
  }

  private advance(): void {
    if (this.position < this.source.length) {
      if (this.source[this.position] === "\n") {
        this.line++;
        this.column = 0;
      } else {
        this.column++;
      }
      this.position++;
    }
  }

  private startNewToken(): void {
    this.tokenStartLocation = this.getCurrentLocation();
    this.currentBuffer = "";
  }

  private resetToStart(): void {
    this.currentState = TokenState.START;
    this.currentBuffer = "";
    this.tokenStartLocation = null;
    this.stringQuoteChar = "";
  }

  private getCurrentLocation(): SpanLocation {
    return new SpanLocation(this.line, this.column, this.position);
  }

  private createSpan(): Span {
    return new Span(this.tokenStartLocation!, this.getCurrentLocation());
  }

  private createIdentifierOrKeywordToken(): Token {
    const span = this.createSpan();

    // Check for boolean literals first
    if (this.currentBuffer === "true" || this.currentBuffer === "false") {
      return new BooleanLiteral(this.currentBuffer, span);
    }

    if (Object.hasOwn(KEYWORDS, this.currentBuffer)) {
      const KeywordClass =
        KEYWORDS[this.currentBuffer as keyof typeof KEYWORDS];
      return new KeywordClass(span);
    }

    return new Identifier(this.currentBuffer, span);
  }

  private createIntegerToken(): Token {
    return new IntegerLiteral(this.currentBuffer, this.createSpan());
  }

  private createFloatToken(): Token {
    return new FloatLiteral(this.currentBuffer, this.createSpan());
  }

  private createBigIntegerToken(): Token {
    // Remove the 'n' suffix
    return new BigIntegerLiteral(
      this.currentBuffer,
      this.createSpan(),
    );
  }

  private createBigDecimalToken(): Token {
    // Remove the 'n' suffix
    return new BigDecimalLiteral(
      this.currentBuffer,
      this.createSpan(),
    );
  }

  private createStringToken(): Token {
    return new StringLiteral(this.currentBuffer, this.createSpan());
  }

  private createSymbolToken(kind: SymbolKind, value: SymbolValue): Token {
    const span = new Span(this.getCurrentLocation(), this.getCurrentLocation());
    return new Symbol(kind, value, span);
  }

  private createOperatorToken(value: string): Token {
    const kind = this.getSymbolKind(value);
    return new Symbol(kind, value as SymbolValue, this.createSpan());
  }

  private getSymbolKind(symbolValue: string): SymbolKind {
    for (const [kind, value] of Object.entries(SYMBOLS)) {
      if (value === symbolValue) {
        return kind as SymbolKind;
      }
    }
    throw new Error(`Unknown symbol: ${symbolValue}`);
  }

  private finishCurrentToken(): Token | null {
    switch (this.currentState) {
      case TokenState.IN_IDENTIFIER:
        return this.createIdentifierOrKeywordToken();

      case TokenState.IN_NUMBER:
        return this.createIntegerToken();

      case TokenState.IN_FLOAT:
        return this.createFloatToken();

      case TokenState.IN_OPERATOR:
        return this.createOperatorToken(this.currentBuffer);

      case TokenState.IN_WHITESPACE:
        return new Whitespace(this.currentBuffer, this.createSpan());

      case TokenState.IN_COMMENT_SINGLE:
        return new Comment(this.currentBuffer, this.createSpan());

      case TokenState.IN_COMMENT_MULTI:
      case TokenState.IN_COMMENT_MULTI_STAR:
        return new MultiLineComment(this.currentBuffer, this.createSpan());

      default:
        return null;
    }
  }
}

// Main streaming tokenizer function
export function* tokenize(source: string): Generator<Token, void, unknown> {
  yield* new IncrementalTokenizer(source).tokenize();
}

// Utility functions
export function tokenizeToArray(source: string): Token[] {
  return Array.from(tokenize(source));
}
