import { App } from "../src/index.js";
import React, { useLayoutEffect } from "react";
import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextualFramework } from "../src/framework/app-framework.js";

import {
  Message,
  RLock,
  RuntimeError,
  TextualApp,
  WidgetHost,
  Widget,
  WidgetScope,
  getActiveMessagePump,
  useWidget,
} from "../src/index.js";

class NextTickPing extends Message {}

function TimerHarness(props: { onReady: (widget: Widget) => void }): React.JSX.Element {
  const widget = useWidget({
    id: "timer-harness",
    typeName: "TimerHarness",
  });

  useLayoutEffect(() => {
    props.onReady(widget.handle);
  }, [props, widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Text>timers</Text>
    </WidgetScope>
  );
}

describe("concurrency primitives", () => {
  it("supports named timers with pause, resume, replacement, and unmount cleanup", async () => {
    vi.useFakeTimers();

    try {
      const app = new App();
      const framework = app.framework;
      let widget!: Widget;
      const ticks: number[] = [];

      const instance = render(
        <TextualApp framework={framework}>
          <TimerHarness
            onReady={(value) => {
              widget = value;
            }}
          />
        </TextualApp>,
      );

      await app.whenIdle();

      widget.setInterval("heartbeat", 1000, () => {
        ticks.push(Date.now());
      });

      vi.advanceTimersByTime(2500);
      expect(ticks).toHaveLength(2);

      widget.pauseTimer("heartbeat");
      vi.advanceTimersByTime(5000);
      expect(ticks).toHaveLength(2);

      widget.resumeTimer("heartbeat");
      vi.advanceTimersByTime(1000);
      expect(ticks).toHaveLength(3);

      widget.setTimer("heartbeat", 200, () => {
        ticks.push(999);
      });
      vi.advanceTimersByTime(200);
      expect(ticks.at(-1)).toBe(999);

      instance.unmount();
      instance.cleanup();
      vi.advanceTimersByTime(5000);

      expect(ticks.filter((value) => value === 999)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("schedules callbacks for next tick, later, and after refresh", async () => {
    const app = new App();
      const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <Text>schedule</Text>
      </TextualApp>,
    );

    await app.whenIdle();
    const displayCountBefore = app.displayCount;

    app.callNext(() => {
      order.push("next");
    });
    app.callLater(() => {
      order.push("later");
    });

    let afterRefreshDisplayCount = 0;
    app.callAfterRefresh(() => {
      afterRefreshDisplayCount = app.displayCount;
      order.push("after-refresh");
    });

    order.push("sync");

    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(order[0]).toBe("sync");
    expect(order).toContain("next");
    expect(order).toContain("later");
    expect(order).toContain("after-refresh");
    expect(afterRefreshDisplayCount).toBeGreaterThanOrEqual(displayCountBefore + 1);

    instance.unmount();
    instance.cleanup();
  });

  it("routes callLater through the message queue and idle drain", async () => {
    const app = new App();
      const framework = app.framework;
    const observed: string[] = [];
    const unsubscribe = app.subscribeToMessages((message) => {
      observed.push(message.constructor.name);
    });

    const instance = render(
      <TextualApp framework={framework}>
        <Text>later</Text>
      </TextualApp>,
    );

    await app.whenIdle();

    const order: string[] = [];
    app.callLater(() => {
      order.push("later");
    });

    expect(app.messageQueueSize).toBe(1);

    await app.whenIdle();

    expect(order).toEqual(["later"]);
    expect(observed).toContain("Callback");

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("flushes callNext from the dispatcher before later queued callbacks", async () => {
    const app = new App();
      const framework = app.framework;
    const order: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          typeName="Scheduler"
          handlers={{
            onNextTickPing: () => {
              order.push("handler");
              app.callNext(() => {
                order.push("next");
              });
              app.callLater(() => {
                order.push("later");
              });
            },
          }}
        >
          <Text>scheduler</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await app.whenIdle();

    const widget = app.findWidgets("*")[0];
    app.postMessage(widget.nodeId, new NextTickPing());
    await app.whenIdle();

    expect(order).toEqual(["handler", "next", "later"]);

    instance.unmount();
    instance.cleanup();
  });

  it("allows reentrant locking and rejects over-release", async () => {
    const lock = new RLock();

    await lock.acquire();
    await lock.acquire();

    expect(lock.isLocked).toBe(true);

    lock.release();
    expect(lock.isLocked).toBe(true);

    lock.release();
    expect(lock.isLocked).toBe(false);

    expect(() => lock.release()).toThrow();
  });

  it("blocks competing RLock tasks until the owner releases and supports scoped acquisition", async () => {
    const lock = new RLock();
    const order: string[] = [];
    let releaseHolder!: () => void;

    const holder = lock.withLock(async () => {
      order.push("holder:start");
      await new Promise<void>((resolve) => {
        releaseHolder = resolve;
      });
      order.push("holder:end");
    });

    await Promise.resolve();

    const competitor = lock.withLock(() => {
      order.push("competitor");
    });

    await Promise.resolve();
    expect(order).toEqual(["holder:start"]);

    releaseHolder();
    await holder;
    await competitor;

    expect(order).toEqual(["holder:start", "holder:end", "competitor"]);

    await lock.withLock(async () => {
      await lock.acquire();
      expect(lock.isLocked).toBe(true);
      lock.release();
    });

    expect(lock.isLocked).toBe(false);
  });

  it("runs callAfterRefresh inside the active message pump context", async () => {
    const app = new App();
      const framework = app.framework;
    let active: TextualFramework | null = null;

    const instance = render(
      <TextualApp framework={framework}>
        <Text>after-refresh-context</Text>
      </TextualApp>,
    );

    await app.whenIdle();

    app.callAfterRefresh(() => {
      active = getActiveMessagePump<TextualFramework>();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(active).toBe(framework);

    instance.unmount();
    instance.cleanup();
  });

  it("rejects callFromThread when stopped or called from the app thread", async () => {
    const stopped = new App().framework;

    expect(() => stopped.callFromThread(() => "nope")).toThrow(RuntimeError);

    const app = new App();
      const framework = app.framework;
    let samePumpError: unknown = null;

    const instance = render(
      <TextualApp framework={framework}>
        <Text>call-from-thread</Text>
      </TextualApp>,
    );

    await app.whenIdle();

    expect(() => app.callFromThread(() => "same-thread")).toThrow(RuntimeError);

    app.callAfterRefresh(() => {
      try {
        void app.callFromThread(() => "same");
      } catch (error) {
        samePumpError = error;
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(samePumpError).toBeInstanceOf(RuntimeError);

    instance.unmount();
    instance.cleanup();
  });
});
