// [LAW:dataflow-not-control-flow] Sparkline rendering is a pure data
// transformation: numbers → bucketed values → block characters. The same
// pipeline runs for all inputs; empty data and single-point data take the
// same render path with substituted glyphs/colors.

const BARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const FULL_BLOCK = "█";
const MIN_BAR = "▁";

export type SummaryFunction = (values: readonly number[]) => number;

export const summaryMax: SummaryFunction = (values) =>
  values.reduce((current, value) => Math.max(current, value));
export const summaryMin: SummaryFunction = (values) =>
  values.reduce((current, value) => Math.min(current, value));

export interface SparklineOptions {
  width?: number | null;
  height?: number;
  summary?: SummaryFunction;
}

export interface SparklineRenderOptions {
  width: number;
  height?: number;
  summary?: SummaryFunction;
}

export interface SparklineCell {
  char: string;
  ratio: number;
  filled: boolean;
}

function partitionBuckets(data: readonly number[], numBuckets: number): number[][] {
  // [LAW:one-source-of-truth] Bucket boundaries mirror Python Textual's
  // `Sparkline._buckets`: int(step * i) for exact integer arithmetic. Empty
  // partitions are dropped, leaving fewer-than-width buckets for expansion.
  const buckets: number[][] = [];
  const length = data.length;

  for (let index = 0; index < numBuckets; index += 1) {
    const start = Math.floor((length * index) / numBuckets);
    const end = Math.floor((length * (index + 1)) / numBuckets);
    if (end > start) {
      buckets.push(data.slice(start, end));
    }
  }

  return buckets;
}

export function renderSparklineGrid(
  data: readonly number[],
  options: SparklineRenderOptions,
): SparklineCell[][] {
  const width = Math.max(1, Math.trunc(options.width));
  const height = Math.max(1, options.height ?? 1);
  const summary = options.summary ?? summaryMax;
  const length = data.length;

  if (length === 0) {
    const rows: SparklineCell[][] = [];
    for (let row = 0; row < height - 1; row += 1) {
      rows.push(Array.from({ length: width }, () => ({ char: " ", ratio: 0, filled: false })));
    }
    rows.push(Array.from({ length: width }, () => ({ char: MIN_BAR, ratio: 0, filled: true })));
    return rows;
  }

  if (length === 1) {
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ char: FULL_BLOCK, ratio: 1, filled: true })),
    );
  }

  const barLineSegments = BARS.length;
  const barSegments = barLineSegments * height - 1;

  let minimum = data[0];
  let maximum = data[0];
  for (let i = 1; i < length; i += 1) {
    minimum = Math.min(minimum, data[i]);
    maximum = Math.max(maximum, data[i]);
  }
  const extent = maximum - minimum || 1;

  const buckets = partitionBuckets(data, width);
  const step = buckets.length / width;

  const heightRatios: number[] = [];
  const barIndices: number[] = [];
  let bucketIndex = 0;
  for (let i = 0; i < width; i += 1) {
    const partition = buckets[Math.min(buckets.length - 1, Math.trunc(bucketIndex))];
    const partitionSummary = summary(partition);
    const heightRatio = (partitionSummary - minimum) / extent;
    heightRatios.push(heightRatio);
    barIndices.push(Math.trunc(heightRatio * barSegments));
    bucketIndex += step;
  }

  const rows: SparklineCell[][] = [];
  // Python iterates `reversed(range(height))` — top stack row first.
  for (let row = height - 1; row >= 0; row -= 1) {
    const low = row * barLineSegments;
    const high = (row + 1) * barLineSegments;
    const cells: SparklineCell[] = [];
    for (let cell = 0; cell < width; cell += 1) {
      const barIndex = barIndices[cell];
      const ratio = heightRatios[cell];
      if (barIndex < low) {
        cells.push({ char: " ", ratio, filled: false });
      } else if (barIndex >= high) {
        cells.push({ char: FULL_BLOCK, ratio, filled: true });
      } else {
        cells.push({ char: BARS[barIndex % barLineSegments], ratio, filled: true });
      }
    }
    rows.push(cells);
  }

  return rows;
}

export function renderSparklineRows(
  data: readonly number[],
  options: SparklineRenderOptions,
): string[] {
  return renderSparklineGrid(data, options).map((row) => row.map((cell) => cell.char).join(""));
}

export function renderSparkline(data: readonly number[], width: number): string {
  return renderSparklineRows(data, { width, height: 1 })[0];
}

// [LAW:one-source-of-truth] The public `Sparkline` name is reserved for the
// React widget component; this state holder stays behind the model seam.
export class SparklineModel {
  readonly data: readonly number[];
  readonly width: number;
  readonly height: number;
  readonly summary: SummaryFunction;

  constructor(data: readonly number[], options: SparklineOptions = {}) {
    this.data = data;
    this.width = options.width ?? data.length;
    this.height = options.height ?? 1;
    this.summary = options.summary ?? summaryMax;
  }

  render(): string {
    return renderSparklineRows(this.data, {
      width: Math.max(1, this.width),
      height: this.height,
      summary: this.summary,
    }).join("\n");
  }
}
