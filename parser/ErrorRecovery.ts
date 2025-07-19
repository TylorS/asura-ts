import { Token } from "../tokens/Token.ts";
import { DiagnosticCode, DiagnosticFix } from "../diagnostics/mod.ts";
import { ParseError, ParseFailure, ParserContext } from "./Parser.ts";
import { EnhancedErrorFactory } from "./FixSuggestions.ts";

// Core recovery strategy interfaces
export interface RecoveryStrategy {
  name: string;
  canRecover(context: ParserContext, failure: ParseFailure): boolean;
  recover(context: ParserContext, failure: ParseFailure): RecoveryResult;
}

export interface RecoveryResult {
  success: boolean;
  tokensSkipped: number;
  virtualTokensInserted: Token[];
  message: string;
}

// Built-in recovery strategies

/**
 * StatementBoundaryRecovery strategy for skipping to statement boundaries
 * Skips tokens until reaching a newline, semicolon, or block delimiter
 */
export class StatementBoundaryRecovery implements RecoveryStrategy {
  readonly name = "StatementBoundaryRecovery";

  canRecover(context: ParserContext, failure: ParseFailure): boolean {
    // Can recover if we're not at the end and there are tokens to skip
    return !context.isAtEnd() && context.getTokensRemaining() > 0;
  }

  recover(context: ParserContext, failure: ParseFailure): RecoveryResult {
    const startPosition = context.getPosition();
    let tokensSkipped = 0;

    // Skip tokens until we find a statement boundary
    while (!context.isAtEnd()) {
      const token = context.peek();

      // Statement boundaries: newlines, semicolons, or block delimiters
      if (
        token.kind === "Newline" ||
        (token.kind === "Symbol" && (
          token.symbol === "Semicolon" ||
          token.symbol === "OpenBrace" ||
          token.symbol === "CloseBrace"
        ))
      ) {
        break;
      }

      context.consume();
      tokensSkipped++;
    }

    const success = tokensSkipped > 0 || !context.isAtEnd();
    const message = success
      ? `Skipped ${tokensSkipped} tokens to statement boundary`
      : "Could not find statement boundary";

    return {
      success,
      tokensSkipped,
      virtualTokensInserted: [],
      message,
    };
  }
}

/**
 * DelimiterRecovery strategy for handling unmatched delimiters
 * Attempts to find matching delimiters or suggests insertion points
 */
export class DelimiterRecovery implements RecoveryStrategy {
  readonly name = "DelimiterRecovery";

  private readonly delimiterPairs = new Map([
    ["OpenParen", "CloseParen"],
    ["OpenBrace", "CloseBrace"],
    ["OpenBracket", "CloseBracket"],
  ]);

  private readonly closingDelimiters = new Set([
    "CloseParen",
    "CloseBrace",
    "CloseBracket",
  ]);

  canRecover(context: ParserContext, failure: ParseFailure): boolean {
    // Check if the failure involves delimiter-related errors
    return failure.errors.some((error) =>
      error.code === DiagnosticCode.UNCLOSED_DELIMITER ||
      error.code === DiagnosticCode.UNEXPECTED_TOKEN ||
      error.message.includes("delimiter") ||
      error.message.includes("parenthes") ||
      error.message.includes("brace") ||
      error.message.includes("bracket")
    );
  }

  recover(context: ParserContext, failure: ParseFailure): RecoveryResult {
    const startPosition = context.getPosition();
    let tokensSkipped = 0;
    const virtualTokensInserted: Token[] = [];

    // Look for unmatched opening delimiters in recent context
    const recentTokens = this.getRecentTokens(context, 10);
    const unmatchedOpeners = this.findUnmatchedOpeners(recentTokens);

    if (unmatchedOpeners.length > 0) {
      // Try to find matching closing delimiter
      const matchingCloser = this.findMatchingCloser(
        context,
        unmatchedOpeners[0],
      );

      if (matchingCloser) {
        // Skip to the matching closer
        while (
          !context.isAtEnd() && context.getPosition() < matchingCloser.position
        ) {
          context.consume();
          tokensSkipped++;
        }

        return {
          success: true,
          tokensSkipped,
          virtualTokensInserted,
          message:
            `Found matching delimiter at position ${matchingCloser.position}`,
        };
      } else {
        // Suggest inserting missing delimiter
        const opener = unmatchedOpeners[0];
        const expectedCloser = this.delimiterPairs.get(opener.symbol);

        if (expectedCloser) {
          // Use enhanced error factory for better fix suggestions
          const enhancedError = EnhancedErrorFactory.missingDelimiter(
            context,
            expectedCloser,
            { token: context.tokens[opener.position], position: opener.position },
          );

          // Record the enhanced error with intelligent fix suggestions
          context.addRecoveryError(enhancedError, this.name);

          return {
            success: true,
            tokensSkipped: 0,
            virtualTokensInserted,
            message: `Suggested insertion of missing '${
              this.getSymbolText(expectedCloser)
            }'`,
          };
        }
      }
    }

    // Fallback: skip to next delimiter or statement boundary
    while (!context.isAtEnd()) {
      const token = context.peek();

      if (
        token.kind === "Newline" ||
        (token.kind === "Symbol" && (
          this.closingDelimiters.has(token.symbol) ||
          token.symbol === "Semicolon" ||
          token.symbol === "Comma"
        ))
      ) {
        break;
      }

      context.consume();
      tokensSkipped++;
    }

    return {
      success: tokensSkipped > 0,
      tokensSkipped,
      virtualTokensInserted,
      message: `Skipped ${tokensSkipped} tokens to next delimiter`,
    };
  }

  private getRecentTokens(
    context: ParserContext,
    count: number,
  ): Array<{ token: Token; position: number }> {
    const currentPos = context.getPosition();
    const tokens: Array<{ token: Token; position: number }> = [];

    for (let i = Math.max(0, currentPos - count); i < currentPos; i++) {
      if (i < context.tokens.length) {
        tokens.push({ token: context.tokens[i], position: i });
      }
    }

    return tokens;
  }

  private findUnmatchedOpeners(
    tokens: Array<{ token: Token; position: number }>,
  ): Array<{ symbol: string; position: number }> {
    const stack: Array<{ symbol: string; position: number }> = [];
    const unmatched: Array<{ symbol: string; position: number }> = [];

    for (const { token, position } of tokens) {
      if (token.kind === "Symbol") {
        if (this.delimiterPairs.has(token.symbol)) {
          // Opening delimiter
          stack.push({ symbol: token.symbol, position });
        } else if (this.closingDelimiters.has(token.symbol)) {
          // Closing delimiter
          const expectedOpener = this.getMatchingOpener(token.symbol);
          if (
            stack.length > 0 &&
            stack[stack.length - 1].symbol === expectedOpener
          ) {
            stack.pop(); // Matched pair
          }
        }
      }
    }

    return stack; // Remaining items are unmatched openers
  }

  private findMatchingCloser(
    context: ParserContext,
    opener: { symbol: string; position: number },
  ): { position: number } | null {
    const expectedCloser = this.delimiterPairs.get(opener.symbol);
    if (!expectedCloser) return null;

    let depth = 1;
    const startPos = context.getPosition();

    for (let i = startPos; i < context.tokens.length; i++) {
      const token = context.tokens[i];
      if (token.kind === "Symbol") {
        if (token.symbol === opener.symbol) {
          depth++;
        } else if (token.symbol === expectedCloser) {
          depth--;
          if (depth === 0) {
            return { position: i };
          }
        }
      }
    }

    return null;
  }

  private getMatchingOpener(closer: string): string | null {
    for (const [opener, expectedCloser] of this.delimiterPairs) {
      if (expectedCloser === closer) {
        return opener;
      }
    }
    return null;
  }

  private getSymbolText(symbol: string): string {
    const symbolMap: Record<string, string> = {
      "OpenParen": "(",
      "CloseParen": ")",
      "OpenBrace": "{",
      "CloseBrace": "}",
      "OpenBracket": "[",
      "CloseBracket": "]",
    };
    return symbolMap[symbol] || symbol;
  }
}

/**
 * ExpressionRecovery strategy for skipping to expression boundaries
 * Skips tokens until reaching operators, commas, or other expression delimiters
 */
export class ExpressionRecovery implements RecoveryStrategy {
  readonly name = "ExpressionRecovery";

  private readonly expressionBoundaries = new Set([
    "Comma",
    "Semicolon",
    "CloseParen",
    "CloseBrace",
    "CloseBracket",
    "And",
    "Or",
    "Equal",
    "NotEqual",
    "LessThan",
    "GreaterThan",
    "LessThanOrEqual",
    "GreaterThanOrEqual",
    "Plus",
    "Minus",
    "Multiply",
    "Divide",
    "Assign",
    "Arrow",
  ]);

  canRecover(context: ParserContext, failure: ParseFailure): boolean {
    // Can recover if we're in an expression context and not at the end
    const currentContext = context.getCurrentContext();
    return !context.isAtEnd() && (
      currentContext?.name.includes("expression") ||
      currentContext?.name.includes("Expression") ||
      failure.errors.some((error) =>
        error.message.includes("expression") ||
        error.message.includes("operator") ||
        error.message.includes("operand")
      )
    );
  }

  recover(context: ParserContext, failure: ParseFailure): RecoveryResult {
    const startPosition = context.getPosition();
    let tokensSkipped = 0;

    // Skip tokens until we find an expression boundary
    while (!context.isAtEnd()) {
      const token = context.peek();

      // Expression boundaries: operators, delimiters, or statement boundaries
      if (
        token.kind === "Newline" ||
        (token.kind === "Symbol" && this.expressionBoundaries.has(token.symbol))
      ) {
        break;
      }

      // Also stop at keywords that typically end expressions
      if (this.isExpressionEndingKeyword(token)) {
        break;
      }

      context.consume();
      tokensSkipped++;
    }

    const success = tokensSkipped > 0 || !context.isAtEnd();
    const message = success
      ? `Skipped ${tokensSkipped} tokens to expression boundary`
      : "Could not find expression boundary";

    return {
      success,
      tokensSkipped,
      virtualTokensInserted: [],
      message,
    };
  }

  private isExpressionEndingKeyword(token: Token): boolean {
    return token.kind === "else" ||
      token.kind === "in" ||
      token.kind === "of";
  }
}

/**
 * KeywordRecovery strategy for handling misplaced keywords
 * Provides suggestions for correct keyword usage and context
 */
export class KeywordRecovery implements RecoveryStrategy {
  readonly name = "KeywordRecovery";

  private readonly keywordContexts = new Map([
    ["fun", ["declaration", "function"]],
    ["let", ["declaration", "variable"]],
    ["data", ["declaration", "type"]],
    ["interface", ["declaration", "type"]],
    ["type", ["declaration", "type"]],
    ["if", ["statement", "control-flow"]],
    ["while", ["statement", "control-flow"]],
    ["for", ["statement", "control-flow"]],
    ["match", ["expression", "pattern-matching"]],
    ["return", ["statement", "control-flow"]],
    ["break", ["statement", "control-flow"]],
    ["continue", ["statement", "control-flow"]],
  ]);

  private readonly keywordSuggestions = new Map([
    ["fun", "Use 'fun' to declare functions: fun name(params) { ... }"],
    ["let", "Use 'let' to declare variables: let name = value"],
    ["data", "Use 'data' to declare data types: data TypeName = ..."],
    ["if", "Use 'if' for conditional statements: if (condition) { ... }"],
    ["match", "Use 'match' for pattern matching: match value { ... }"],
  ]);

  canRecover(context: ParserContext, failure: ParseFailure): boolean {
    // Check if the failure involves keyword-related errors
    return failure.errors.some((error) =>
      error.actualToken?.kind && this.isKeyword(error.actualToken.kind) ||
      error.message.includes("keyword") ||
      error.message.includes("expected") &&
        error.expectedTokens?.some((expected) =>
          this.keywordContexts.has(expected)
        )
    );
  }

  recover(context: ParserContext, failure: ParseFailure): RecoveryResult {
    let tokensSkipped = 0;
    const virtualTokensInserted: Token[] = [];

    // Analyze the keyword error
    for (const error of failure.errors) {
      if (error.actualToken?.kind && this.isKeyword(error.actualToken.kind)) {
        const keyword = error.actualToken.kind;
        const currentContext = context.getCurrentContext();

        // Check if keyword is in wrong context
        const expectedContexts = this.keywordContexts.get(keyword);
        if (expectedContexts && currentContext) {
          const isInCorrectContext = expectedContexts.some((expected) =>
            currentContext.name.includes(expected)
          );

          if (!isInCorrectContext) {
            // Use enhanced error factory for better fix suggestions
            const enhancedError = EnhancedErrorFactory.wrongKeywordContext(
              context,
              keyword,
              currentContext.name,
              expectedContexts.join(" or "),
            );

            context.addRecoveryError(enhancedError, this.name);

            // Skip the problematic keyword
            if (!context.isAtEnd() && context.peek().kind === keyword) {
              context.consume();
              tokensSkipped++;
            }
          }
        }
      }
    }

    // If no specific keyword handling, skip to next safe point
    if (tokensSkipped === 0) {
      while (!context.isAtEnd()) {
        const token = context.peek();

        // Stop at statement boundaries or other keywords
        if (
          token.kind === "Newline" ||
          (token.kind === "Symbol" && (
            token.symbol === "Semicolon" ||
            token.symbol === "OpenBrace" ||
            token.symbol === "CloseBrace"
          )) ||
          this.isDeclarationKeyword(token.kind)
        ) {
          break;
        }

        context.consume();
        tokensSkipped++;
      }
    }

    return {
      success: tokensSkipped > 0,
      tokensSkipped,
      virtualTokensInserted,
      message: `Recovered from keyword error, skipped ${tokensSkipped} tokens`,
    };
  }

  private isKeyword(kind: string): boolean {
    return this.keywordContexts.has(kind);
  }

  private isDeclarationKeyword(kind: string): boolean {
    return ["fun", "let", "data", "interface", "type", "export"].includes(kind);
  }
}
