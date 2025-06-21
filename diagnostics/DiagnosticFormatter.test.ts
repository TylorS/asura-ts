import { describe, it, expect, beforeEach } from 'vitest';
import { 
  DiagnosticFormatter, 
  formatDiagnostic, 
  formatDiagnostics, 
} from './DiagnosticFormatter.ts';
import { 
  Diagnostic, 
  DiagnosticSeverity, 
  DiagnosticCode 
} from './Diagnostic.ts';
import { Span, SpanLocation } from '../tokens/Span.ts';

// Helper function to create test spans
function createSpan(
  startLine: number, 
  startCol: number, 
  endLine: number, 
  endCol: number
): Span {
  return new Span(
    new SpanLocation(startLine, startCol, startLine * 100 + startCol),
    new SpanLocation(endLine, endCol, endLine * 100 + endCol)
  );
}

// Sample source code for testing
const sampleSource = `let x = 42;
let y = "hello world"
function add(a, b) {
  return a + b;
}

let result = add(x, y);`;

describe('DiagnosticFormatter', () => {
  let formatter: DiagnosticFormatter;

  beforeEach(() => {
    formatter = new DiagnosticFormatter();
    formatter.setSource('test.asura', sampleSource);
  });

  it('should format a basic error diagnostic', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.UNEXPECTED_TOKEN,
      'Unexpected token "{"',
      createSpan(0, 8, 0, 10), // Points to "42" in first line
      'test.asura'
    );

    const formatted = formatter.format(diagnostic);

    expect(formatted).toMatchInlineSnapshot(`
      "✗ ERROR[P001]: Unexpected token "{"
        --> test.asura:1:9
       > 1 | let x = 42;
                     ^^
         2 | let y = "hello world"
      "
    `);
  });

  it('should format a warning with fix suggestion', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.WARNING,
      DiagnosticCode.MISSING_SEMICOLON,
      'Missing semicolon',
      createSpan(1, 19, 1, 19), // End of second line
      'test.asura'
    ).withFix('Add semicolon', ';');

    const formatted = formatter.format(diagnostic);

    expect(formatted).toMatchInlineSnapshot(`
      "⚠ WARNING[P003]: Missing semicolon
        --> test.asura:2:20
         1 | let x = 42;
       > 2 | let y = "hello world"
                                ^
         3 | function add(a, b) {

        help: Add semicolon
              Replace with: ";"
      "
    `);
  });

  it('should format an error with multiple fixes', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.TYPE_MISMATCH,
      'Type mismatch: expected Int, found String',
      createSpan(6, 19, 6, 20), // Points to "y" in last line: "let result = add(x, y);"
      'test.asura'
    )
    .withFix('Cast to Int', 'parseInt(y)')
    .withFix('Change parameter type', ': String');

    const formatted = formatter.format(diagnostic);

        expect(formatted).toMatchInlineSnapshot(`
          "✗ ERROR[S002]: Type mismatch: expected Int, found String
            --> test.asura:7:20
             6 | 
           > 7 | let result = add(x, y);
                                    ^

            help: Cast to Int
                  Replace with: "parseInt(y)"
            help: Change parameter type
                  Replace with: ": String"
          "
        `);
  });

  it('should format a diagnostic with related information', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.UNDEFINED_IDENTIFIER,
      'Undefined variable "z"',
      createSpan(6, 19, 6, 20), // Points to "y" in last line, pretending it's "z"
      'test.asura'
    )
    .withRelatedInfo(
      'Variable "x" declared here',
      createSpan(0, 4, 0, 5),
      'test.asura'
    )
    .withRelatedInfo(
      'Variable "y" declared here', 
      createSpan(1, 4, 1, 5),
      'test.asura'
    );

    const formatted = formatter.format(diagnostic);

        expect(formatted).toMatchInlineSnapshot(`
          "✗ ERROR[S001]: Undefined variable "z"
            --> test.asura:7:20
             6 | 
           > 7 | let result = add(x, y);
                                    ^

            note: Variable "x" declared here
                  --> test.asura:1:5
            note: Variable "y" declared here
                  --> test.asura:2:5
          "
        `);
  });

  it('should format diagnostic spanning multiple lines', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.UNCLOSED_DELIMITER,
      'Unclosed function body',
      createSpan(2, 20, 4, 1), // From opening brace to closing brace
      'test.asura'
    );

    const formatted = formatter.format(diagnostic);

    expect(formatted).toMatchInlineSnapshot(`
      "✗ ERROR[P004]: Unclosed function body
        --> test.asura:3:21
         2 | let y = "hello world"
       > 3 | function add(a, b) {
                                 ^
       > 4 |   return a + b;
             ^^^^^^^^^^^^^^^
       > 5 | }
             ^
         6 | 
      "
    `);
  });

  it('should format without source code when option is disabled', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.INFO,
      DiagnosticCode.RECOVERED_AT,
      'Parser recovered here',
      createSpan(2, 0, 2, 8),
      'test.asura'
    );

    const formatted = formatter.format(diagnostic, { showSourceCode: false });

    expect(formatted).toMatchInlineSnapshot(`
      "ℹ INFO[P102]: Parser recovered here
        --> test.asura:3:1
      "
    `);
  });

  it('should format with custom context lines', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.WARNING,
      DiagnosticCode.SKIPPED_TOKENS,
      'Skipped malformed tokens',
      createSpan(2, 9, 2, 12), // "add" in function declaration
      'test.asura'
    );

    const formatted = formatter.format(diagnostic, { maxContextLines: 1 });

    expect(formatted).toMatchInlineSnapshot(`
      "⚠ WARNING[P100]: Skipped malformed tokens
        --> test.asura:3:10
       > 3 | function add(a, b) {
                      ^^^
      "
    `);
  });

  it('should format with fixes disabled', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.EXPECTED_TOKEN,
      'Expected ";" after statement',
      createSpan(1, 21, 1, 21),
      'test.asura'
    )
    .withFix('Insert semicolon', ';')
    .withFix('Remove newline', '');

    const formatted = formatter.format(diagnostic, { showFixes: false });

    expect(formatted).toMatchInlineSnapshot(`
      "✗ ERROR[P002]: Expected ";" after statement
        --> test.asura:2:22
         1 | let x = 42;
       > 2 | let y = "hello world"
                                  ^
         3 | function add(a, b) {
      "
    `);
  });

  it('should handle diagnostic at beginning of file', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.UNEXPECTED_TOKEN,
      'Unexpected keyword "let"',
      createSpan(0, 0, 0, 3),
      'test.asura'
    );

    const formatted = formatter.format(diagnostic);

    expect(formatted).toMatchInlineSnapshot(`
      "✗ ERROR[P001]: Unexpected keyword "let"
        --> test.asura:1:1
       > 1 | let x = 42;
             ^^^
         2 | let y = "hello world"
      "
    `);
  });

  it('should handle diagnostic at end of file', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.WARNING,
      DiagnosticCode.MISSING_SEMICOLON,
      'Missing semicolon at end of file',
      createSpan(6, 22, 6, 23), // Points to end of last line "let result = add(x, y);"
      'test.asura'
    );

    const formatted = formatter.format(diagnostic);

    expect(formatted).toMatchInlineSnapshot(`
      "⚠ WARNING[P003]: Missing semicolon at end of file
        --> test.asura:7:23
         6 | 
       > 7 | let result = add(x, y);
                                   ^
      "
    `);
  });

  it('should format multiple diagnostics', () => {
    const diagnostics = [
      new Diagnostic(
        DiagnosticSeverity.ERROR,
        DiagnosticCode.UNEXPECTED_TOKEN,
        'Unexpected token',
        createSpan(0, 8, 0, 10),
        'main.asura'
      ),
      new Diagnostic(
        DiagnosticSeverity.WARNING,
        DiagnosticCode.MISSING_SEMICOLON,
        'Missing semicolon',
        createSpan(1, 21, 1, 21),
        'main.asura'
      ).withFix('Add semicolon', ';')
    ];

    const formatted = formatDiagnostics(diagnostics, sampleSource);

    expect(formatted).toMatchInlineSnapshot(`
      "✗ ERROR[P001]: Unexpected token
        --> main.asura:1:9
       > 1 | let x = 42;
                     ^^
         2 | let y = "hello world"


      ⚠ WARNING[P003]: Missing semicolon
        --> main.asura:2:22
         1 | let x = 42;
       > 2 | let y = "hello world"
                                  ^
         3 | function add(a, b) {

        help: Add semicolon
              Replace with: ";"
      "
    `);
  });

  it('should show all diagnostic severity symbols', () => {
    const diagnostics = [
      new Diagnostic(DiagnosticSeverity.ERROR, DiagnosticCode.INVALID_SYNTAX, 'Error message', createSpan(0, 0, 0, 1), 'test.asura'),
      new Diagnostic(DiagnosticSeverity.WARNING, DiagnosticCode.SKIPPED_TOKENS, 'Warning message', createSpan(0, 0, 0, 1), 'test.asura'),
      new Diagnostic(DiagnosticSeverity.INFO, DiagnosticCode.RECOVERED_AT, 'Info message', createSpan(0, 0, 0, 1), 'test.asura'),
      new Diagnostic(DiagnosticSeverity.HINT, DiagnosticCode.RECOVERED_AT, 'Hint message', createSpan(0, 0, 0, 1), 'test.asura')
    ];

    const severitySymbols = diagnostics.map(d => {
      const formatted = formatter.format(d, { showSourceCode: false });
      return formatted.split(' ')[0]; // Extract just the symbol
    });

    expect(severitySymbols).toMatchInlineSnapshot(`
      [
        "✗",
        "⚠",
        "ℹ",
        "💡",
      ]
    `);
  });
});

describe('Convenience Functions', () => {
  it('should format single diagnostic with convenience function', () => {
    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.INVALID_SYNTAX,
      'Invalid syntax detected',
      createSpan(2, 13, 2, 14),
      'convenience.asura'
    );

    const formatted = formatDiagnostic(diagnostic, sampleSource);

    expect(formatted).toMatchInlineSnapshot(`
      "✗ ERROR[P005]: Invalid syntax detected
        --> convenience.asura:3:14
         2 | let y = "hello world"
       > 3 | function add(a, b) {
                          ^
         4 |   return a + b;
      "
    `);
  });

  it('should format multiple diagnostics with convenience function', () => {
    const diagnostics = [
      new Diagnostic(
        DiagnosticSeverity.WARNING,
        DiagnosticCode.SKIPPED_TOKENS,
        'First warning',
        createSpan(0, 0, 0, 3),
        'batch.asura'
      ),
      new Diagnostic(
        DiagnosticSeverity.ERROR,
        DiagnosticCode.PREMATURE_EOF,
        'Unexpected end of input',
        createSpan(6, 22, 6, 23), // Points to end of last line "let result = add(x, y);"
        'batch.asura'
      )
    ];

    const formatted = formatDiagnostics(diagnostics, sampleSource);

    expect(formatted).toMatchInlineSnapshot(`
      "⚠ WARNING[P100]: First warning
        --> batch.asura:1:1
       > 1 | let x = 42;
             ^^^
         2 | let y = "hello world"


      ✗ ERROR[P006]: Unexpected end of input
        --> batch.asura:7:23
         6 | 
       > 7 | let result = add(x, y);
                                   ^
      "
    `);
  });
});

describe('DiagnosticFormatter - Edge Cases', () => {
  it('should handle diagnostic without source code', () => {
    const formatter = new DiagnosticFormatter();
    // Note: not setting source code

    const diagnostic = new Diagnostic(
      DiagnosticSeverity.ERROR,
      DiagnosticCode.INVALID_SYNTAX,
      'Parse error without source',
      createSpan(1, 5, 1, 10),
      'missing.asura'
    );

    const formatted = formatter.format(diagnostic);

    expect(formatted).toMatchInlineSnapshot(`
      "✗ ERROR[P005]: Parse error without source
        --> missing.asura:2:6
      "
    `);
  });

  it('should handle zero-width spans', () => {
    const formatter = new DiagnosticFormatter();
    formatter.setSource('zero.asura', 'let x = 42;');

    const diagnostic = new Diagnostic(
      DiagnosticSeverity.WARNING,
      DiagnosticCode.INSERTED_TOKEN,
      'Inserted missing token',
      createSpan(0, 7, 0, 7), // Zero-width span
      'zero.asura'
    );

    const formatted = formatter.format(diagnostic);

    expect(formatted).toMatchInlineSnapshot(`
      "⚠ WARNING[P101]: Inserted missing token
        --> zero.asura:1:8
       > 1 | let x = 42;
                    ^
      "
    `);
  });
});

describe('DiagnosticFormatter - Parser Integration Scenarios', () => {
  it('should format parser recovery scenarios', () => {
    const formatter = new DiagnosticFormatter();
    const brokenCode = `let x = 42
let y = "hello"
function broken(a, b {
  return unknown_var;
}`;
    formatter.setSource('broken.asura', brokenCode);

    const recoveryDiagnostics = [
      new Diagnostic(
        DiagnosticSeverity.WARNING,
        DiagnosticCode.MISSING_SEMICOLON,
        'Missing semicolon',
        createSpan(0, 10, 0, 10),
        'broken.asura'
      ).withFix('Add semicolon', ';'),
      
      new Diagnostic(
        DiagnosticSeverity.ERROR,
        DiagnosticCode.UNCLOSED_DELIMITER,
        'Missing closing parenthesis',
        createSpan(2, 18, 2, 19),
        'broken.asura'
      ).withFix('Add closing parenthesis', ')'),
      
      new Diagnostic(
        DiagnosticSeverity.ERROR,
        DiagnosticCode.UNDEFINED_IDENTIFIER,
        'Undefined variable "unknown_var"',
        createSpan(3, 9, 3, 20),
        'broken.asura'
      ).withRelatedInfo(
        'Consider declaring the variable first',
        createSpan(0, 0, 0, 3),
        'broken.asura'
      ),
      
      new Diagnostic(
        DiagnosticSeverity.INFO,
        DiagnosticCode.RECOVERED_AT,
        'Parser recovered after error',
        createSpan(4, 0, 4, 1),
        'broken.asura'
      )
    ];

    const formatted = formatter.formatMany(recoveryDiagnostics);

    expect(formatted).toMatchInlineSnapshot(`
      "⚠ WARNING[P003]: Missing semicolon
        --> broken.asura:1:11
       > 1 | let x = 42
                       ^
         2 | let y = "hello"

        help: Add semicolon
              Replace with: ";"


      ✗ ERROR[P004]: Missing closing parenthesis
        --> broken.asura:3:19
         2 | let y = "hello"
       > 3 | function broken(a, b {
                               ^
         4 |   return unknown_var;

        help: Add closing parenthesis
              Replace with: ")"


      ✗ ERROR[S001]: Undefined variable "unknown_var"
        --> broken.asura:4:10
         3 | function broken(a, b {
       > 4 |   return unknown_var;
                      ^^^^^^^^^^^
         5 | }

        note: Consider declaring the variable first
              --> broken.asura:1:1


      ℹ INFO[P102]: Parser recovered after error
        --> broken.asura:5:1
         4 |   return unknown_var;
       > 5 | }
             ^
      "
    `);
  });
}); 