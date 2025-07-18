import { SourceFile } from "../ast/mod.ts";
import { DiagnosticCollection } from "../diagnostics/Diagnostic.ts";
import { formatDiagnostics } from "../diagnostics/mod.ts";
import { tokenizeToArray } from "../tokens/Tokenizer.ts";
import { ParserContext } from "./Parser.ts";
import { sourceFile } from "./parsers/SourceFile.ts";

export function parse(params: {
  fileName: string;
  source: string;
  diagnostics?: DiagnosticCollection;
}): SourceFile {
  const diagnostics = params.diagnostics ?? new DiagnosticCollection();
  const ctx = new ParserContext(
    params.fileName,
    tokenizeToArray(params.source),
    diagnostics,
  );
  const result = sourceFile(params.fileName).parse(ctx);
  if (result.type === "success") {
    return result.value;
  }

  throw new Error(
    `Failed to parse source file ${params.fileName}: ${
      formatDiagnostics(diagnostics.getAll(), params.source, {
        colorize: true,
        showSourceCode: true,
        showFixes: true,
      })
    }`,
  );
}
