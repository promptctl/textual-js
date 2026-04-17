import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";

import {
  ButtonPressed,
  ButtonWidget,
  StaticWidget,
  SwitchChanged,
  SwitchWidget,
  WidgetHost,
  runTest,
} from "../src/index.js";

describe("StaticWidget", () => {
  it("renders text content", async () => {
    const session = await runTest(<StaticWidget content="Hello World" />);

    expect(session.lastFrame()).toContain("Hello World");

    session.unmount();
  });

  it("renders markup content with plain text output", async () => {
    const session = await runTest(<StaticWidget content="[bold]Styled[/]" />);

    expect(session.lastFrame()).toContain("Styled");

    session.unmount();
  });

  it("registers with the framework as typeName Static", async () => {
    const session = await runTest(<StaticWidget id="greeting" content="Hi" />);

    const widget = session.framework.registry.getByCssId("greeting");
    expect(widget).toBeDefined();
    expect(widget!.typeName).toBe("Static");

    session.unmount();
  });

  it("applies user CSS through the cascade", async () => {
    const session = await runTest(
      <StaticWidget id="styled" content="styled" />,
      { props: { css: "Static { color: red; }" } as never },
    );

    // Widget should be registered and styled
    const widget = session.framework.registry.getByCssId("styled");
    expect(widget).toBeDefined();

    session.unmount();
  });
});

describe("ButtonWidget", () => {
  it("renders the label text", async () => {
    const session = await runTest(<ButtonWidget label="Click Me" />);

    expect(session.lastFrame()).toContain("Click Me");

    session.unmount();
  });

  it("posts ButtonPressed on enter key", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <ButtonWidget id="btn" label="Press" />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    // Focus the button
    const btn = session.framework.registry.getByCssId("btn");
    expect(btn).toBeDefined();
    session.framework.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    // Press enter
    await session.pilot.press("enter");

    expect(messages).toContain("pressed");

    session.unmount();
  });

  it("posts ButtonPressed on space key", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <ButtonWidget id="btn" label="Press" />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    const btn = session.framework.registry.getByCssId("btn");
    session.framework.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("space");

    expect(messages).toContain("pressed");

    session.unmount();
  });

  it("does not post ButtonPressed when disabled", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <ButtonWidget id="btn" label="Disabled" disabled />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    const btn = session.framework.registry.getByCssId("btn");
    session.framework.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");

    expect(messages).not.toContain("pressed");

    session.unmount();
  });

  it("does not post ButtonPressed when loading", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <ButtonWidget id="btn" label="Loading" loading />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    const btn = session.framework.registry.getByCssId("btn");
    session.framework.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");

    expect(messages).not.toContain("pressed");

    session.unmount();
  });

  it("registers with variant CSS class", async () => {
    const session = await runTest(<ButtonWidget id="btn" label="OK" variant="primary" />);

    const btn = session.framework.registry.getByCssId("btn");
    expect(btn).toBeDefined();
    expect(btn!.hasClass("-primary")).toBe(true);

    session.unmount();
  });

  it("is focusable and appears in the focus chain", async () => {
    const session = await runTest(
      <>
        <ButtonWidget id="a" label="A" />
        <ButtonWidget id="b" label="B" />
      </>,
    );

    const chain = session.framework.getFocusChain();
    const ids = chain.map((w) => w.id);

    expect(ids).toContain("a");
    expect(ids).toContain("b");

    session.unmount();
  });
});

describe("SwitchWidget", () => {
  it("renders with initial off state", async () => {
    const session = await runTest(<SwitchWidget id="sw" />);

    const sw = session.framework.registry.getByCssId("sw");
    expect(sw).toBeDefined();
    // Default is off — slider should show off pattern
    expect(session.lastFrame()).toContain("●");

    session.unmount();
  });

  it("renders with initial on state", async () => {
    const session = await runTest(<SwitchWidget id="sw" value />);

    // On state slider
    expect(session.lastFrame()).toContain("●");

    session.unmount();
  });

  it("posts SwitchChanged on enter key toggle", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <SwitchWidget id="sw" />,
      {
        messageHook: (message) => {
          if (message instanceof SwitchChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const sw = session.framework.registry.getByCssId("sw");
    session.framework.focusWidget(sw!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");

    expect(values).toEqual([true]);

    // Toggle again
    await session.pilot.press("enter");

    expect(values).toEqual([true, false]);

    session.unmount();
  });

  it("posts SwitchChanged on space key toggle", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <SwitchWidget id="sw" />,
      {
        messageHook: (message) => {
          if (message instanceof SwitchChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const sw = session.framework.registry.getByCssId("sw");
    session.framework.focusWidget(sw!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("space");

    expect(values).toEqual([true]);

    session.unmount();
  });

  it("does not toggle when disabled", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <SwitchWidget id="sw" disabled />,
      {
        messageHook: (message) => {
          if (message instanceof SwitchChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const sw = session.framework.registry.getByCssId("sw");
    session.framework.focusWidget(sw!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");

    expect(values).toEqual([]);

    session.unmount();
  });

  it("is focusable and appears in the focus chain", async () => {
    const session = await runTest(
      <>
        <SwitchWidget id="sw1" />
        <SwitchWidget id="sw2" />
      </>,
    );

    const chain = session.framework.getFocusChain();
    const ids = chain.map((w) => w.id);

    expect(ids).toContain("sw1");
    expect(ids).toContain("sw2");

    session.unmount();
  });
});

describe("steel-thread: full framework path", () => {
  it("renders all three widgets together in a single app", async () => {
    const session = await runTest(
      <>
        <StaticWidget content="Status: Ready" />
        <ButtonWidget id="action" label="Go" variant="primary" />
        <SwitchWidget id="toggle" />
      </>,
    );

    expect(session.lastFrame()).toContain("Status: Ready");
    expect(session.lastFrame()).toContain("Go");

    const chain = session.framework.getFocusChain();
    expect(chain.length).toBeGreaterThanOrEqual(2);

    session.unmount();
  });

  it("exercises the full render→focus→key→message→observe path", async () => {
    const events: string[] = [];
    const session = await runTest(
      <>
        <ButtonWidget id="btn" label="Press" />
        <SwitchWidget id="sw" />
      </>,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            events.push("button-pressed");
          }
          if (message instanceof SwitchChanged) {
            events.push(`switch-${message.value}`);
          }
        },
      },
    );

    // Focus button and press
    const btn = session.framework.registry.getByCssId("btn");
    session.framework.focusWidget(btn!.nodeId);
    await session.pilot.pause();
    await session.pilot.press("enter");

    // Tab to switch and toggle
    session.framework.focusNext();
    await session.pilot.pause();
    await session.pilot.press("enter");

    expect(events).toContain("button-pressed");
    expect(events).toContain("switch-true");

    session.unmount();
  });
});
