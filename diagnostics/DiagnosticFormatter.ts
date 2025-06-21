import { Diagnostic, DiagnosticSeverity } from "./Diagnostic.ts";

export interface FormatOptions {
  showSourceCode?: boolean;
  maxContextLines?: number;
  colorize?: boolean;
  showFixes?: boolean;
}

const DEFAULT_OPTIONS: FormatOptions = {
  showSourceCode: true,
  maxContextLines: 3,
  colorize: false,
  showFixes: true,
};

export class DiagnosticFormatter {
  private sourceLines: Map<string, string[]> = new Map();

  setSource(fileName: string, source: string): void {
    this.sourceLines.set(fileName, source.split('\n'));
  }

  format(diagnostic: Diagnostic, options: FormatOptions = {}): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let output = '';

    // Header with severity, code, and message
    const severitySymbol = this.getSeveritySymbol(diagnostic.severity);
    const severityText = diagnostic.severity.toUpperCase();
    
    output += `${severitySymbol} ${severityText}[${diagnostic.code}]: ${diagnostic.message}\n`;
    
    // Location information
    const location = diagnostic.span.start;
    output += `  --> ${diagnostic.fileName}:${location.line + 1}:${location.column + 1}\n`;

    // Source code context
    if (opts.showSourceCode) {
      const sourceContext = this.getSourceContext(diagnostic, opts.maxContextLines!);
      if (sourceContext) {
        output += sourceContext;
      }
    }

    // Fix suggestions
    if (opts.showFixes && diagnostic.fixes.length > 0) {
      output += '\n';
      for (const fix of diagnostic.fixes) {
        output += `  help: ${fix.message}\n`;
        if (opts.showSourceCode) {
          output += `        Replace with: "${fix.replacement}"\n`;
        }
      }
    }

    // Related information
    if (diagnostic.relatedInformation.length > 0) {
      output += '\n';
      for (const info of diagnostic.relatedInformation) {
        const infoLocation = info.span.start;
        output += `  note: ${info.message}\n`;
        output += `        --> ${info.fileName}:${infoLocation.line + 1}:${infoLocation.column + 1}\n`;
      }
    }

    return output;
  }

  formatMany(diagnostics: ReadonlyArray<Diagnostic>, options: FormatOptions = {}): string {
    return diagnostics.map(d => this.format(d, options)).join('\n\n');
  }

  private getSeveritySymbol(severity: DiagnosticSeverity): string {
    switch (severity) {
      case DiagnosticSeverity.ERROR:
        return '✗';
      case DiagnosticSeverity.WARNING:
        return '⚠';
      case DiagnosticSeverity.INFO:
        return 'ℹ';
      case DiagnosticSeverity.HINT:
        return '💡';
      default:
        return '•';
    }
  }

  private getSourceContext(diagnostic: Diagnostic, maxLines: number): string | null {
    const sourceLines = this.sourceLines.get(diagnostic.fileName);
    if (!sourceLines) {
      return null;
    }

    const startLine = diagnostic.span.start.line;
    const endLine = diagnostic.span.end.line;
    
    const contextStart = Math.max(0, startLine - Math.floor(maxLines / 2));
    const contextEnd = Math.min(sourceLines.length - 1, endLine + Math.floor(maxLines / 2));

    let output = '';
    const lineNumberWidth = String(contextEnd + 1).length;

    for (let i = contextStart; i <= contextEnd; i++) {
      const lineNum = String(i + 1).padStart(lineNumberWidth, ' ');
      const isErrorLine = i >= startLine && i <= endLine;
      const prefix = isErrorLine ? ' >' : '  ';
      
      output += `${prefix} ${lineNum} | ${sourceLines[i]}\n`;
      
      // Add underline for error spans
      if (isErrorLine) {
        const startCol = i === startLine ? diagnostic.span.start.column : 0;
        const endCol = i === endLine ? diagnostic.span.end.column : sourceLines[i].length;
        
        const spaces = ' '.repeat(lineNumberWidth + 3 + startCol);
        const underline = '^'.repeat(Math.max(1, endCol - startCol));
        
        output += `   ${spaces}${underline}\n`;
      }
    }

    return output;
  }
}

// Convenience function for quick formatting
export function formatDiagnostic(
  diagnostic: Diagnostic,
  source?: string,
  options?: FormatOptions
): string {
  const formatter = new DiagnosticFormatter();
  if (source) {
    formatter.setSource(diagnostic.fileName, source);
  }
  return formatter.format(diagnostic, options);
}

export function formatDiagnostics(
  diagnostics: ReadonlyArray<Diagnostic>,
  source?: string,
  options?: FormatOptions
): string {
  const formatter = new DiagnosticFormatter();
  if (source && diagnostics.length > 0) {
    formatter.setSource(diagnostics[0].fileName, source);
  }
  return formatter.formatMany(diagnostics, options);
} 