import { runInAction } from "mobx";
import { describe, expect, it } from "vitest";

import { ReactiveError, ReactiveHost, reactive, reactiveSource } from "../src/index.js";

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

  watch_double(oldValue: number | undefined, newValue: number): void {
    this.calls.push(`double:${oldValue ?? "init"}->${newValue}`);
  }
}

class LazyHost extends ReactiveHost {
  static readonly definitions = {
    count: reactive(1),
  };

  readonly calls: string[] = [];

  constructor() {
    super();
    this.initializeReactiveState(LazyHost.definitions);
  }

  watch_count(oldValue: number | undefined, newValue: number): void {
    this.calls.push(`${oldValue ?? "init"}->${newValue}`);
  }
}

class PulseHost extends ReactiveHost {
  static readonly definitions = {
    pulse: reactive("idle", { alwaysUpdate: true }),
  };

  readonly calls: string[] = [];

  constructor() {
    super();
    this.initializeReactiveState(PulseHost.definitions);
  }

  watch_pulse(oldValue: string | undefined, newValue: string): void {
    this.calls.push(`${oldValue ?? "init"}->${newValue}`);
  }
}

class MirrorHost extends ReactiveHost {
  static readonly definitions = {
    mirror: reactive("unset"),
  };

  readonly calls: string[] = [];

  constructor() {
    super();
    this.initializeReactiveState(MirrorHost.definitions);
  }

  watch_mirror(oldValue: string | undefined, newValue: string): void {
    this.calls.push(`${oldValue ?? "init"}->${newValue}`);
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
      "double:4->12",
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

  it("does not initialize plain reactive() watchers unless init is enabled", () => {
    const host = new LazyHost();

    expect(host.calls).toEqual([]);
  });

  it("setReactive bypasses validators, watchers, and computed watcher notifications", () => {
    const host = new CounterHost();
    host.calls.length = 0;

    host.setReactive("count", 3);

    expect(host.count).toBe(3);
    expect(host.double).toBe(6);
    expect(host.calls).toEqual([]);
  });

  it("enforces action-only mutation", () => {
    const host = new CounterHost();

    expect(() => {
      host.count = 4;
    }).toThrow();
  });

  it("supports cross-host watchers with deduplicated registration", () => {
    const source = new CounterHost();
    const selfObserved: string[] = [];
    const crossObserved: string[] = [];
    const selfCallback = (oldValue: number | undefined, newValue: number): void => {
      selfObserved.push(`${oldValue ?? "init"}->${newValue}`);
    };
    const crossCallback = (oldValue: number | undefined, newValue: number): void => {
      crossObserved.push(`${oldValue ?? "init"}->${newValue}`);
    };

    source.watch("count", selfCallback, { init: true });
    source.watch("count", selfCallback, { init: true });

    const observer = new LazyHost();
    observer.watch(source, "count", crossCallback, { init: true });
    observer.watch(source, "count", crossCallback, { init: true });

    runInAction(() => {
      source.count = 4;
    });

    expect(selfObserved).toEqual(["init->2", "2->8"]);
    expect(crossObserved).toEqual(["init->2", "2->8"]);
  });

  it("binds child reactives to another host and propagates equal-value updates", () => {
    const source = new PulseHost();
    const mirror = new MirrorHost();

    mirror.dataBind({
      mirror: reactiveSource(source, "pulse"),
    });

    runInAction(() => {
      source.pulse = "ready";
      source.pulse = "ready";
    });

    expect(mirror.mirror).toBe("ready");
    expect(mirror.calls).toEqual(["unset->idle", "idle->ready", "ready->ready"]);
  });

  it("rejects bindings to unknown target reactives", () => {
    const source = new PulseHost();
    const mirror = new MirrorHost();

    expect(() => {
      mirror.dataBind({
        missing: reactiveSource(source, "pulse"),
      });
    }).toThrow(ReactiveError);
  });
});
