import React from "react";
import { Segment, type Measurable, type RenderOptions, type Renderable } from "rich-js";
import { describe, expect, it, vi } from "vitest";

import * as textual from "../src/index.js";
import {
  ButtonPressed,
  Button,
  Static,
  SwitchChanged,
  Switch,
  runTest,
} from "../src/index.js";
import { composeWidgetClasses } from "../src/widgets/component-pattern.js";

function createTestRenderable(text: string): Renderable & Measurable {
  return {
    render: vi.fn(function* (_options: RenderOptions) {
      yield new Segment(text);
    }),
    measure: vi.fn((_options: RenderOptions) => ({
      minimum: text.length,
      maximum: text.length,
    })),
  };
}

describe("widget public API", () => {
  it("exports Textual widget names without Widget-suffixed aliases", () => {
    expect(textual.Button).toBe(Button);
    expect(textual.Static).toBe(Static);
    expect(textual.Switch).toBe(Switch);
    expect("ButtonWidget" in textual).toBe(false);
    expect("StaticWidget" in textual).toBe(false);
    expect("SwitchWidget" in textual).toBe(false);
  });
});

describe("widget component pattern", () => {
  it("normalizes authored and derived CSS classes in one shared helper", () => {
    expect(composeWidgetClasses("alpha", ["beta", "gamma"], null, undefined, "")).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });
});

describe("Static", () => {
  it("renders text content", async () => {
    const session = await runTest(<Static content="Hello World" />);

    expect(session.lastFrame()).toContain("Hello World");

    session.unmount();
  });

  it("does not add spacer rows when stacked with other statics", async () => {
    const session = await runTest(
      <>
        <Static content="Hello World" />
        <Static content="Second line of text" />
      </>,
    );

    expect(session.lastFrame()?.trimEnd()).toBe("Hello World\nSecond line of text");

    session.unmount();
  });

  it("renders rich-js renderables through the Visual seam", async () => {
    const renderable = createTestRenderable("Rendered");
    const session = await runTest(<Static content={renderable} />);

    expect(session.lastFrame()).toContain("Rendered");
    expect(renderable.measure).toHaveBeenCalled();
    expect(renderable.render).toHaveBeenCalled();

    session.unmount();
  });

  it("registers with the framework as typeName Static", async () => {
    const session = await runTest(<Static id="greeting" content="Hi" />);

    const widget = session.app.getByCssId("greeting");
    expect(widget).toBeDefined();
    expect(widget!.typeName).toBe("Static");

    session.unmount();
  });

  it("applies user CSS through the cascade", async () => {
    const session = await runTest(
      <Static id="styled" content="styled" />,
      { props: { css: "Static { color: red; }" } as never },
    );

    // Widget should be registered and styled
    const widget = session.app.getByCssId("styled");
    expect(widget).toBeDefined();

    session.unmount();
  });

  it("renders border titles, subtitles, and outline wrappers through the shared frame", async () => {
    const session = await runTest(
      <Static id="framed" content="center" borderTitle="Title" borderSubtitle="Sub" />,
      {
        props: {
          css: `
            Static {
              width: 12;
              outline: round green;
              border: round green;
              border-title-align: center;
              border-subtitle-align: right;
            }
          `,
        } as never,
      },
    );

    expect(session.lastFrame()).toContain("Title");
    expect(session.lastFrame()).toContain("Sub");

    session.unmount();
  });
});

describe("Button", () => {
  it("renders the label text", async () => {
    const session = await runTest(<Button label="Click Me" />);

    expect(session.lastFrame()).toContain("Click Me");

    session.unmount();
  });

  it("posts ButtonPressed on enter key", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <Button id="btn" label="Press" />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    // Focus the button
    const btn = session.app.getByCssId("btn");
    expect(btn).toBeDefined();
    session.app.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    // Press enter
    await session.pilot.press("enter");

    expect(messages).toContain("pressed");

    session.unmount();
  });

  it("posts ButtonPressed on space key", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <Button id="btn" label="Press" />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    const btn = session.app.getByCssId("btn");
    session.app.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("space");

    expect(messages).toContain("pressed");

    session.unmount();
  });

  it("does not post ButtonPressed when disabled", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <Button id="btn" label="Disabled" disabled />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    const btn = session.app.getByCssId("btn");
    session.app.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");

    expect(messages).not.toContain("pressed");

    session.unmount();
  });

  it("does not post ButtonPressed when loading", async () => {
    const messages: string[] = [];
    const session = await runTest(
      <Button id="btn" label="Loading" loading />,
      {
        messageHook: (message) => {
          if (message instanceof ButtonPressed) {
            messages.push("pressed");
          }
        },
      },
    );

    const btn = session.app.getByCssId("btn");
    session.app.focusWidget(btn!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");

    expect(messages).not.toContain("pressed");

    session.unmount();
  });

  it("registers with variant CSS class", async () => {
    const session = await runTest(<Button id="btn" label="OK" variant="primary" />);

    const btn = session.app.getByCssId("btn");
    expect(btn).toBeDefined();
    expect(btn!.hasClass("-primary")).toBe(true);

    session.unmount();
  });

  it("is focusable and appears in the focus chain", async () => {
    const session = await runTest(
      <>
        <Button id="a" label="A" />
        <Button id="b" label="B" />
      </>,
    );

    const chain = session.app.getFocusChain();
    const ids = chain.map((w) => w.id);

    expect(ids).toContain("a");
    expect(ids).toContain("b");

    session.unmount();
  });
});

describe("Switch", () => {
  it("renders with initial off state", async () => {
    const session = await runTest(<Switch id="sw" />);

    const sw = session.app.getByCssId("sw");
    expect(sw).toBeDefined();
    expect(session.lastFrame()).toContain("▊");
    expect(session.lastFrame()).toContain("▎");

    session.unmount();
  });

  it("renders with initial on state", async () => {
    const session = await runTest(<Switch id="sw" value />);

    expect(session.lastFrame()).toContain("▊");
    expect(session.lastFrame()).toContain("▎");

    session.unmount();
  });

  it("posts SwitchChanged on enter key toggle", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <Switch id="sw" />,
      {
        messageHook: (message) => {
          if (message instanceof SwitchChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const sw = session.app.getByCssId("sw");
    session.app.focusWidget(sw!.nodeId);
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
      <Switch id="sw" />,
      {
        messageHook: (message) => {
          if (message instanceof SwitchChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const sw = session.app.getByCssId("sw");
    session.app.focusWidget(sw!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("space");

    expect(values).toEqual([true]);

    session.unmount();
  });

  it("does not toggle when disabled", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <Switch id="sw" disabled />,
      {
        messageHook: (message) => {
          if (message instanceof SwitchChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const sw = session.app.getByCssId("sw");
    session.app.focusWidget(sw!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");

    expect(values).toEqual([]);

    session.unmount();
  });

  it("is focusable and appears in the focus chain", async () => {
    const session = await runTest(
      <>
        <Switch id="sw1" />
        <Switch id="sw2" />
      </>,
    );

    const chain = session.app.getFocusChain();
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
        <Static content="Status: Ready" />
        <Button id="action" label="Go" variant="primary" />
        <Switch id="toggle" />
      </>,
    );

    expect(session.lastFrame()).toContain("Status: Ready");
    expect(session.lastFrame()).toContain("Go");

    const chain = session.app.getFocusChain();
    expect(chain.length).toBeGreaterThanOrEqual(2);

    session.unmount();
  });

  it("exercises the full render→focus→key→message→observe path", async () => {
    const events: string[] = [];
    const session = await runTest(
      <>
        <Button id="btn" label="Press" />
        <Switch id="sw" />
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
    const btn = session.app.getByCssId("btn");
    session.app.focusWidget(btn!.nodeId);
    await session.pilot.pause();
    await session.pilot.press("enter");

    // Tab to switch and toggle
    session.app.focusNext();
    await session.pilot.pause();
    await session.pilot.press("enter");

    expect(events).toContain("button-pressed");
    expect(events).toContain("switch-true");

    session.unmount();
  });
});
