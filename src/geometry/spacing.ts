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

  get width(): number {
    return this.totalWidth;
  }

  get height(): number {
    return this.totalHeight;
  }

  get maxWidth(): number {
    return Math.max(this.left, this.right);
  }

  get maxHeight(): number {
    return Math.max(this.top, this.bottom);
  }

  get topLeft(): [number, number] {
    return [this.left, this.top];
  }

  get bottomRight(): [number, number] {
    return [this.right, this.bottom];
  }

  get totals(): [number, number] {
    return [this.width, this.height];
  }

  get css(): string {
    if (this.top === this.right && this.top === this.bottom && this.top === this.left) {
      return `${this.top}`;
    }

    if (this.top === this.bottom && this.right === this.left) {
      return `${this.top} ${this.right}`;
    }

    return `${this.top} ${this.right} ${this.bottom} ${this.left}`;
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

  subtract(other: Spacing): Spacing {
    return new Spacing(
      this.top - other.top,
      this.right - other.right,
      this.bottom - other.bottom,
      this.left - other.left,
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

  growMaximum(other: Spacing): Spacing {
    return this.max(other);
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

  static vertical(value: number): Spacing {
    return new Spacing(value, 0, value, 0);
  }

  static horizontal(value: number): Spacing {
    return new Spacing(0, value, 0, value);
  }

  static unpack(value: number | [number] | [number, number] | [number, number, number, number]): Spacing {
    if (typeof value === "number") {
      return Spacing.all(value);
    }

    if (value.length === 1) {
      return Spacing.all(value[0]);
    }

    if (value.length === 2) {
      return Spacing.symmetric(value[0], value[1]);
    }

    if (value.length === 4) {
      return new Spacing(value[0], value[1], value[2], value[3]);
    }

    throw new Error("Spacing.unpack requires 1, 2, or 4 values");
  }
}
