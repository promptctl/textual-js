import { clamp } from "../geometry/clamp.js";

// [LAW:one-source-of-truth] The public `ProgressBar` name is reserved for the
// React widget component; this state holder stays behind the model seam.
export class ProgressBarModel {
  private _total: number | null;
  private _progress: number;

  constructor(total: number | null = null, progress = 0) {
    this._total = total === null ? null : Math.max(0, total);
    this._progress = progress;
  }

  get total(): number | null {
    return this._total;
  }

  set total(value: number | null) {
    this._total = value === null ? null : Math.max(0, value);
  }

  get progress(): number {
    return this._progress;
  }

  set progress(value: number) {
    this._progress = value;
  }

  // [LAW:dataflow-not-control-flow] Percentage is always derived; null when
  // indeterminate, clamped [0,1] when determinate. No conditional skip.
  get percentage(): number | null {
    if (this._total === null || this._total === 0) {
      return null;
    }

    return clamp(this._progress / this._total, 0, 1);
  }

  advance(amount = 1): void {
    this._progress += amount;
  }

  update(options: { total?: number | null; progress?: number; advance?: number } = {}): void {
    if (options.total !== undefined) {
      this.total = options.total;
    }

    if (options.progress !== undefined) {
      this._progress = options.progress;
    }

    if (options.advance !== undefined) {
      this._progress += options.advance;
    }
  }
}
