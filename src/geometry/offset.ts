/**
 * Offset — immutable x, y coordinate pair.
 */

import { clamp } from "./clamp.js";

export class Offset {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}

  get isOrigin(): boolean {
    return this.x === 0 && this.y === 0;
  }

  get transpose(): [number, number] {
    return [this.y, this.x];
  }

  get clamped(): Offset {
    return new Offset(Math.max(0, this.x), Math.max(0, this.y));
  }

  add(other: Offset): Offset {
    return new Offset(this.x + other.x, this.y + other.y);
  }

  subtract(other: Offset): Offset {
    return new Offset(this.x - other.x, this.y - other.y);
  }

  negate(): Offset {
    return new Offset(-this.x, -this.y);
  }

  multiply(value: number): Offset {
    return new Offset(this.x * value, this.y * value);
  }

  blend(destination: Offset, factor: number): Offset {
    return new Offset(
      Math.round(this.x + (destination.x - this.x) * factor),
      Math.round(this.y + (destination.y - this.y) * factor),
    );
  }

  getDistanceTo(other: Offset): number {
    return Math.hypot(other.x - this.x, other.y - this.y);
  }

  clamp(width: number, height: number): Offset {
    return new Offset(
      clamp(this.x, 0, Math.max(0, width - 1)),
      clamp(this.y, 0, Math.max(0, height - 1)),
    );
  }

  equals(other: Offset): boolean {
    return this.x === other.x && this.y === other.y;
  }

  static readonly ZERO = new Offset(0, 0);
}
