import { runInAction } from "mobx";
import { describe, expect, it } from "vitest";

import {
  Initialize,
  ReactiveError,
  ReactiveHost,
  reactive,
  reactiveSource,
  var as reactiveVar,
} from "../src/index.js";

class CounterHost extends ReactiveHost {
  static readonly definitions = {
    count: reactive(1, { init: true }),
    pulse: reactive("idle", { alwaysUpdate: true, init: false }),
    marker: reactiveVar("cold"),
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
    count: reactive(1, { init: false }),
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

class ZeroArgWatcherHost extends ReactiveHost {
  static readonly definitions = {
    count: reactive(1),
  };

  readonly calls: string[] = [];

  constructor() {
    super();
    this.initializeReactiveState(ZeroArgWatcherHost.definitions);
  }

  watch_count(): void {
    this.calls.push("zero");
  }
}

class OneArgWatcherHost extends ReactiveHost {
  static readonly definitions = {
    count: reactive(1),
  };

  readonly calls: string[] = [];

  constructor() {
    super();
    this.initializeReactiveState(OneArgWatcherHost.definitions);
  }

  watchCount(value: number): void {
    this.calls.push(`one:${value}`);
  }
}

class AsyncWatcherHost extends ReactiveHost {
  static readonly definitions = {
    count: reactive(2),
  };

  readonly calls: string[] = [];

  constructor() {
    super();
    this.initializeReactiveState(AsyncWatcherHost.definitions);
  }

  async watch_count(oldValue: number, newValue: number): Promise<void> {
    await Promise.resolve();
    this.calls.push(`${oldValue}->${newValue}`);
  }
}

class InitializeHost extends ReactiveHost {
  static readonly definitions = {
    names: reactive(new Initialize<InitializeHost, string[]>((owner) => owner.buildNames())),
  };

  constructor(private readonly seed: string) {
    super();
    this.initializeReactiveState(InitializeHost.definitions);
  }

  buildNames(): string[] {
    return [this.seed, `${this.seed}-next`];
  }
}

class BaseInheritedHost extends ReactiveHost {
  static readonly definitions = {
    baseCount: reactive(1),
  };

  constructor() {
    super();
    this.initializeReactiveState(BaseInheritedHost.definitions);
  }
}

class MiddleInheritedHost extends BaseInheritedHost {
  static override readonly definitions = {
    middleCount: reactive(2),
  };
}

class GrandchildInheritedHost extends MiddleInheritedHost {
  static override readonly definitions = {
    baseCount: reactive(10),
    leafCount: reactive(3),
  };
}

class ComputeConflictHost extends ReactiveHost {
  static readonly definitions = {
    count: reactive(1),
  };

  constructor() {
    super();
    this.initializeReactiveState(ComputeConflictHost.definitions);
  }

  compute_total(): number {
    return this.count;
  }

  _compute_total(): number {
    return this.count;
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
      "private-watch:2->2",
      "public-watch:2->2",
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

  it("materializes var defaults and fires init watchers like reactive", () => {
    const host = new CounterHost();

    expect(host.marker).toBe("cold");
  });

  it("does not initialize plain reactive() watchers unless init is enabled", () => {
    const host = new LazyHost();

    expect(host.calls).toEqual([]);
  });

  it("supports zero-arg and one-arg watcher signatures", () => {
    const zeroArgHost = new ZeroArgWatcherHost();
    const oneArgHost = new OneArgWatcherHost();

    expect(zeroArgHost.calls).toEqual(["zero"]);
    expect(oneArgHost.calls).toEqual(["one:1"]);
  });

  it("schedules async watchers instead of running them inline", async () => {
    const host = new AsyncWatcherHost();

    expect(host.calls).toEqual([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(host.calls).toEqual(["2->2"]);

    host.calls.length = 0;
    runInAction(() => {
      host.count = 4;
    });

    expect(host.calls).toEqual([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(host.calls).toEqual(["2->4"]);
  });

  it("initializes owner-aware defaults through Initialize", () => {
    const host = new InitializeHost("alpha");

    expect(host.names).toEqual(["alpha", "alpha-next"]);
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

    expect(selfObserved).toEqual(["2->2", "2->8"]);
    expect(crossObserved).toEqual(["2->2", "2->8"]);
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
    expect(mirror.calls).toEqual(["unset->unset", "unset->idle", "idle->ready", "ready->ready"]);
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

  it("inherits reactives across subclass and grandchild chains with overriding defaults", () => {
    const host = new GrandchildInheritedHost();

    expect(host.baseCount).toBe(10);
    expect(host.middleCount).toBe(2);
    expect(host.leafCount).toBe(3);
  });

  it("rejects conflicting public and private compute methods", () => {
    expect(() => new ComputeConflictHost()).toThrow(/Too many compute methods/);
  });

  it("treats computed reactives as read-only", () => {
    const host = new CounterHost();

    expect(() => {
      (host as CounterHost & { double: number }).double = 99;
    }).toThrow(/read-only/);
  });
});
