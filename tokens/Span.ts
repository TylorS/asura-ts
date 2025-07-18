export class Span {
  constructor(
    public readonly start: SpanLocation,
    public readonly end: SpanLocation,
  ) {}
}

export class SpanLocation {
  constructor(
    readonly line: number,
    readonly column: number,
    readonly character: number,
  ) {}

  toString(): string {
    return `${this.line}:${this.column}`;
  }
}
