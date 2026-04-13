/**
 * Offset — immutable x, y coordinate pair.
 */

export class Offset {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  add(other: Offset): Offset {
    return new Offset(this.x + other.x, this.y + other.y);
  }

  subtract(other: Offset): Offset {
    return new Offset(this.x - other.x, this.y - other.y);
  }

  negate(): Offset {
    return new Offset(-this.x, -this.y);
  }

  equals(other: Offset): boolean {
    return this.x === other.x && this.y === other.y;
  }

  static readonly ZERO = new Offset(0, 0);
}
