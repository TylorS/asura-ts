import { Span } from "../../../tokens/Span.ts";

export class ExportKeyword {
  readonly kind = "ExportKeyword";
  constructor(readonly span: Span) {}
}