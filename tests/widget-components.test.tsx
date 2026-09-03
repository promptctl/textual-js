import React from "react";
import { Segment, type Measurable, type RenderOptions, type Renderable } from "rich-js";
import stripAnsi from "strip-ansi";
import { describe, expect, it, vi } from "vitest";

import * as textual from "../src/index.js";
import {
  ButtonPressed,
  Button,
  Checkbox,
  Color,
  Label,
  ProgressBar,
  RadioButton,
  RadioSet,
  RadioSetChanged,
  Sparkline,
  Static,
  SwitchChanged,
  Switch,
  ToggleChanged,
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
    expect(textual.Label).toBe(Label);
    expect(textual.Static).toBe(Static);
    expect(textual.Switch).toBe(Switch);
    expect("ButtonWidget" in textual).toBe(false);
    expect("LabelWidget" in textual).toBe(false);
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
    const session = await runTest(<Static id="styled" content="styled" />, {
      appProps: { css: "Static { color: red; }" },
    });

    const widget = session.app.getByCssId("styled")!;
    expect(widget.resolvedStyles.getRule("color")).toEqual(Color.parse("red"));

    session.unmount();
  });

  it("renders border titles, subtitles, and outline wrappers through the shared frame", async () => {
    const session = await runTest(
      <Static id="framed" content="center" borderTitle="Title" borderSubtitle="Sub" />,
      {
        appProps: {
          css: `
            Static {
              width: 12;
              outline: round green;
              border: round green;
              border-title-align: center;
              border-subtitle-align: right;
            }
          `,
        },
      },
    );

    expect(session.lastFrame()).toContain("Title");
    expect(session.lastFrame()).toContain("Sub");

    session.unmount();
  });
});

describe("Label", () => {
  it("renders text content", async () => {
    const session = await runTest(<Label content="Hello Label" />);

    expect(stripAnsi(session.lastFrame() ?? "").trimEnd()).toBe("Hello Label");

    session.unmount();
  });

  it("renders Rich markup through the Visual seam", async () => {
    const session = await runTest(
      <Label content="[bold #55ffff]Label[/] with [italic #ff55ff]markup[/]" />,
    );

    const frame = session.lastFrame() ?? "";
    expect(stripAnsi(frame).trimEnd()).toBe("Label with markup");
    expect(frame).toContain("38;2;85;255;255");
    expect(frame).toContain("38;2;255;85;255");

    session.unmount();
  });

  it("registers with the framework as typeName Label", async () => {
    const session = await runTest(<Label id="greeting" content="Hi" />);

    expect(session.app.getByCssId("greeting")!.typeName).toBe("Label");

    session.unmount();
  });

  it("is targetable by a Label type selector", async () => {
    const session = await runTest(<Label id="styled" content="styled" />, {
      appProps: { css: "Label { color: red; }" },
    });

    const widget = session.app.getByCssId("styled")!;
    expect(widget.resolvedStyles.getRule("color")).toEqual(Color.parse("red"));

    session.unmount();
  });

  // Textual's Label subclasses Static, so a Static rule cascades onto it.
  it("inherits CSS written against its Static base type", async () => {
    const session = await runTest(<Label id="inheriting" content="styled" />, {
      appProps: { css: "Static { color: magenta; }" },
    });

    const widget = session.app.getByCssId("inheriting")!;
    expect(widget.resolvedStyles.getRule("color")).toEqual(Color.parse("magenta"));

    session.unmount();
  });

  it("does not take focus", async () => {
    const session = await runTest(<Label id="unfocusable" content="text" />);

    expect(session.app.getByCssId("unfocusable")!.canFocus).toBe(false);

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

// Sparkline paints forty per-cell colours through one Content, so a regression
// in span construction shows up as colours flattening rather than as a crash.
// Both expectations are read off visual-tests/snapshots/python/sparkline_basic.ansi,
// which records the same captured frame the pixel gate's .png comes from.
describe("Sparkline", () => {
  const DATA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const CSS = "Sparkline { width: 40; height: 3; }";

  it("renders Python's glyph grid", async () => {
    const session = await runTest(<Sparkline id="sl" data={DATA} />, {
      appProps: { css: CSS },
    });

    expect(stripAnsi(session.lastFrame() ?? "").split("\n").slice(0, 3)).toEqual([
      "                            ▂▂▂▂▅▅▅▅████",
      "                ▃▃▃▃▅▅▅▅████████████████",
      "▁▁▁▁▃▃▃▃▆▆▆▆████████████████████████████",
    ]);

    session.unmount();
  });

  it("gives each bucket its own truecolour, not a quantised palette", async () => {
    const session = await runTest(<Sparkline id="sl" data={DATA} />, {
      appProps: { css: CSS },
    });

    const bottomRow = (session.lastFrame() ?? "").split("\n")[2];

    // The min and max ends of the blend, emitted as 24-bit ANSI. Ink's <Text>
    // would have reached chalk and landed both on the 16-colour palette.
    expect(bottomRow).toContain("[38;2;12;48;76m");
    expect(bottomRow).toContain("[38;2;1;120;212m");

    // Ten buckets, ten distinct colours — a row painted in one colour would
    // still pass the glyph assertion above.
    const colours = new Set(bottomRow.match(/\[38;2;\d+;\d+;\d+m/g) ?? []);
    expect(colours.size).toBe(10);

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

describe("ProgressBar", () => {
  it("renders the percentage label for determinate progress", async () => {
    const session = await runTest(
      <ProgressBar id="pb" total={100} progress={50} showEta={false} />,
    );

    expect(session.lastFrame()).toContain("50%");

    session.unmount();
  });

  it("registers with the framework as typeName ProgressBar", async () => {
    const session = await runTest(
      <ProgressBar id="pb" total={100} progress={25} showEta={false} />,
    );

    const widget = session.app.getByCssId("pb");
    expect(widget).toBeDefined();
    expect(widget!.typeName).toBe("ProgressBar");

    session.unmount();
  });

  it("renders 100% at completion and 0% when empty", async () => {
    const full = await runTest(
      <ProgressBar id="full" total={100} progress={100} showEta={false} />,
    );
    expect(full.lastFrame()).toContain("100%");
    full.unmount();

    const empty = await runTest(
      <ProgressBar id="empty" total={100} progress={0} showEta={false} />,
    );
    expect(empty.lastFrame()).toContain("0%");
    empty.unmount();
  });

  it("renders --% in indeterminate mode (total=null)", async () => {
    const session = await runTest(
      <ProgressBar id="pb" total={null} showEta={false} />,
    );

    expect(session.lastFrame()).toContain("--%");

    session.unmount();
  });

  // The subtlest frame in the widget, and the one that was built wrong first:
  // a stale local baseline recorded a leading `╺` over rail, where Textual with
  // animations off paints the whole bar in $error. Only the pixel gate caught
  // that, so the wiring from `percentage === null` to a full-width highlight is
  // pinned here too.
  it("paints an indeterminate bar fully highlighted", async () => {
    const session = await runTest(
      <ProgressBar id="pb" total={null} showEta={false} />,
    );

    const frame = session.lastFrame() ?? "";
    expect(stripAnsi(frame).split("\n")[0]).toBe(`${"━".repeat(32)}  --%`);
    expect(frame).toContain("[38;2;185;60;91m");

    session.unmount();
  });

  it("applies the -indeterminate class when total is null", async () => {
    const session = await runTest(
      <ProgressBar id="pb" total={null} showEta={false} />,
    );

    const widget = session.app.getByCssId("pb");
    expect(widget!.classes).toContain("-indeterminate");

    session.unmount();
  });

  // Pins the quantization end to end, where the renderBar tests only pin the
  // rendering: Textual truncates 53% onto 33/64, so the fill stops mid-cell on
  // a `╸` at column 16 rather than filling 17 whole cells.
  it("truncates a fractional percentage onto Textual's half-cell lattice", async () => {
    const session = await runTest(
      <ProgressBar id="pb" total={100} progress={53} showEta={false} />,
    );

    const row = stripAnsi(session.lastFrame() ?? "").split("\n")[0];
    expect(row).toBe(`${"━".repeat(16)}╸${"━".repeat(15)}  53%`);

    session.unmount();
  });

  it("applies the -complete class when progress reaches total", async () => {
    const session = await runTest(
      <ProgressBar id="pb" total={100} progress={100} showEta={false} />,
    );

    const widget = session.app.getByCssId("pb");
    expect(widget!.classes).toContain("-complete");

    session.unmount();
  });
});

describe("Checkbox", () => {
  it("renders the label and unchecked indicator by default", async () => {
    const session = await runTest(<Checkbox id="cb" label="Accept" />);

    const frame = session.lastFrame();
    expect(frame).toContain("Accept");
    expect(frame).toContain("▐ ▌");

    session.unmount();
  });

  it("renders the X indicator when value is true", async () => {
    const session = await runTest(<Checkbox id="cb" label="Accept" value />);

    expect(session.lastFrame()).toContain("▐X▌");

    session.unmount();
  });

  it("applies the -on class when value is true", async () => {
    const session = await runTest(<Checkbox id="cb" label="Accept" value />);

    const widget = session.app.getByCssId("cb");
    expect(widget!.classes).toContain("-on");

    session.unmount();
  });

  it("registers with the framework as typeName Checkbox", async () => {
    const session = await runTest(<Checkbox id="cb" label="Accept" />);

    const widget = session.app.getByCssId("cb");
    expect(widget!.typeName).toBe("Checkbox");

    session.unmount();
  });

  it("posts ToggleChanged on enter key toggle", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <Checkbox id="cb" label="Accept" />,
      {
        messageHook: (message) => {
          if (message instanceof ToggleChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const cb = session.app.getByCssId("cb");
    session.app.focusWidget(cb!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");
    expect(values).toEqual([true]);

    await session.pilot.press("space");
    expect(values).toEqual([true, false]);

    session.unmount();
  });

  it("does not toggle when disabled", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <Checkbox id="cb" label="Accept" disabled />,
      {
        messageHook: (message) => {
          if (message instanceof ToggleChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const cb = session.app.getByCssId("cb");
    session.app.focusWidget(cb!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");
    expect(values).toEqual([]);

    session.unmount();
  });

  it("is focusable and appears in the focus chain", async () => {
    const session = await runTest(
      <>
        <Checkbox id="cb1" label="One" />
        <Checkbox id="cb2" label="Two" />
      </>,
    );

    const chain = session.app.getFocusChain();
    const ids = chain.map((w) => w.id);

    expect(ids).toContain("cb1");
    expect(ids).toContain("cb2");

    session.unmount();
  });
});

describe("RadioButton", () => {
  it("renders the label and unselected indicator by default", async () => {
    const session = await runTest(<RadioButton id="rb" label="Option" />);

    const frame = session.lastFrame();
    expect(frame).toContain("Option");
    expect(frame).toContain("▐ ▌");

    session.unmount();
  });

  it("renders the ● indicator when value is true", async () => {
    const session = await runTest(<RadioButton id="rb" label="Option" value />);

    expect(session.lastFrame()).toContain("▐●▌");

    session.unmount();
  });

  it("applies the -on class when value is true", async () => {
    const session = await runTest(<RadioButton id="rb" label="Option" value />);

    const widget = session.app.getByCssId("rb");
    expect(widget!.classes).toContain("-on");

    session.unmount();
  });

  it("registers with the framework as typeName RadioButton", async () => {
    const session = await runTest(<RadioButton id="rb" label="Option" />);

    const widget = session.app.getByCssId("rb");
    expect(widget!.typeName).toBe("RadioButton");

    session.unmount();
  });

  it("posts ToggleChanged on enter key toggle", async () => {
    const values: boolean[] = [];
    const session = await runTest(
      <RadioButton id="rb" label="Option" />,
      {
        messageHook: (message) => {
          if (message instanceof ToggleChanged) {
            values.push(message.value);
          }
        },
      },
    );

    const rb = session.app.getByCssId("rb");
    session.app.focusWidget(rb!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("enter");
    expect(values).toEqual([true]);

    session.unmount();
  });
});

describe("RadioSet", () => {
  it("renders all button labels in the rendered frame", async () => {
    const session = await runTest(
      <RadioSet id="rs" buttons={["Alpha", "Beta", "Gamma"]} />,
    );

    const frame = session.lastFrame();
    expect(frame).toContain("Alpha");
    expect(frame).toContain("Beta");
    expect(frame).toContain("Gamma");

    session.unmount();
  });

  it("renders the ● indicator for the pre-selected button", async () => {
    const session = await runTest(
      <RadioSet
        id="rs"
        buttons={[
          { label: "A" },
          { label: "B", value: true },
          { label: "C" },
        ]}
      />,
    );

    expect(session.lastFrame()).toContain("▐●▌");

    session.unmount();
  });

  it("registers with the framework as typeName RadioSet", async () => {
    const session = await runTest(<RadioSet id="rs" buttons={["A"]} />);

    const widget = session.app.getByCssId("rs");
    expect(widget!.typeName).toBe("RadioSet");

    session.unmount();
  });

  it("is the single tab stop — child rows are not separate widgets", async () => {
    const session = await runTest(
      <RadioSet id="rs" buttons={["A", "B", "C"]} />,
    );

    const chain = session.app.getFocusChain();
    const ids = chain.map((w) => w.id);

    expect(ids).toContain("rs");

    session.unmount();
  });

  it("posts RadioSetChanged when a new button is pressed", async () => {
    const events: Array<{ index: number; label: string }> = [];
    const session = await runTest(
      <RadioSet id="rs" buttons={["A", "B", "C"]} />,
      {
        messageHook: (message) => {
          if (message instanceof RadioSetChanged) {
            events.push({ index: message.index, label: message.pressed.label.plain });
          }
        },
      },
    );

    const rs = session.app.getByCssId("rs");
    session.app.focusWidget(rs!.nodeId);
    await session.pilot.pause();

    await session.pilot.press("down");
    expect(events).toEqual([{ index: 0, label: "A" }]);

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
