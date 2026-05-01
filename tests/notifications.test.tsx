import React, { useLayoutEffect } from "react";
import { Text } from "ink";
import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";

import {
  App,
  Content,
  Notify,
  Notification,
  Notifications,
  Color,
  TextualApp,
  Widget,
  WidgetScope,
  useWidget,
} from "../src/index.js";

function NotificationHarness(props: { onReady: (widget: Widget) => void }): React.JSX.Element {
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
    expect(one.markup).toBe(true);
    expect(one.has_expired).toBe(false);

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

  it("funnels widget notifications into the app store, posts Notify, and reapplies theme CSS variables", async () => {
    const app = new App();
    let widget!: Widget;
    const observedThemes: string[] = [];
    const notifyMessages: Notification[] = [];

    const instance = render(
      <TextualApp
        app={app}
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

    await app.whenIdle();
    const unsubscribeMessages = app.subscribeToMessages((message) => {
      if (message instanceof Notify) {
        notifyMessages.push(message.notification as Notification);
      }
    });

    const unsubscribe = app.signals.theme_changed_signal.subscribe(widget, (theme) => {
      observedThemes.push(theme.name);
    });

    const defaultPrimary = app.activeTheme.primary;

    app.notify(Content.styled("from-app", "bold"), { severity: "warning", timeout: 250, title: Content.styled("Title", "italic") });
    widget.notify("from-widget", { severity: "error", timeout: 500, markup: false });
    await app.whenIdle();

    expect(app.notifications.length).toBe(2);
    expect(app.notifications.list()[0]!.message).toBeInstanceOf(Content);
    expect(app.notifications.list().map((entry) => entry.severityClass)).toEqual(["-warning", "-error"]);
    expect(notifyMessages.map((entry) => entry.severity)).toEqual(["warning", "error"]);
    expect(widget.resolvedStyles.getRule("background")).toEqual(Color.parse(defaultPrimary));
    expect(widget.resolvedStyles.getRule("color")).toEqual(Color.parse(app.activeTheme.foreground));

    app.theme = ("dark");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(widget.resolvedStyles.getRule("background")).toEqual(Color.parse(app.activeTheme.primary));
    expect(observedThemes).toEqual(["dark"]);

    app.dismissNotification(app.notifications.list()[0]!.identity);
    expect(app.notifications.length).toBe(1);

    app.clearNotifications();
    expect(app.notifications.length).toBe(0);

    unsubscribe();
    unsubscribeMessages();
    instance.unmount();
    instance.cleanup();
  });

  it("exposes app notification, worker, feature, and app-level signal surfaces", () => {
    const app = new App({ env: { TEXTUAL: "devtools, debug" } });
    const notification = app.notify("public", { timeout: 0 });

    expect(app.workers).toBe(app.workers);
    expect(app.features.has("devtools")).toBe(true);
    expect(app.devtools).not.toBeNull();
    expect(app.debug).toBe(true);
    expect(app.mode_change_signal).toBe(app.signals.mode_change_signal);
    expect(app.screen_change_signal).toBe(app.signals.screen_change_signal);
    expect(app.notifications.has(notification)).toBe(true);

    app._unnotify(notification);
    expect(app.notifications.has(notification)).toBe(false);
  });

  it("stores theme palette values as Color and exposes derived CSS variables", () => {
    const app = new App();
    const activeTheme = app.registerTheme({
      name: "custom-color-theme",
      dark: false,
      primary: Color.parse("#123456"),
      secondary: "#223344",
      accent: "#334455",
      background: "#ffffff",
      surface: "#eeeeee",
      panel: "#dddddd",
      foreground: "#111111",
      warning: "#aa7700",
      error: "#aa0000",
      success: "#00aa00",
      variables: {
        "custom-color": Color.parse("#010203"),
      },
    });

    app.theme = ("custom-color-theme");

    const variables = app.themeManager.getCssVariables();
    expect(activeTheme.primary).toBeInstanceOf(Color);
    expect(activeTheme.variables["custom-color"]).toBeInstanceOf(Color);
    expect(variables["--primary-lighten-2"]).toBe(Color.parse("#123456").lighten(0.3).hex6.toLowerCase());
    expect(variables["--surface-darken-1"]).toBe(Color.parse("#eeeeee").darken(0.15).hex6.toLowerCase());
    expect(variables["--primary-muted"]).toBe(Color.parse("#123456").blend(Color.parse("#ffffff"), 0.7).hex6.toLowerCase());
    expect(variables["--custom-color"]).toBe(Color.parse("#010203").hex6.toLowerCase());
  });

  it("renders toast notifications from the app collection and prunes expired toasts", async () => {
    vi.useFakeTimers();

    try {
      const app = new App();

      const instance = render(
        <TextualApp app={app}>
          <Text>body</Text>
        </TextualApp>,
      );

      await app.whenIdle();

      app.notify("toast-one", "information", 100);
      app.notify("toast-two", { severity: "error", timeout: 0, title: "Problem" });
      await Promise.resolve();

      expect(instance.lastFrame()).toContain("toast-one");
      expect(instance.lastFrame()).toContain("Problem");
      expect(instance.lastFrame()).toContain("toast-two");

      vi.advanceTimersByTime(150);
      await Promise.resolve();

      expect(app.notifications.list().map((entry) => entry.message)).toEqual(["toast-two"]);
      expect(instance.lastFrame()).not.toContain("toast-one");
      expect(instance.lastFrame()).toContain("toast-two");

      instance.unmount();
      instance.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });
});
