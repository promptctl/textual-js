import React, { useLayoutEffect } from "react";
import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";

import {
  Notification,
  Notifications,
  Color,
  TextualApp,
  TextualFramework,
  WidgetNode,
  WidgetScope,
  useWidget,
} from "../src/index.js";

function NotificationHarness(props: { onReady: (widget: WidgetNode) => void }): React.JSX.Element {
  const widget = useWidget({
    id: "notification-harness",
    typeName: "NotificationHarness",
  });

  useLayoutEffect(() => {
    props.onReady(widget.handle);
  }, [props, widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Text>notify</Text>
    </WidgetScope>
  );
}

describe("notifications and themes", () => {
  it("assigns notification defaults and unique identities", () => {
    const one = new Notification("hello");
    const two = new Notification("hello");

    expect(one.identity).not.toBe(two.identity);
    expect(one.title).toBe("");
    expect(one.severity).toBe("information");

    const identities = new Set(Array.from({ length: 1000 }, () => new Notification("same").identity));
    expect(identities.size).toBe(1000);
  });

  it("prunes expired notifications on access and supports clear/delete", () => {
    vi.useFakeTimers();

    try {
      const notifications = new Notifications();
      const expiring = notifications.add(new Notification("short", { timeout: 100 }));
      const persistent = notifications.add(new Notification("long", { timeout: 0 }));

      expect(notifications.length).toBe(2);

      vi.advanceTimersByTime(150);

      expect(notifications.length).toBe(1);
      expect(Array.from(notifications).map((entry) => entry.message)).toEqual(["long"]);

      notifications.delete(expiring);
      notifications.delete(expiring);
      expect(notifications.has(persistent)).toBe(true);

      notifications.clear();
      expect(notifications.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves insertion order for membership and iteration edge cases", () => {
    vi.useFakeTimers();

    try {
      const notifications = new Notifications();
      const first = notifications.add(new Notification("first", { timeout: 0 }));
      const second = notifications.add(new Notification("second", { timeout: 50 }));
      const third = notifications.add(new Notification("third", { timeout: 0 }));

      expect(notifications.has(first)).toBe(true);
      expect(notifications.has(second)).toBe(true);
      expect(Array.from(notifications).map((entry) => entry.message)).toEqual(["first", "second", "third"]);

      vi.advanceTimersByTime(75);

      expect(notifications.has(second)).toBe(false);
      expect(Array.from(notifications).map((entry) => entry.message)).toEqual(["first", "third"]);

      notifications.delete(second);
      notifications.delete(new Notification("missing", { timeout: 0 }));

      expect(Array.from(notifications).map((entry) => entry.identity)).toEqual([first.identity, third.identity]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("funnels widget notifications into the app store and reapplies theme CSS variables", async () => {
    const framework = new TextualFramework();
    let widget!: WidgetNode;
    const observedThemes: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          #notification-harness {
            background: var(--theme-primary);
            color: var(--theme-foreground);
          }
        `}
      >
        <NotificationHarness
          onReady={(value) => {
            widget = value;
          }}
        />
      </TextualApp>,
    );

    await framework.whenIdle();

    const unsubscribe = framework.signals.theme_changed_signal.subscribe(widget, (theme) => {
      observedThemes.push(theme.name);
    });

    const defaultPrimary = framework.activeTheme.primary;

    framework.notify("from-app", "warning", 250);
    widget.notify("from-widget", "error", 500);

    expect(framework.notifications.length).toBe(2);
    expect(framework.notifications.list().map((entry) => entry.message)).toEqual(["from-app", "from-widget"]);
    expect(widget.resolvedStyles.getRule("background")).toEqual(Color.parse(defaultPrimary));
    expect(widget.resolvedStyles.getRule("color")).toEqual(Color.parse(framework.activeTheme.foreground));

    framework.setTheme("dark");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(widget.resolvedStyles.getRule("background")).toEqual(Color.parse(framework.activeTheme.primary));
    expect(observedThemes).toEqual(["dark"]);

    framework.dismissNotification(framework.notifications.list()[0]!.identity);
    expect(framework.notifications.length).toBe(1);

    framework.clearNotifications();
    expect(framework.notifications.length).toBe(0);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("renders toast notifications from the app collection and prunes expired toasts", async () => {
    vi.useFakeTimers();

    try {
      const framework = new TextualFramework();

      const instance = render(
        <TextualApp framework={framework}>
          <Text>body</Text>
        </TextualApp>,
      );

      await framework.whenIdle();

      framework.notify("toast-one", "information", 100);
      await Promise.resolve();

      expect(instance.lastFrame()).toContain("toast-one");

      vi.advanceTimersByTime(150);
      await framework.whenIdle();
      instance.rerender(
        <TextualApp framework={framework}>
          <Text>body</Text>
        </TextualApp>,
      );

      expect(framework.notifications.length).toBe(0);
      expect(instance.lastFrame()).not.toContain("toast-one");

      instance.unmount();
      instance.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });
});
