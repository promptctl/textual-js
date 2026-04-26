export interface TimerOptions {
  skip?: boolean;
  repeat?: number;
}

export type TimerCallback = () => void;

export class ManagedTimer {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private nextDueAt = 0;
  private tickCount = 0;
  private pausedAt: number | null = null;
  private active = true;

  constructor(
    readonly name: string,
    private readonly delayMs: number,
    private readonly callback: TimerCallback,
    private readonly repeating: boolean,
    private readonly options: Required<TimerOptions>,
  ) {
    this.startedAt = Date.now();
    this.nextDueAt = this.startedAt + this.delayMs;
  }

  start(): void {
    this.schedule();
  }

  cancel(): void {
    this.active = false;

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  pause(): void {
    this.pausedAt = Date.now();

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  resume(): void {
    if (this.pausedAt === null) {
      return;
    }

    const pausedDuration = Date.now() - this.pausedAt;
    this.startedAt += pausedDuration;
    this.nextDueAt += pausedDuration;
    this.pausedAt = null;
    this.schedule();
  }

  reset(): void {
    this.startedAt = Date.now();
    this.nextDueAt = this.startedAt + this.delayMs;
    this.tickCount = 0;
    this.schedule();
  }

  private schedule(): void {
    if (!this.active || this.pausedAt !== null) {
      return;
    }

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }

    const delay = Math.max(0, this.nextDueAt - Date.now());
    this.timeoutId = setTimeout(() => this.fire(), delay);
  }

  private fire(): void {
    if (!this.active || this.pausedAt !== null) {
      return;
    }

    const now = Date.now();

    try {
      this.callback();
    } catch (error) {
      console.error(error);
    }

    if (!this.repeating) {
      this.cancel();
      return;
    }

    const skipTickCount = Math.max(1, Math.floor((now - this.startedAt) / this.delayMs));
    const nextTickCount = this.options.skip ? skipTickCount : this.tickCount + 1;

    this.tickCount = nextTickCount;

    if (this.options.repeat > 0 && this.tickCount >= this.options.repeat) {
      this.cancel();
      return;
    }

    this.nextDueAt = this.startedAt + (this.tickCount + 1) * this.delayMs;
    this.schedule();
  }
}
