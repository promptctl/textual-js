import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import {
  ActiveModeError,
  InvalidModeError,
  ScreenResume,
  ScreenStackError,
  ScreenSuspend,
  TextualApp,
  TextualFramework,
  UnknownModeError,
  WidgetHost,
} from "../src/index.js";

function DefaultScreen(): React.JSX.Element {
  return (
    <WidgetHost typeName="DefaultScreen" id="default-root">
      <Text>default</Text>
    </WidgetHost>
  );
}

function DialogScreen(): React.JSX.Element {
  return (
    <WidgetHost typeName="DialogScreen" id="dialog-root">
      <Text>dialog</Text>
    </WidgetHost>
  );
}

describe("screen stack", () => {
  it("renders pushed screens instead of the default children and emits suspend/resume messages", async () => {
    const framework = new TextualFramework();
    const events: string[] = [];

    const unsubscribe = framework.subscribeToMessages((message) => {
      if (message instanceof ScreenResume) {
        events.push(`resume:${message.screenName ?? "default"}`);
      } else if (message instanceof ScreenSuspend) {
        events.push(`suspend:${message.screenName ?? "default"}`);
      }
    });

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(instance.lastFrame()).toContain("default");

    framework.pushScreen(<DialogScreen />, { name: "dialog" });
    await framework.whenIdle();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(instance.lastFrame()).toContain("dialog");
    expect(instance.lastFrame()).not.toContain("default");
    expect(events).toContain("resume:dialog");

    framework.popScreen();
    await framework.whenIdle();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(instance.lastFrame()).toContain("default");
    expect(events.filter((entry) => entry === "suspend:dialog")).toHaveLength(1);

    unsubscribe();
    instance.unmount();
    instance.cleanup();
  });

  it("refuses to pop the last screen", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(() => framework.popScreen()).toThrow(ScreenStackError);

    instance.unmount();
    instance.cleanup();
  });

  it("delivers push results to the supplied callback when popped", async () => {
    const framework = new TextualFramework();
    const results: unknown[] = [];

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.pushScreen(<DialogScreen />, (result) => {
      results.push(result);
    });

    framework.popScreen("confirmed");
    await framework.whenIdle();

    expect(results).toEqual(["confirmed"]);

    instance.unmount();
    instance.cleanup();
  });

  it("switchScreen replaces the top of the stack without changing depth", async () => {
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.pushScreen(<DialogScreen />, { name: "one" });
    await framework.whenIdle();

    expect(framework.screenStackDepth).toBe(1);

    framework.switchScreen(<DialogScreen />, { name: "two" });
    await framework.whenIdle();

    expect(framework.screenStackDepth).toBe(1);
    expect(framework.activeScreen?.name).toBe("two");

    instance.unmount();
    instance.cleanup();
  });
});

describe("screen modes", () => {
  it("maintains independent screen stacks per mode", async () => {
    const framework = new TextualFramework();
    framework.addMode("secondary", () => <DialogScreen />);

    const instance = render(
      <TextualApp framework={framework}>
        <DefaultScreen />
      </TextualApp>,
    );

    await framework.whenIdle();

    framework.pushScreen(<DialogScreen />, { name: "default-dialog" });
    await framework.whenIdle();

    expect(framework.screenStackDepth).toBe(1);
    expect(framework.activeScreen?.name).toBe("default-dialog");

    framework.switchMode("secondary");
    await framework.whenIdle();

    expect(framework.activeMode).toBe("secondary");
    expect(framework.screenStackDepth).toBe(1);
    expect(framework.activeScreen?.name).toBeNull();

    framework.switchMode("_default");
    await framework.whenIdle();

    expect(framework.activeMode).toBe("_default");
    expect(framework.activeScreen?.name).toBe("default-dialog");

    instance.unmount();
    instance.cleanup();
  });

  it("rejects unknown modes, duplicate modes, and removal of the active mode", () => {
    const framework = new TextualFramework();

    expect(() => framework.switchMode("ghost")).toThrow(UnknownModeError);

    framework.addMode("alpha", () => <DialogScreen />);
    expect(() => framework.addMode("alpha", () => <DialogScreen />)).toThrow(InvalidModeError);

    framework.switchMode("alpha");
    expect(() => framework.removeMode("alpha")).toThrow(ActiveModeError);

    framework.switchMode("_default");
    framework.removeMode("alpha");
    expect(() => framework.switchMode("alpha")).toThrow(UnknownModeError);
  });
});
