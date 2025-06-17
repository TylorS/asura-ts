import { Span } from "../../Span.ts";

export class ExportKeyword {
  readonly kind = "ExportKeyword";
  constructor(readonly span: Span) {}
}