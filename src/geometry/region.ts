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
    readonly x: number = 0,
    readonly y: number = 0,
    readonly width: number = 0,
    readonly height: number = 0,
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

  get columnSpan(): [number, number] {
    return [this.x, this.right];
  }

  get lineSpan(): [number, number] {
    return [this.y, this.bottom];
  }

  get columnRange(): number[] {
    return Array.from({ length: this.width }, (_, index) => this.x + index);
  }

  get lineRange(): number[] {
    return Array.from({ length: this.height }, (_, index) => this.y + index);
  }

  get topRight(): Offset {
    return new Offset(this.right, this.y);
  }

  get bottomLeft(): Offset {
    return new Offset(this.x, this.bottom);
  }

  get bottomRight(): Offset {
    return new Offset(this.right, this.bottom);
  }

  get bottomRightInclusive(): Offset {
    return new Offset(this.right - 1, this.bottom - 1);
  }

  get resetOffset(): Region {
    return new Region(0, 0, this.width, this.height);
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

  atOffset(offset: Offset): Region {
    return new Region(offset.x, offset.y, this.width, this.height);
  }

  clip(maxWidth: number, maxHeight: number): Region {
    return new Region(
      this.x,
      this.y,
      Math.max(0, Math.min(this.width, maxWidth - this.x)),
      Math.max(0, Math.min(this.height, maxHeight - this.y)),
    );
  }

  cropSize(size: Size): Region {
    return new Region(
      this.x,
      this.y,
      Math.min(this.width, size.width),
      Math.min(this.height, size.height),
    );
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

  /**
   * Compute the minimum scroll offset needed to bring `target` into view
   * within this region (the viewport/window).
   */
  getScrollToVisible(target: Region): Offset {
    // [LAW:dataflow-not-control-flow] Both axes always compute; the Offset
    // carries zero on axes that are already visible.
    const dx =
      target.x < this.x
        ? target.x - this.x
        : target.right > this.right
          ? target.right - this.right
          : 0;
    const dy =
      target.y < this.y
        ? target.y - this.y
        : target.bottom > this.bottom
          ? target.bottom - this.bottom
          : 0;

    return new Offset(dx, dy);
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

  static fromOffset(offset: Offset, size: Size): Region {
    return new Region(offset.x, offset.y, size.width, size.height);
  }

  static fromUnion(regions: Region[]): Region {
    const [first, ...rest] = regions;

    if (first === undefined) {
      throw new Error("Region.fromUnion requires at least one region");
    }

    return rest.reduce((current, region) => current.union(region), first);
  }

  static readonly EMPTY = new Region(0, 0, 0, 0);
}
