/**
 * Size — immutable width × height pair in character cells.
 */

import { Offset } from "./offset.js";
import { Region } from "./region.js";

export class Size {
  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  get area(): number {
    return this.width * this.height;
  }

  get region(): Region {
    return new Region(0, 0, this.width, this.height);
  }

  get lineRange(): number[] {
    return Array.from({ length: this.height }, (_, index) => index);
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  containsPoint(offset: Offset): boolean {
    return this.contains(offset.x, offset.y);
  }

  add(other: Size): Size {
    return new Size(this.width + other.width, this.height + other.height);
  }

  subtract(other: Size): Size {
    return new Size(this.width - other.width, this.height - other.height);
  }

  withWidth(width: number): Size {
    return new Size(width, this.height);
  }

  withHeight(height: number): Size {
    return new Size(this.width, height);
  }

  clampOffset(offset: Offset): Offset {
    return offset.clamp(this.width, this.height);
  }

  equals(other: Size): boolean {
    return this.width === other.width && this.height === other.height;
  }

  static readonly ZERO = new Size(0, 0);
}
