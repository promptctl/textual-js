import { Segment } from "rich-js";

export class Strip {
  private cachedCellLength: number | null = null;

  constructor(private readonly segments: readonly Segment[]) {}

  get text(): string {
    return this.segments.map((segment) => segment.text).join("");
  }

  get cellLength(): number {
    if (this.cachedCellLength === null) {
      this.cachedCellLength = Segment.getLineLength([...this.segments]);
    }

    return this.cachedCellLength;
  }

  toSegments(): Segment[] {
    return [...this.segments];
  }

  adjustCellLength(target: number): Strip {
    return new Strip(Segment.adjustLineLength([...this.segments], target));
  }

  crop(start: number, end: number): Strip {
    if (end <= start) {
      return new Strip([]);
    }

    if (start <= 0) {
      const [head] = Segment.divide([...this.segments], [end]);
      return new Strip(head ?? []);
    }

    const [, middle] = Segment.divide([...this.segments], [start, end]);
    return new Strip(middle ?? []);
  }

  simplify(): Strip {
    return new Strip([...Segment.simplify(this.segments)]);
  }

  static join(strips: readonly Strip[]): Strip {
    return new Strip(strips.flatMap((strip) => strip.toSegments()));
  }
}
