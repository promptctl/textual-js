/**
 * Region — immutable rectangle in character-cell space.
 *
 * Used for widget placements, clipping, dirty tracking, and hit testing.
 */

import { Offset } from "./offset.js";
import { Size } from "./size.js";
import { Spacing } from "./spacing.js";

export class Region {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly width: number,
    readonly height: number,
  ) {}

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get offset(): Offset {
    return new Offset(this.x, this.y);
  }

  get size(): Size {
    return new Size(this.width, this.height);
  }

  get area(): number {
    return this.width * this.height;
  }

  get isEmpty(): boolean {
    return this.width <= 0 || this.height <= 0;
  }

  contains(x: number, y: number): boolean {
    return x >= this.x && x < this.right && y >= this.y && y < this.bottom;
  }

  containsRegion(other: Region): boolean {
    return (
      other.x >= this.x &&
      other.y >= this.y &&
      other.right <= this.right &&
      other.bottom <= this.bottom
    );
  }

  overlaps(other: Region): boolean {
    return (
      this.x < other.right &&
      other.x < this.right &&
      this.y < other.bottom &&
      other.y < this.bottom
    );
  }

  intersection(other: Region): Region {
    const x = Math.max(this.x, other.x);
    const y = Math.max(this.y, other.y);
    const right = Math.min(this.right, other.right);
    const bottom = Math.min(this.bottom, other.bottom);
    return new Region(x, y, Math.max(0, right - x), Math.max(0, bottom - y));
  }

  union(other: Region): Region {
    const x = Math.min(this.x, other.x);
    const y = Math.min(this.y, other.y);
    const right = Math.max(this.right, other.right);
    const bottom = Math.max(this.bottom, other.bottom);
    return new Region(x, y, right - x, bottom - y);
  }

  translate(dx: number, dy: number): Region {
    return new Region(this.x + dx, this.y + dy, this.width, this.height);
  }

  translateOffset(offset: Offset): Region {
    return this.translate(offset.x, offset.y);
  }

  /**
   * Shrink the region inward by the given spacing (padding/border).
   */
  shrink(spacing: Spacing): Region {
    return new Region(
      this.x + spacing.left,
      this.y + spacing.top,
      Math.max(0, this.width - spacing.totalWidth),
      Math.max(0, this.height - spacing.totalHeight),
    );
  }

  /**
   * Grow the region outward by the given spacing (margin).
   */
  grow(spacing: Spacing): Region {
    return new Region(
      this.x - spacing.left,
      this.y - spacing.top,
      this.width + spacing.totalWidth,
      this.height + spacing.totalHeight,
    );
  }

  withSize(size: Size): Region {
    return new Region(this.x, this.y, size.width, size.height);
  }

  equals(other: Region): boolean {
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.width === other.width &&
      this.height === other.height
    );
  }

  static fromSize(size: Size): Region {
    return new Region(0, 0, size.width, size.height);
  }

  static readonly EMPTY = new Region(0, 0, 0, 0);
}
