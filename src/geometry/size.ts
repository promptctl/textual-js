/**
 * Size — immutable width × height pair in character cells.
 */

export class Size {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  get area(): number {
    return this.width * this.height;
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  withWidth(width: number): Size {
    return new Size(width, this.height);
  }

  withHeight(height: number): Size {
    return new Size(this.width, height);
  }

  equals(other: Size): boolean {
    return this.width === other.width && this.height === other.height;
  }

  static readonly ZERO = new Size(0, 0);
}
