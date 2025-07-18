import { describe, expect, it } from "vitest";
import { DiagnosticCollection, DiagnosticCode } from "../diagnostics/mod.ts";
import { Span, SpanLocation } from "../tokens/Span.ts";
import { Token } from "../tokens/Token.ts";
import {
  ParseError,
  ParseFailure,
  ParseSuccess,
  ParserContext,
  recoverableSeq,
  recoverableSequence,
  token,
} from "./Parser.ts";

// Helper function to create a simple token
function createToken(
  kind: Token["kind"],
  text: string = "",
  line: number = 1,
  column: number = 1,
): Token {
  const span = new Span(
    new SpanLocation(line, column, 0),
    new SpanLocation(line, column + text.length, text.length),
  );

  if (kind === "Identifier") {
    return { kind, text, span } as Token;
  }

  return { kind, span } as Token;
}

// Helper function to create a parser context
function createContext(tokens: Token[]): ParserContext {
  const diagnostics = new DiagnosticCollection();
  return new ParserContext("test.ts", tokens, diagnostics);
}

describe("recoverableSequence combinator (without whitespace handling)", () => {
  describe("Basic functionality", () => {
    it("should parse all elements successfully when all parsers succeed", () => {
      const tokens = [
        createToken("Identifier", "hello"),
        createToken("Identifier", "world"),
        createToken("Identifier", "test"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSequence(
        token("Identifier"),
        token("Identifier"),
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toEqual(tokens[1]);
        expect(result.value[2]).toEqual(tokens[2]);
      }
    });

    it("should mark failed elements as null and continue parsing", () => {
      const tokens = [
        createToken("Identifier", "hello"),
        createToken("Whitespace", " "), // This will fail when expecting Identifier
        createToken("Identifier", "world"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSequence(
        token("Identifier"),
        token("Identifier"), // This will fail on Whitespace
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull(); // Failed element
        expect(result.value[2]).toEqual(tokens[2]);
      }
    });

    it("should not skip whitespace automatically", () => {
      const tokens = [
        createToken("Identifier", "first"),
        createToken("Whitespace", " "),
        createToken("Identifier", "second"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSequence(
        token("Identifier"),
        token("Identifier"), // Will fail on Whitespace
        token("Identifier"), // Will succeed on "second"
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull(); // Failed on Whitespace
        expect(result.value[2]).toEqual(tokens[2]); // Succeeded on "second"
      }
    });
  });

  describe("Recovery behavior", () => {
    it("should handle consecutive failures without whitespace interference", () => {
      const tokens = [
        createToken("Identifier", "success"),
        createToken("Whitespace", " "),
        createToken("Newline", "\n"),
        createToken("Identifier", "success2"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSequence(
        token("Identifier"),
        token("Identifier"), // Will fail on Whitespace
        token("Identifier"), // Will fail on Newline
        token("Identifier"), // Will succeed on "success2"
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull();
        expect(result.value[2]).toBeNull();
        expect(result.value[3]).toEqual(tokens[3]);
      }
    });
  });
});

describe("recoverableSeq combinator (with whitespace handling)", () => {
  describe("Basic functionality", () => {
    it("should parse all elements successfully when all parsers succeed", () => {
      const tokens = [
        createToken("Identifier", "hello"),
        createToken("Identifier", "world"),
        createToken("Identifier", "test"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"),
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toEqual(tokens[1]);
        expect(result.value[2]).toEqual(tokens[2]);
      }
    });

    it("should mark failed elements as null and continue parsing", () => {
      const tokens = [
        createToken("Identifier", "hello"),
        createToken("Number", "123"), // This will cause second parser to fail (Number is not whitespace)
        createToken("Identifier", "world"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // This will fail on Number token
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull(); // Failed element
        expect(result.value[2]).toEqual(tokens[2]);
      }
    });

    it("should collect all errors from failed parsers", () => {
      const tokens = [
        createToken("Identifier", "hello"),
        createToken("Whitespace", " "),
        createToken("Newline", "\n"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail
        token("Identifier"), // Will also fail
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull();
        expect(result.value[2]).toBeNull();
      }

      // Check that errors were recorded in diagnostics
      const diagnostics = context.diagnostics.getAll();
      expect(diagnostics.length).toBeGreaterThan(0);
      
      // Should have recovery errors for failed elements
      const recoveryErrors = diagnostics.filter(d => 
        d.code === DiagnosticCode.RECOVERED_ERROR
      );
      expect(recoveryErrors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Position tracking", () => {
    it("should maintain accurate position tracking for error reporting", () => {
      const tokens = [
        createToken("Identifier", "first", 1, 1),
        createToken("Whitespace", " ", 1, 6),
        createToken("Identifier", "third", 1, 7),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail at position 1 (Whitespace)
        token("Identifier"),
      );

      const startPosition = context.getPosition();
      const result = parser.parse(context);

      expect(result.type).toBe("success");
      
      // Check that position tracking is accurate in error messages
      const diagnostics = context.diagnostics.getAll();
      const parseErrors = diagnostics.filter(d => 
        d.code === DiagnosticCode.UNEXPECTED_TOKEN
      );
      
      if (parseErrors.length > 0) {
        // The error should be at the position of the Whitespace token
        expect(parseErrors[0].span.start.column).toBe(6);
      }
    });

    it("should reset position correctly after failed parsers", () => {
      const tokens = [
        createToken("Identifier", "first"),
        createToken("Number", "123"), // This will cause second parser to fail
        createToken("Identifier", "third"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail on Number and reset position
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull();
        expect(result.value[2]).toEqual(tokens[2]);
      }

      // Final position should be after the last successfully parsed token
      expect(context.getPosition()).toBe(3);
    });
  });

  describe("Recovery behavior", () => {
    it("should add recovery information for each failed element", () => {
      const tokens = [
        createToken("Identifier", "success"),
        createToken("Number", "123"), // This will cause second parser to fail
        createToken("Identifier", "success2"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail on Number
        token("Identifier"),
      );

      parser.parse(context);

      const recoveryHistory = context.getRecoveryHistory();
      expect(recoveryHistory.length).toBeGreaterThan(0);
      
      const recoverableSeqEvents = recoveryHistory.filter(event => 
        event.strategy === "RecoverableSequence"
      );
      expect(recoverableSeqEvents.length).toBe(1);
      expect(recoverableSeqEvents[0].message).toContain("Element 1 failed");
    });

    it("should handle multiple consecutive failures", () => {
      const tokens = [
        createToken("Identifier", "success"),
        createToken("Number", "123"), // This will cause second parser to fail
        createToken("Number", "456"), // This will cause third parser to fail
        createToken("Identifier", "success2"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail on first Number
        token("Identifier"), // Will fail on second Number
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull();
        expect(result.value[2]).toBeNull();
        expect(result.value[3]).toEqual(tokens[3]);
      }

      const recoveryHistory = context.getRecoveryHistory();
      const recoverableSeqEvents = recoveryHistory.filter(event => 
        event.strategy === "RecoverableSequence"
      );
      expect(recoverableSeqEvents.length).toBe(2); // Two failed elements
    });
  });

  describe("Edge cases", () => {
    it("should handle empty parser list", () => {
      const tokens: Token[] = [];
      const context = createContext(tokens);

      const parser = recoverableSeq();

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(0);
      }
    });

    it("should handle all parsers failing", () => {
      const tokens = [
        createToken("Whitespace", " "),
        createToken("Newline", "\n"),
        createToken("Whitespace", " "),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"), // Will fail
        token("Identifier"), // Will fail
        token("Identifier"), // Will fail
      );

      const result = parser.parse(context);

      expect(result.type).toBe("failure");
      if (result.type === "failure") {
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Should have the final sequence error
        const sequenceErrors = result.errors.filter(error => 
          error.message.includes("All elements failed in recoverable sequence")
        );
        expect(sequenceErrors.length).toBe(1);
      }
    });

    it("should handle end of input during parsing", () => {
      const tokens = [
        createToken("Identifier", "only"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail due to EOF
        token("Identifier"), // Will also fail due to EOF
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull();
        expect(result.value[2]).toBeNull();
      }
    });

    it("should handle single parser in sequence", () => {
      const tokens = [
        createToken("Identifier", "single"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(token("Identifier"));

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual(tokens[0]);
      }
    });

    it("should handle single failing parser in sequence", () => {
      const tokens = [
        createToken("Whitespace", " "),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(token("Identifier"));

      const result = parser.parse(context);

      expect(result.type).toBe("failure");
      if (result.type === "failure") {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Whitespace handling", () => {
    it("should skip whitespace between successful elements", () => {
      const tokens = [
        createToken("Identifier", "first"),
        createToken("Whitespace", " "),
        createToken("Identifier", "second"),
        createToken("Newline", "\n"),
        createToken("Identifier", "third"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"),
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toEqual(tokens[2]);
        expect(result.value[2]).toEqual(tokens[4]);
      }
    });

    it("should skip whitespace after failed elements", () => {
      const tokens = [
        createToken("Identifier", "first"),
        createToken("Number", "123"), // This will cause second parser to fail
        createToken("Whitespace", " "),
        createToken("Identifier", "third"),
      ];
      const context = createContext(tokens);

      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail on Number
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        expect(result.value[0]).toEqual(tokens[0]);
        expect(result.value[1]).toBeNull();
        expect(result.value[2]).toEqual(tokens[3]);
      }
    });
  });

  describe("Type safety", () => {
    it("should maintain correct types for mixed parser results", () => {
      const tokens = [
        createToken("Identifier", "hello"),
        createToken("IntegerLiteral", "42"), // This will cause second parser to fail
        createToken("Identifier", "world"),
      ];
      const context = createContext(tokens);

      // Mix different token types to test type preservation
      const parser = recoverableSeq(
        token("Identifier"),
        token("Identifier"), // Will fail on Newline
        token("Identifier"),
      );

      const result = parser.parse(context);

      expect(result.type).toBe("success");
      if (result.type === "success") {
        // TypeScript should infer the correct tuple type
        const [first, second, third] = result.value;
        
        expect(first?.kind).toBe("Identifier");
        expect(second).toBeNull();
        expect(third?.kind).toBe("Identifier");
      }
    });
  });
});