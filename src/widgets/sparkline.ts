// [LAW:dataflow-not-control-flow] Sparkline rendering is a pure data
// transformation: numbers → bucketed values → block characters. The same
// pipeline runs for all inputs; empty data produces the minimum block.

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

export interface SparklineOptions {
  width?: number | null;
  minColor?: string;
  maxColor?: string;
}

function bucket(data: readonly number[], targetWidth: number): number[] {
  if (data.length === 0) {
    return Array.from({ length: targetWidth }, () => 0);
  }

  if (data.length <= targetWidth) {
    // Expand: repeat/distribute data points to fill width
    const result: number[] = [];

    for (let index = 0; index < targetWidth; index += 1) {
      const dataIndex = Math.floor((index * data.length) / targetWidth);
      result.push(data[dataIndex]);
    }

    return result;
  }

  // Aggregate: reduce data points using max per bucket
  const result: number[] = [];

  for (let index = 0; index < targetWidth; index += 1) {
    const start = Math.floor((index * data.length) / targetWidth);
    const end = Math.floor(((index + 1) * data.length) / targetWidth);
    let max = data[start];

    for (let inner = start + 1; inner < end; inner += 1) {
      max = Math.max(max, data[inner]);
    }

    result.push(max);
  }

  return result;
}

export function renderSparkline(data: readonly number[], width: number): string {
  const values = bucket(data, width);
  const min = values.reduce((current, value) => Math.min(current, value), Number.POSITIVE_INFINITY);
  const max = values.reduce((current, value) => Math.max(current, value), Number.NEGATIVE_INFINITY);
  const range = max - min;

  return values
    .map((value) => {
      const normalized = range === 0 ? 0 : (value - min) / range;
      const blockIndex = Math.min(BLOCKS.length - 1, Math.floor(normalized * (BLOCKS.length - 1) + 0.5));
      return BLOCKS[blockIndex];
    })
    .join("");
}

// [LAW:one-source-of-truth] The public `Sparkline` name is reserved for the
// React widget component; this render helper stays behind the model seam.
export class SparklineModel {
  readonly data: readonly number[];
  readonly width: number;

  constructor(data: readonly number[], options: SparklineOptions = {}) {
    this.data = data;
    this.width = options.width ?? data.length;
  }

  render(): string {
    return renderSparkline(this.data, Math.max(1, this.width));
  }
}
