import { runInAction } from "mobx";
import { describe, expect, it } from "vitest";

import { ReactiveHost, reactive } from "../src/index.js";

class CounterHost extends ReactiveHost {
  static readonly definitions = {
    count: reactive(1, { init: true }),
    pulse: reactive("idle", { alwaysUpdate: true, init: false }),
  };

  readonly calls: string[] = [];

  constructor() {
    super();
    this.initializeReactiveState(CounterHost.definitions);
  }

  _validate_count(value: number): number {
    this.calls.push(`private-validate:${value}`);
    return Math.max(0, value);
  }

  validate_count(value: number): number {
    this.calls.push(`public-validate:${value}`);
    return value * 2;
  }

  _watch_count(oldValue: number | undefined, newValue: number): void {
    this.calls.push(`private-watch:${oldValue ?? "init"}->${newValue}`);
  }

  watch_count(oldValue: number | undefined, newValue: number): void {
    this.calls.push(`public-watch:${oldValue ?? "init"}->${newValue}`);
  }

  compute_double(): number {
    return this.count * 2;
  }
}

describe("reactive pipeline", () => {
  it("runs validator, store, watcher, and compute in order", () => {
    const host = new CounterHost();
    const events: string[] = [];

    host.watch<number>("count", (oldValue, newValue) => {
      events.push(`external:${oldValue ?? "init"}->${newValue}`);
    });

    runInAction(() => {
      host.count = 3;
    });

    expect(host.count).toBe(6);
    expect(host.double).toBe(12);
    expect(host.calls).toEqual([
      "private-validate:1",
      "public-validate:1",
      "private-watch:init->2",
      "public-watch:init->2",
      "private-validate:3",
      "public-validate:3",
      "private-watch:2->6",
      "public-watch:2->6",
    ]);
    expect(events).toEqual(["external:2->6"]);
  });

  it("fires watchers on same-value assignments when always_update is enabled", () => {
    const host = new CounterHost();
    const values: string[] = [];

    host.watch<string>("pulse", (oldValue, newValue) => {
      values.push(`${oldValue ?? "init"}->${newValue}`);
    });

    runInAction(() => {
      host.pulse = "ready";
      host.pulse = "ready";
    });

    expect(values).toEqual(["idle->ready", "ready->ready"]);
  });

  it("enforces action-only mutation", () => {
    const host = new CounterHost();

    expect(() => {
      host.count = 4;
    }).toThrow();
  });
});
