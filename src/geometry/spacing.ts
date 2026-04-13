/**
 * Spacing — immutable top/right/bottom/left insets (padding, margin, gutter).
 */

export class Spacing {
  constructor(
    readonly top: number,
    readonly right: number,
    readonly bottom: number,
    readonly left: number,
  ) {}

  get totalWidth(): number {
    return this.left + this.right;
  }

  get totalHeight(): number {
    return this.top + this.bottom;
  }

  get isZero(): boolean {
    return this.top === 0 && this.right === 0 && this.bottom === 0 && this.left === 0;
  }

  add(other: Spacing): Spacing {
    return new Spacing(
      this.top + other.top,
      this.right + other.right,
      this.bottom + other.bottom,
      this.left + other.left,
    );
  }

  max(other: Spacing): Spacing {
    return new Spacing(
      Math.max(this.top, other.top),
      Math.max(this.right, other.right),
      Math.max(this.bottom, other.bottom),
      Math.max(this.left, other.left),
    );
  }

  equals(other: Spacing): boolean {
    return (
      this.top === other.top &&
      this.right === other.right &&
      this.bottom === other.bottom &&
      this.left === other.left
    );
  }

  static readonly ZERO = new Spacing(0, 0, 0, 0);

  static all(value: number): Spacing {
    return new Spacing(value, value, value, value);
  }

  static symmetric(vertical: number, horizontal: number): Spacing {
    return new Spacing(vertical, horizontal, vertical, horizontal);
  }
}
