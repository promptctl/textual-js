import { Offset } from "../geometry/offset.js";

// [LAW:one-source-of-truth] The public widget catalog should not expose this
// text-range helper as a widget named `Selection`.
export class SelectionModel {
  readonly start: Offset | null;
  readonly end: Offset | null;

  constructor(start: Offset | null = null, end: Offset | null = null) {
    this.start = start;
    this.end = end;
  }

  get isEmpty(): boolean {
    return this.start !== null && this.end !== null && this.start.equals(this.end);
  }

  // [LAW:dataflow-not-control-flow] extract always runs the same slicing
  // pipeline; null boundaries resolve to document extremes as data.
  extract(text: string): string {
    const lines = text.split("\n");
    const startRow = this.start?.y ?? 0;
    const startCol = this.start?.x ?? 0;
    const endRow = this.end?.y ?? lines.length - 1;
    const endCol = this.end?.x ?? (lines[endRow]?.length ?? 0);

    const normalizedStartRow = Math.min(startRow, endRow);
    const normalizedEndRow = Math.max(startRow, endRow);
    const normalizedStartCol =
      normalizedStartRow === startRow ? (startRow === endRow ? Math.min(startCol, endCol) : startCol) : endCol;
    const normalizedEndCol =
      normalizedEndRow === endRow ? (startRow === endRow ? Math.max(startCol, endCol) : endCol) : startCol;

    if (normalizedStartRow === normalizedEndRow) {
      const line = lines[normalizedStartRow] ?? "";
      return line.slice(normalizedStartCol, normalizedEndCol);
    }

    const result: string[] = [];
    result.push((lines[normalizedStartRow] ?? "").slice(normalizedStartCol));

    for (let row = normalizedStartRow + 1; row < normalizedEndRow; row += 1) {
      result.push(lines[row] ?? "");
    }

    result.push((lines[normalizedEndRow] ?? "").slice(0, normalizedEndCol));
    return result.join("\n");
  }
}
