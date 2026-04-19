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

  containsPoint(point: Offset | [number, number]): boolean {
    const [x, y] = point instanceof Offset ? [point.x, point.y] : point;
    return this.contains(x, y);
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

  translate(dx: number | Offset | [number, number], dy?: number): Region {
    const [offsetX, offsetY] =
      dx instanceof Offset
        ? [dx.x, dx.y]
        : Array.isArray(dx)
          ? dx
          : [dx, dy ?? 0];
    return new Region(this.x + offsetX, this.y + offsetY, this.width, this.height);
  }

  translateOffset(offset: Offset): Region {
    return this.translate(offset.x, offset.y);
  }

  atOffset(offset: Offset | [number, number]): Region {
    const [x, y] = offset instanceof Offset ? [offset.x, offset.y] : offset;
    return new Region(x, y, this.width, this.height);
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

  getSpacingBetween(region: Region): Spacing {
    return new Spacing(
      region.y - this.y,
      this.right - region.right,
      this.bottom - region.bottom,
      region.x - this.x,
    );
  }

  expand(amount: Offset | [number, number]): Region {
    const [expandX, expandY] = amount instanceof Offset ? [amount.x, amount.y] : amount;
    return new Region(
      this.x - expandX,
      this.y - expandY,
      this.width + expandX * 2,
      this.height + expandY * 2,
    );
  }

  split(cutX: number, cutY: number): [Region, Region, Region, Region] {
    const normalizedCutX = cutX < 0 ? this.width + cutX : cutX;
    const normalizedCutY = cutY < 0 ? this.height + cutY : cutY;

    return [
      new Region(this.x, this.y, normalizedCutX, normalizedCutY),
      new Region(this.x + normalizedCutX, this.y, this.width - normalizedCutX, normalizedCutY),
      new Region(this.x, this.y + normalizedCutY, normalizedCutX, this.height - normalizedCutY),
      new Region(
        this.x + normalizedCutX,
        this.y + normalizedCutY,
        this.width - normalizedCutX,
        this.height - normalizedCutY,
      ),
    ];
  }

  splitVertical(cut: number): [Region, Region] {
    const normalizedCut = cut < 0 ? this.width + cut : cut;
    return [
      new Region(this.x, this.y, normalizedCut, this.height),
      new Region(this.x + normalizedCut, this.y, this.width - normalizedCut, this.height),
    ];
  }

  splitHorizontal(cut: number): [Region, Region] {
    const normalizedCut = cut < 0 ? this.height + cut : cut;
    return [
      new Region(this.x, this.y, this.width, normalizedCut),
      new Region(this.x, this.y + normalizedCut, this.width, this.height - normalizedCut),
    ];
  }

  translateInside(
    container: Region,
    xAxis = true,
    yAxis = true,
  ): Region {
    return new Region(
      xAxis ? Math.max(Math.min(this.x, container.right - this.width), container.x) : this.x,
      yAxis ? Math.max(Math.min(this.y, container.bottom - this.height), container.y) : this.y,
      this.width,
      this.height,
    );
  }

  inflect(xAxis = 1, yAxis = 1, margin: Spacing = Spacing.ZERO): Region {
    return new Region(
      this.x + (xAxis === 0 ? 0 : (this.width + margin.maxWidth) * xAxis),
      this.y + (yAxis === 0 ? 0 : (this.height + margin.maxHeight) * yAxis),
      this.width,
      this.height,
    );
  }

  constrain(
    constrainX: "none" | "inside" | "inflect",
    constrainY: "none" | "inside" | "inflect",
    margin: Spacing,
    container: Region,
  ): Region {
    const marginRegion = this.grow(margin);
    const compareSpan = (spanStart: number, spanEnd: number, containerStart: number, containerEnd: number): number => {
      if (spanStart >= containerStart && spanEnd <= containerEnd) {
        return 0;
      }

      return spanStart < containerStart ? -1 : 1;
    };

    const inflectedRegion =
      constrainX === "inflect" || constrainY === "inflect"
        ? this.inflect(
            constrainX === "inflect"
              ? -compareSpan(marginRegion.x, marginRegion.right, container.x, container.right)
              : 0,
            constrainY === "inflect"
              ? -compareSpan(marginRegion.y, marginRegion.bottom, container.y, container.bottom)
              : 0,
            margin,
          )
        : this;

    // [LAW:dataflow-not-control-flow] Constraint resolution always runs the
    // same two stages: optional inflection encoded as axis data, then translate
    // inside the shrunken container. Empty moves are represented as zeros.
    return inflectedRegion.translateInside(
      container.shrink(margin),
      constrainX !== "none",
      constrainY !== "none",
    );
  }

  /**
   * Compute the minimum scroll offset needed to bring `target` into view
   * within this region (the viewport/window).
   */
  getScrollToVisible(target: Region): Offset {
    return Region.getScrollToVisible(this, target);
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

  static getScrollToVisible(windowRegion: Region, targetRegion: Region, options: { top?: boolean } = {}): Offset {
    if (windowRegion.containsRegion(targetRegion) && !options.top) {
      return Offset.ZERO;
    }

    const croppedTarget = targetRegion.cropSize(windowRegion.size);
    const horizontalFits =
      windowRegion.right > croppedTarget.x &&
      croppedTarget.x >= windowRegion.x &&
      windowRegion.right >= croppedTarget.right &&
      croppedTarget.right >= windowRegion.x;
    const verticalFits =
      windowRegion.bottom > croppedTarget.y &&
      croppedTarget.y >= windowRegion.y &&
      windowRegion.bottom >= croppedTarget.bottom &&
      croppedTarget.bottom >= windowRegion.y;
    const leftDelta = croppedTarget.x - windowRegion.x;
    const rightDelta = croppedTarget.x - (windowRegion.right - croppedTarget.width);
    const dx = horizontalFits ? 0 : Math.abs(leftDelta) <= Math.abs(rightDelta) ? leftDelta : rightDelta;
    const topDelta = croppedTarget.y - windowRegion.y;
    const bottomDelta = croppedTarget.y - (windowRegion.bottom - croppedTarget.height);
    const dy = options.top
      ? topDelta
      : verticalFits
        ? 0
        : Math.abs(topDelta) <= Math.abs(bottomDelta)
          ? topDelta
          : bottomDelta;

    // [LAW:dataflow-not-control-flow] Scroll deltas are derived on both axes
    // every time; already-visible axes encode "no move" as zero.
    return new Offset(dx, dy);
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
