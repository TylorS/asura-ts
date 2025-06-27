import type { Token } from "../tokens/Token.ts";
import * as AST from "../ast/mod.ts";

// --- ParseResult ---

export interface ParseError {
  message: string;
  position: number;
}

export interface ParseResult<T> {
  success: boolean;
  value?: T;
  errors: ParseError[];
  consumed: number;
  recovered?: boolean;
}

// --- TokenStream ---

export class TokenStream {
  private position = 0;
  constructor(private tokens: Token[]) {}

  peek(offset = 0): Token | null {
    const idx = this.position + offset;
    return idx < this.tokens.length ? this.tokens[idx] : null;
  }

  consume(): Token | null {
    if (this.position < this.tokens.length) {
      return this.tokens[this.position++];
    }
    return null;
  }

  mark(): number {
    return this.position;
  }

  restore(pos: number) {
    this.position = pos;
  }

  hasMore(): boolean {
    return this.position < this.tokens.length;
  }
}

// --- Parser interface ---

export interface Parser<T> {
  parse(tokens: TokenStream): ParseResult<T>;
  canParse?(tokens: TokenStream): boolean;
}

// --- Combinators ---

export function seq<A, B>(a: Parser<A>, b: Parser<B>): Parser<[A, B]> {
  return {
    parse(tokens) {
      const start = tokens.mark();
      const ra = a.parse(tokens);
      if (!ra.success) return { ...ra, consumed: tokens.mark() - start };
      const rb = b.parse(tokens);
      if (!rb.success) {
        tokens.restore(start);
        return { ...rb, consumed: 0 };
      }
      return {
        success: true,
        value: [ra.value!, rb.value!] as [A, B],
        errors: [...ra.errors, ...rb.errors],
        consumed: tokens.mark() - start,
      };
    }
  };
}

export function alt<A, B>(a: Parser<A>, b: Parser<B>): Parser<A | B> {
  return {
    parse(tokens) {
      const start = tokens.mark();
      const ra = a.parse(tokens);
      if (ra.success) return ra;
      tokens.restore(start);
      const rb = b.parse(tokens);
      if (rb.success) return rb;
      return {
        success: false,
        errors: [...ra.errors, ...rb.errors],
        consumed: 0,
      };
    }
  };
}

export function many<A>(p: Parser<A>): Parser<A[]> {
  return {
    parse(tokens) {
      const results: A[] = [];
      const errors: ParseError[] = [];
      const start = tokens.mark();
      while (true) {
        const r = p.parse(tokens);
        if (!r.success) break;
        results.push(r.value!);
        errors.push(...r.errors);
      }
      return {
        success: true,
        value: results,
        errors,
        consumed: tokens.mark() - start,
      };
    }
  };
}

// --- Error Recovery (Panic Mode) ---

export function recoverUntil(sync: (t: Token | null) => boolean): Parser<null> {
  return {
    parse(tokens) {
      const errors: ParseError[] = [];
      let consumed = 0;
      while (tokens.hasMore() && !sync(tokens.peek())) {
        tokens.consume();
        consumed++;
      }
      errors.push({
        message: "Error recovery: skipped tokens until sync point.",
        position: tokens.mark(),
      });
      return { success: true, value: null, errors, consumed, recovered: true };
    }
  };
}

// --- Example: Identifier or Literal Expression Parser ---

export const identifierParser: Parser<AST.Identifier> = {
  parse(tokens) {
    const t = tokens.peek();
    if (t && t.kind === "Identifier") {
      tokens.consume();
      return { success: true, value: new AST.Identifier(t.text, t.span), errors: [], consumed: 1 };
    }
    return {
      success: false,
      errors: [{ message: "Expected identifier", position: tokens.mark() }],
      consumed: 0,
    };
  }
};

export const literalParser: Parser<AST.Literal> = {
  parse(tokens) {
    const t = tokens.peek();
    if (t && t.kind === "IntegerLiteral") {
      tokens.consume();
      return { success: true, value: new AST.IntegerLiteral(Number(t.text), t.span), errors: [], consumed: 1 };
    }
    if (t && t.kind === "FloatLiteral") {
      tokens.consume();
      return { success: true, value: new AST.FloatLiteral(Number(t.text), t.span), errors: [], consumed: 1 };
    }
    if (t && t.kind === "StringLiteral") {
      tokens.consume();
      return { success: true, value: new AST.StringLiteral(t.text, t.span), errors: [], consumed: 1 };
    }
    if (t && t.kind === "BooleanLiteral") {
      tokens.consume();
      return { success: true, value: new AST.BooleanLiteral(t.text === "true", t.span), errors: [], consumed: 1 };
    }
    return {
      success: false,
      errors: [{ message: "Expected literal", position: tokens.mark() }],
      consumed: 0,
    };
  }
};

// --- Example: Expression Parser (Identifier | Literal) ---

export const expressionParser: Parser<AST.Expression> = alt(identifierParser, literalParser);

// --- Usage Example ---
// const stream = new TokenStream(tokens);
// const result = expressionParser.parse(stream);
