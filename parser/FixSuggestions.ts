import { Token } from "../tokens/Token.ts";
import { Span } from "../tokens/Span.ts";
import { DiagnosticCode, DiagnosticFix } from "../diagnostics/mod.ts";
import { ParseError, ParserContext } from "./Parser.ts";

/**
 * Intelligent fix suggestion system for common error patterns
 * Provides context-aware suggestions for syntax errors
 */
export class FixSuggestionEngine {
  /**
   * Generate fix suggestions for missing delimiters
   */
  static suggestMissingDelimiter(
    context: ParserContext,
    expectedDelimiter: string,
    span: Span,
    openingDelimiter?: { token: Token; position: number },
  ): DiagnosticFix[] {
    const fixes: DiagnosticFix[] = [];
    const delimiterText = this.getDelimiterText(expectedDelimiter);

    if (openingDelimiter) {
      // We have an opening delimiter, suggest closing at current position
      const openingSymbol = openingDelimiter.token.kind === "Symbol"
        ? openingDelimiter.token.symbol
        : openingDelimiter.token.kind;
      fixes.push({
        kind: "insert",
        message: `Insert missing '${delimiterText}' to match '${
          this.getDelimiterText(openingSymbol)
        }' at line ${openingDelimiter.token.span?.start?.line || 1}`,
        span: span,
        replacement: delimiterText,
      });

      // Also suggest inserting at end of line if we're not there
      const currentToken = context.peek();
      if (currentToken && currentToken.kind !== "Newline") {
        const endOfLineSpan = this.findEndOfLine(context, span);
        if (endOfLineSpan) {
          fixes.push({
            kind: "insert",
            message: `Insert '${delimiterText}' at end of line`,
            span: endOfLineSpan,
            replacement: delimiterText,
          });
        }
      }
    } else {
      // No opening delimiter context, suggest insertion at current position
      fixes.push({
        kind: "insert",
        message: `Insert missing '${delimiterText}'`,
        span: span,
        replacement: delimiterText,
      });
    }

    return fixes;
  }

  /**
   * Generate fix suggestions for unmatched delimiters
   */
  static suggestUnmatchedDelimiter(
    context: ParserContext,
    unmatchedToken: Token,
    expectedDelimiter?: string,
  ): DiagnosticFix[] {
    const fixes: DiagnosticFix[] = [];
    const unmatchedSymbol = unmatchedToken.kind === "Symbol"
      ? unmatchedToken.symbol
      : unmatchedToken.kind;
    const unmatchedText = this.getDelimiterText(unmatchedSymbol);

    if (expectedDelimiter) {
      const expectedText = this.getDelimiterText(expectedDelimiter);

      // Suggest replacing the unmatched delimiter
      fixes.push({
        kind: "replace",
        message: `Replace '${unmatchedText}' with expected '${expectedText}'`,
        span: unmatchedToken.span,
        replacement: expectedText,
      });

      // Suggest inserting the expected delimiter before the unmatched one
      if (unmatchedToken.span) {
        fixes.push({
          kind: "insert",
          message: `Insert '${expectedText}' before '${unmatchedText}'`,
          span: new Span(unmatchedToken.span.start, unmatchedToken.span.start),
          replacement: expectedText,
        });
      }
    } else {
      // Find potential matching delimiter
      const matchingDelimiter = this.findMatchingDelimiter(
        unmatchedSymbol,
      );
      if (matchingDelimiter) {
        const matchingText = this.getDelimiterText(matchingDelimiter);

        // Look for the matching delimiter in recent context
        const matchingPosition = this.findRecentMatchingDelimiter(
          context,
          matchingDelimiter,
        );

        if (matchingPosition && matchingPosition.span) {
          fixes.push({
            kind: "insert",
            message: `Insert '${matchingText}' to match '${unmatchedText}'`,
            span: new Span(
              matchingPosition.span.start,
              matchingPosition.span.start,
            ),
            replacement: matchingText,
          });
        } else if (unmatchedToken.span) {
          fixes.push({
            kind: "insert",
            message: `Insert matching '${matchingText}' for '${unmatchedText}'`,
            span: new Span(
              unmatchedToken.span.start,
              unmatchedToken.span.start,
            ),
            replacement: matchingText,
          });
        }
      }

      // Suggest removing the unmatched delimiter
      fixes.push({
        kind: "delete",
        message: `Remove unmatched '${unmatchedText}'`,
        span: unmatchedToken.span,
        replacement: "",
      });
    }

    return fixes;
  }

  /**
   * Generate fix suggestions for invalid identifiers
   */
  static suggestValidIdentifier(
    context: ParserContext,
    invalidToken: Token,
    expectedContext?: string,
  ): DiagnosticFix[] {
    const fixes: DiagnosticFix[] = [];
    const tokenText = this.getTokenText(invalidToken);

    if (!tokenText) return fixes;

    // Common identifier fixes
    if (this.isKeyword(tokenText)) {
      // Suggest alternatives for keywords used as identifiers
      const alternatives = this.getKeywordAlternatives(tokenText);
      for (const alternative of alternatives) {
        fixes.push({
          kind: "replace",
          message: `Replace keyword '${tokenText}' with '${alternative}'`,
          span: invalidToken.span,
          replacement: alternative,
        });
      }

      // Suggest escaping the keyword
      fixes.push({
        kind: "replace",
        message: `Escape keyword '${tokenText}' with backticks`,
        span: invalidToken.span,
        replacement: `\`${tokenText}\``,
      });
    } else if (this.startsWithNumber(tokenText)) {
      // Suggest prefixing with underscore or letter
      fixes.push({
        kind: "replace",
        message:
          `Prefix identifier with underscore (identifiers cannot start with numbers)`,
        span: invalidToken.span,
        replacement: `_${tokenText}`,
      });

      fixes.push({
        kind: "replace",
        message: `Prefix identifier with letter`,
        span: invalidToken.span,
        replacement: `id${tokenText}`,
      });
    } else if (this.hasInvalidCharacters(tokenText)) {
      // Suggest fixing invalid characters
      const cleanedIdentifier = this.cleanIdentifier(tokenText);
      if (cleanedIdentifier !== tokenText) {
        fixes.push({
          kind: "replace",
          message: `Fix invalid characters in identifier`,
          span: invalidToken.span,
          replacement: cleanedIdentifier,
        });
      }
    }

    // Context-specific suggestions
    if (expectedContext) {
      const contextSuggestions = this.getContextSpecificSuggestions(
        tokenText,
        expectedContext,
      );
      for (const suggestion of contextSuggestions) {
        fixes.push({
          kind: "replace",
          message: `Use ${expectedContext}-appropriate name: '${suggestion}'`,
          span: invalidToken.span,
          replacement: suggestion,
        });
      }
    }

    return fixes;
  }

  /**
   * Generate fix suggestions for keywords used in wrong context
   */
  static suggestCorrectKeywordUsage(
    context: ParserContext,
    keyword: string,
    actualContext: string,
    expectedContext?: string,
  ): DiagnosticFix[] {
    const fixes: DiagnosticFix[] = [];

    // Get usage examples for the keyword
    const usageExample = this.getKeywordUsageExample(keyword);
    if (usageExample) {
      fixes.push({
        kind: "replace",
        message: `Correct usage: ${usageExample}`,
        span: context.span(),
        replacement: "", // Context-dependent, would need more specific implementation
      });
    }

    // Suggest alternative keywords for the current context
    const alternativeKeywords = this.getAlternativeKeywords(
      actualContext,
      expectedContext,
    );
    for (const alternative of alternativeKeywords) {
      fixes.push({
        kind: "replace",
        message:
          `Use '${alternative}' instead of '${keyword}' in ${actualContext}`,
        span: context.span(),
        replacement: alternative,
      });
    }

    return fixes;
  }

  /**
   * Create enhanced ParseError with intelligent fix suggestions
   */
  static createErrorWithFixes(
    code: DiagnosticCode,
    message: string,
    span: Span,
    context: ParserContext,
    errorType:
      | "missing-delimiter"
      | "unmatched-delimiter"
      | "invalid-identifier"
      | "wrong-keyword",
    errorData: {
      expectedDelimiter?: string;
      unmatchedToken?: Token;
      invalidToken?: Token;
      keyword?: string;
      actualContext?: string;
      expectedContext?: string;
      openingDelimiter?: { token: Token; position: number };
    },
  ): ParseError {
    let fixes: DiagnosticFix[] = [];

    switch (errorType) {
      case "missing-delimiter":
        fixes = this.suggestMissingDelimiter(
          context,
          errorData.expectedDelimiter!,
          span,
          errorData.openingDelimiter,
        );
        break;

      case "unmatched-delimiter":
        fixes = this.suggestUnmatchedDelimiter(
          context,
          errorData.unmatchedToken!,
          errorData.expectedDelimiter,
        );
        break;

      case "invalid-identifier":
        fixes = this.suggestValidIdentifier(
          context,
          errorData.invalidToken!,
          errorData.expectedContext,
        );
        break;

      case "wrong-keyword":
        fixes = this.suggestCorrectKeywordUsage(
          context,
          errorData.keyword!,
          errorData.actualContext!,
          errorData.expectedContext,
        );
        break;
    }

    return ParseError.error(code, message, span, fixes);
  }

  // Helper methods

  private static getDelimiterText(symbol: string): string {
    const delimiterMap: Record<string, string> = {
      "OpenParen": "(",
      "CloseParen": ")",
      "OpenBrace": "{",
      "CloseBrace": "}",
      "OpenBracket": "[",
      "CloseBracket": "]",
      "Semicolon": ";",
      "Comma": ",",
    };
    return delimiterMap[symbol] || symbol;
  }

  private static findMatchingDelimiter(symbol: string): string | null {
    const pairs: Record<string, string> = {
      "OpenParen": "CloseParen",
      "CloseParen": "OpenParen",
      "OpenBrace": "CloseBrace",
      "CloseBrace": "OpenBrace",
      "OpenBracket": "CloseBracket",
      "CloseBracket": "OpenBracket",
    };
    return pairs[symbol] || null;
  }

  private static findRecentMatchingDelimiter(
    context: ParserContext,
    matchingSymbol: string,
  ): Token | null {
    const currentPos = context.getPosition();

    // Look backwards for the matching delimiter
    for (let i = currentPos - 1; i >= Math.max(0, currentPos - 20); i--) {
      const token = context.tokens[i];
      if (token.kind === "Symbol" && token.symbol === matchingSymbol) {
        return token;
      }
    }

    return null;
  }

  private static findEndOfLine(
    context: ParserContext,
    currentSpan: Span,
  ): Span | null {
    const currentPos = context.getPosition();

    // Look forward for end of line
    for (let i = currentPos; i < context.tokens.length; i++) {
      const token = context.tokens[i];
      if (token.kind === "Newline") {
        return new Span(token.span.start, token.span.start);
      }
    }

    return null;
  }

  private static getTokenText(token: Token): string {
    if (token.kind === "Identifier") {
      return token.text;
    } else if (token.kind === "Symbol") {
      return this.getDelimiterText(token.symbol);
    }
    return token.kind;
  }

  private static isKeyword(text: string): boolean {
    const keywords = new Set([
      "fun",
      "let",
      "data",
      "interface",
      "type",
      "if",
      "else",
      "while",
      "for",
      "match",
      "return",
      "break",
      "continue",
      "true",
      "false",
      "null",
      "in",
      "of",
      "export",
      "import",
      "from",
      "as",
      "public",
      "private",
      "readonly",
    ]);
    return keywords.has(text);
  }

  private static getKeywordAlternatives(keyword: string): string[] {
    const alternatives: Record<string, string[]> = {
      "fun": ["func", "function", "fn"],
      "let": ["var", "const", "define"],
      "data": ["type", "struct", "class"],
      "if": ["when", "cond"],
      "while": ["loop", "repeat"],
      "for": ["each", "iterate"],
      "return": ["yield", "emit"],
      "true": ["yes", "on", "enabled"],
      "false": ["no", "off", "disabled"],
    };
    return alternatives[keyword] || [];
  }

  private static hasInvalidCharacters(text: string): boolean {
    // Check for characters that are not valid in identifiers
    return !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text);
  }

  private static cleanIdentifier(text: string): string {
    // Remove invalid characters and fix common issues
    return text
      .replace(/[^a-zA-Z0-9_]/g, "_") // Replace invalid chars with underscore
      .replace(/^[0-9]/, "_$&") // Prefix numbers with underscore
      .replace(/_+/g, "_") // Collapse multiple underscores
      .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores
  }

  private static startsWithNumber(text: string): boolean {
    return /^[0-9]/.test(text);
  }

  private static getContextSpecificSuggestions(
    text: string,
    context: string,
  ): string[] {
    if (!text || text.length === 0) return [];

    const suggestions: Record<string, string[]> = {
      "function": [
        `${text}Fn`,
        `handle${this.capitalize(text)}`,
        `process${this.capitalize(text)}`,
      ],
      "variable": [`${text}Value`, `${text}Data`, `my${this.capitalize(text)}`],
      "type": [
        `${this.capitalize(text)}Type`,
        `${this.capitalize(text)}Data`,
        `I${this.capitalize(text)}`,
      ],
      "parameter": [
        `${text}Param`,
        `input${this.capitalize(text)}`,
        `${text}Arg`,
      ],
    };
    return suggestions[context] || [];
  }

  private static capitalize(text: string): string {
    if (!text || text.length === 0) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private static getKeywordUsageExample(keyword: string): string | null {
    const examples: Record<string, string> = {
      "fun": "fun functionName(params) { ... }",
      "let": "let variableName = value",
      "data": "data TypeName = Constructor(fields)",
      "if": "if (condition) { ... }",
      "while": "while (condition) { ... }",
      "for": "for (item in collection) { ... }",
      "match": "match value { pattern => result }",
      "return": "return value",
    };
    return examples[keyword] || null;
  }

  private static getAlternativeKeywords(
    actualContext: string,
    expectedContext?: string,
  ): string[] {
    const contextKeywords: Record<string, string[]> = {
      "declaration": ["fun", "let", "data", "interface", "type"],
      "statement": ["if", "while", "for", "return", "break", "continue"],
      "expression": ["match", "if"],
      "control-flow": ["if", "while", "for", "match"],
    };

    if (expectedContext && contextKeywords[expectedContext]) {
      return contextKeywords[expectedContext];
    }

    return contextKeywords[actualContext] || [];
  }
}

/**
 * Enhanced error creation utilities with automatic fix suggestions
 */
export class EnhancedErrorFactory {
  /**
   * Create error for missing delimiter with intelligent fix suggestions
   */
  static missingDelimiter(
    context: ParserContext,
    expectedDelimiter: string,
    openingDelimiter?: { token: Token; position: number },
  ): ParseError {
    const delimiterText = FixSuggestionEngine["getDelimiterText"](
      expectedDelimiter,
    );
    const message = openingDelimiter
      ? `Missing '${delimiterText}' to match '${
        FixSuggestionEngine["getDelimiterText"](
          openingDelimiter.token.kind === "Symbol"
            ? openingDelimiter.token.symbol
            : openingDelimiter.token.kind,
        )
      }' at line ${openingDelimiter.token.span?.start?.line || 1}`
      : `Missing '${delimiterText}'`;

    return FixSuggestionEngine.createErrorWithFixes(
      DiagnosticCode.UNCLOSED_DELIMITER,
      message,
      context.span(),
      context,
      "missing-delimiter",
      { expectedDelimiter, openingDelimiter },
    );
  }

  /**
   * Create error for unmatched delimiter with intelligent fix suggestions
   */
  static unmatchedDelimiter(
    context: ParserContext,
    unmatchedToken: Token,
    expectedDelimiter?: string,
  ): ParseError {
    const unmatchedSymbol = unmatchedToken.kind === "Symbol"
      ? unmatchedToken.symbol
      : unmatchedToken.kind;
    const unmatchedText = FixSuggestionEngine["getDelimiterText"](
      unmatchedSymbol,
    );
    const message = expectedDelimiter
      ? `Unexpected '${unmatchedText}', expected '${
        FixSuggestionEngine["getDelimiterText"](expectedDelimiter)
      }'`
      : `Unmatched '${unmatchedText}'`;

    return FixSuggestionEngine.createErrorWithFixes(
      DiagnosticCode.UNEXPECTED_TOKEN,
      message,
      unmatchedToken.span,
      context,
      "unmatched-delimiter",
      { unmatchedToken, expectedDelimiter },
    );
  }

  /**
   * Create error for invalid identifier with intelligent fix suggestions
   */
  static invalidIdentifier(
    context: ParserContext,
    invalidToken: Token,
    expectedContext?: string,
  ): ParseError {
    const tokenText = FixSuggestionEngine["getTokenText"](invalidToken);
    const message = `Invalid identifier '${tokenText}'${
      expectedContext ? ` in ${expectedContext} context` : ""
    }`;

    return FixSuggestionEngine.createErrorWithFixes(
      DiagnosticCode.INVALID_SYNTAX,
      message,
      invalidToken.span,
      context,
      "invalid-identifier",
      { invalidToken, expectedContext },
    );
  }

  /**
   * Create error for keyword used in wrong context with intelligent fix suggestions
   */
  static wrongKeywordContext(
    context: ParserContext,
    keyword: string,
    actualContext: string,
    expectedContext?: string,
  ): ParseError {
    const message = `Keyword '${keyword}' cannot be used in ${actualContext}${
      expectedContext ? `, expected ${expectedContext}` : ""
    }`;

    return FixSuggestionEngine.createErrorWithFixes(
      DiagnosticCode.INVALID_SYNTAX,
      message,
      context.span(),
      context,
      "wrong-keyword",
      { keyword, actualContext, expectedContext },
    );
  }
}
