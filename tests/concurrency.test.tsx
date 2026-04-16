import React, { useLayoutEffect } from "react";
import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";

import { RLock, TextualApp, TextualFramework, WidgetNode, WidgetScope, useWidget } from "../src/index.js";

function TimerHarness(props: { onReady: (widget: WidgetNode) => void }): React.JSX.Element {
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
      const framework = new TextualFramework();
      let widget!: WidgetNode;
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

      await framework.whenIdle();

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
    const framework = new TextualFramework();
    const order: string[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <Text>schedule</Text>
      </TextualApp>,
    );

    await framework.whenIdle();
    const displayCountBefore = framework.displayCount;

    framework.callNext(() => {
      order.push("next");
    });
    framework.callLater(() => {
      order.push("later");
    });

    let afterRefreshDisplayCount = 0;
    framework.callAfterRefresh(() => {
      afterRefreshDisplayCount = framework.displayCount;
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
});
