import { App } from "../src/index.js";
import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";
import { describe, expect, it } from "vitest";

import {
  Key,
  Color,
  colorToInkValue,
  normalizeColor,
  normalizeStyleAssignment,
  Styles,
  Scalar,
  Size,
  TextualApp,
  Unit,
  WidgetHost,
  Widget,
  WidgetScope,
  useStyles,
  useWidget,
} from "../src/index.js";
import { render } from "ink-testing-library";

const StyledLabel = observer(function StyledLabel(props: {
  id?: string;
  classes?: string;
  label: string;
  defaultCss?: string;
  focusable?: boolean;
  onRender?: (backgroundAndVersion: string) => void;
}): React.JSX.Element {
  const widget = useWidget({
    id: props.id,
    classes: props.classes,
    typeName: "StyledLabel",
    defaultCss: props.defaultCss,
    focusable: props.focusable,
  });
  const styles = useStyles(widget.handle);
  const styleVersion = styles.version;
  const background = colorToInkValue(styles.rules.get("background") as Color | string | undefined) ?? "none";
  props.onRender?.(`${background}@${styleVersion}`);

  return (
    <Box {...styles.box}>
      <Text {...styles.text}>{`${props.label}:${background}:${styleVersion}`}</Text>
    </Box>
  );
});

function StyledRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  const widget = useWidget({
    id: "styled-root",
    typeName: "StyledRoot",
    defaultCss: `
      StyledRoot {
        --accent: tomato;
      }
    `,
  });

  return <WidgetScope widget={widget.handle}>{children}</WidgetScope>;
}

const VisibilityLabel = observer(function VisibilityLabel(props: {
  id: string;
  label: string;
  focusable?: boolean;
  autoFocus?: boolean;
  onKey?: () => void;
}): React.JSX.Element {
  const widget = useWidget({
    id: props.id,
    typeName: "VisibilityLabel",
    focusable: props.focusable,
    autoFocus: props.autoFocus,
    handlers: props.onKey === undefined ? undefined : { onKey: props.onKey as (event: Key) => void },
  });

  return (
    <WidgetScope widget={widget.handle}>
      <Text>{props.label}</Text>
    </WidgetScope>
  );
});

class StyleBase {}

class StyleDerived extends StyleBase {}

const DerivedStyledLabel = observer(function DerivedStyledLabel(props: {
  id: string;
  label: string;
}): React.JSX.Element {
  const widget = useWidget({
    id: props.id,
    typeName: "DerivedStyledLabel",
    typeToken: StyleDerived,
  });
  const styles = useStyles(widget.handle);

  return (
    <Box {...styles.box}>
      <Text {...styles.text}>{props.label}</Text>
    </Box>
  );
});

describe("styles and useStyles", () => {
  it("resolves DEFAULT_CSS and user CSS into Ink-compatible props with cascade ordering", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          .accent {
            background: yellow !important;
          }

          #styled {
            background: green;
            color: white;
          }
        `}
      >
        <StyledLabel
          id="styled"
          classes="accent"
          label="styled"
          defaultCss={`
            StyledLabel {
              background: blue;
              color: red;
              padding: 1 2;
              border: round magenta;
              width: 12;
            }
          `}
        />
      </TextualApp>,
    );

    await framework.whenIdle();
    await Promise.resolve();

    const styled = framework.registry.getByCssId("styled") as Widget;

    expect(styled.resolvedStyles.getRule("background")).toEqual(Color.parse("yellow"));
    expect(styled.resolvedStyles.getRule("color")).toEqual(Color.parse("white"));
    expect(styled.resolvedStyles.box.paddingLeft).toBe(2);
    expect(styled.resolvedStyles.box.paddingTop).toBe(1);
    expect(styled.resolvedStyles.box.borderStyle).toBe("round");
    expect(styled.resolvedStyles.box.borderColor).toBe(normalizeColor("magenta"));
    expect(styled.resolvedStyles.box.width).toBe(12);
    expect(styled.resolvedStyles.text.color).toBe(normalizeColor("white"));
    expect(instance.lastFrame().replace(/[│╭╮╰╯─\s]/g, "")).toContain("styled:#ffff00:4");

    instance.unmount();
    instance.cleanup();
  });

  it("recalculates styles on class mutation, resolves inherited custom properties, and rerenders useStyles consumers", async () => {
    const framework = new App().framework;
    const renders: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          StyledRoot StyledLabel {
            background: var(--accent);
            color: white;
          }

          .active {
            background: rebeccapurple;
          }
        `}
      >
        <StyledRoot>
          <StyledLabel
            id="dynamic"
            label="dynamic"
            focusable
            onRender={(backgroundAndVersion) => {
              renders.push(backgroundAndVersion);
            }}
          />
        </StyledRoot>
      </TextualApp>,
    );

    await framework.whenIdle();

    const dynamic = framework.registry.getByCssId("dynamic") as Widget;

    expect(dynamic.resolvedStyles.getRule("background")).toEqual(Color.parse("tomato"));
    expect(instance.lastFrame()).toContain("dynamic:");

    dynamic.addClass("active");
    await framework.whenIdle();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dynamic.resolvedStyles.getRule("background")).toEqual(Color.parse("rebeccapurple"));
    expect(renders.some((entry) => entry.startsWith(`${normalizeColor("rebeccapurple")}@`))).toBe(true);

    instance.unmount();
    instance.cleanup();
  });

  it("applies DEFAULT_CSS class selectors to the widget itself", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <StyledLabel
          id="self-scoped"
          classes="active"
          label="self"
          defaultCss={`
            .active {
              background: orange;
            }
          `}
        />
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.getByCssId("self-scoped") as Widget;

    expect(widget.resolvedStyles.getRule("background")).toEqual(Color.parse("orange"));

    instance.unmount();
    instance.cleanup();
  });

  it("treats widget.styles as a first-class Styles surface and supports class assignment properties", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <StyledLabel id="styles-surface" label="styles" />
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.getByCssId("styles-surface") as Widget;
    const inlineStyles = widget.styles as Styles;

    inlineStyles.set_rule("background", "red");
    (widget as Widget & { classes: string }).classes = "alpha beta";
    await framework.whenIdle();

    expect(inlineStyles.has_rule("background")).toBe(true);
    expect(inlineStyles.get_rules()).toMatchObject({ background: "red" });
    expect(widget.hasClass("alpha")).toBe(true);
    expect(widget.hasClass("beta")).toBe(true);

    inlineStyles.clear_rule("background");
    inlineStyles.merge_rules({ color: "white" });
    await framework.whenIdle();

    expect(inlineStyles.has_rule("background")).toBe(false);
    expect(widget.resolvedStyles.getRule("color")).toEqual(Color.parse("white"));

    instance.unmount();
    instance.cleanup();
  });

  it("lets user CSS beat DEFAULT_CSS important declarations and walks inherited initial defaults", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          DerivedStyledLabel {
            color: initial;
            background: green;
          }
        `}
      >
        <WidgetHost
          id="base-default"
          typeName="BaseStyledLabel"
          typeToken={StyleBase}
          defaultCss={`
            BaseStyledLabel {
              color: magenta;
              background: red !important;
            }
          `}
        >
          <DerivedStyledLabel id="derived-default" label="derived" />
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    const derived = framework.registry.getByCssId("derived-default") as Widget;

    expect(derived.resolvedStyles.getRule("color")).toEqual(Color.parse("magenta"));
    expect(derived.resolvedStyles.getRule("background")).toEqual(Color.parse("green"));

    instance.unmount();
    instance.cleanup();
  });

  it("scopes DEFAULT_CSS by first selector token instead of raw prefix text", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost
          id="button-scope"
          typeName="Button"
          defaultCss={`
            ButtonGroup {
              background: red;
            }

            .active {
              color: white;
            }
          `}
          classes="active"
        >
          <Text>scope</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.getByCssId("button-scope") as Widget;

    expect(widget.resolvedStyles.getRule("background")).toBeUndefined();
    expect(widget.resolvedStyles.getRule("color")).toEqual(Color.parse("white"));

    instance.unmount();
    instance.cleanup();
  });

  it("applies nested selectors and lets inline styles override the cascade", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          StyledRoot {
            StyledLabel {
              background: tomato;

              &.active {
                background: rebeccapurple;
              }
            }
          }
        `}
      >
        <StyledRoot>
          <StyledLabel id="inline" classes="active" label="inline" />
        </StyledRoot>
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.getByCssId("inline") as Widget;

    expect(widget.resolvedStyles.getRule("background")).toEqual(Color.parse("rebeccapurple"));

    widget.setInlineStyle("background", "green");
    await framework.whenIdle();

    expect(widget.resolvedStyles.getRule("background")).toEqual(Color.parse("green"));

    instance.unmount();
    instance.cleanup();
  });

  it("resolves important shorthand declarations against more specific longhands", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          StyledLabel {
            border: round green !important;
            padding: 10 20 30 40 !important;
            align: right bottom !important;
            overflow: hidden hidden !important;
            scrollbar-size: 23 42 !important;
          }

          #cascade.more-specific {
            border-left: solid red;
            padding-left: 1;
            align: center middle;
            overflow: scroll scroll;
            scrollbar-size: 1 2;
          }
        `}
      >
        <StyledLabel id="cascade" classes="more-specific" label="cascade" />
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.getByCssId("cascade") as Widget;

    expect(widget.resolvedStyles.getRule("border-left")).toEqual({ style: "round", color: Color.parse("green") });
    expect(widget.resolvedStyles.box.borderColor).toBe(normalizeColor("green"));
    expect(widget.resolvedStyles.box.paddingRight).toBe(20);
    expect(widget.resolvedStyles.box.paddingLeft).toBe(40);
    expect(widget.resolvedStyles.box.justifyContent).toBe("flex-end");
    expect(widget.resolvedStyles.box.alignItems).toBe("flex-end");
    expect(widget.resolvedStyles.getRule("overflow")).toEqual({ x: "hidden", y: "hidden" });
    expect(widget.resolvedStyles.getRule("scrollbar-size")).toEqual([23, 42]);

    instance.unmount();
    instance.cleanup();
  });

  it("resolves initial through DEFAULT_CSS and carries custom properties through inline overrides", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          StyledRoot StyledLabel {
            background: var(--accent);
          }

          #initial {
            color: initial;
          }
        `}
      >
        <StyledRoot>
          <StyledLabel
            id="initial"
            label="initial"
            defaultCss={`
              StyledLabel {
                color: magenta;
              }
            `}
          />
        </StyledRoot>
      </TextualApp>,
    );

    await framework.whenIdle();

    const root = framework.registry.getByCssId("styled-root") as Widget;
    const child = framework.registry.getByCssId("initial") as Widget;

    expect(child.resolvedStyles.getRule("color")).toEqual(Color.parse("magenta"));
    expect(child.resolvedStyles.getRule("background")).toEqual(Color.parse("tomato"));

    root.setInlineStyle("--accent", "rebeccapurple");
    await framework.whenIdle();

    expect(child.resolvedStyles.getRule("background")).toEqual(Color.parse("rebeccapurple"));

    instance.unmount();
    instance.cleanup();
  });

  it("recomputes pseudo-class selectors from canonical registry state", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          StyledRoot > StyledLabel:first-child {
            background: red;
          }

          StyledRoot > StyledLabel:last-child {
            color: blue;
          }

          StyledLabel:empty {
            border: round green;
          }
        `}
      >
        <StyledRoot>
          <StyledLabel id="first-pseudo" label="first" />
          <StyledLabel id="last-pseudo" label="last" />
        </StyledRoot>
      </TextualApp>,
    );

    await framework.whenIdle();

    const first = framework.registry.getByCssId("first-pseudo") as Widget;
    const last = framework.registry.getByCssId("last-pseudo") as Widget;

    expect(first.resolvedStyles.getRule("background")).toEqual(Color.parse("red"));
    expect(last.resolvedStyles.getRule("color")).toEqual(Color.parse("blue"));
    expect(first.resolvedStyles.getRule("border")).toEqual({ style: "round", color: Color.parse("green") });

    instance.unmount();
    instance.cleanup();
  });

  it("hides visibility-hidden output while routing input to visible widgets", async () => {
    const framework = new App().framework;
    const received: string[] = [];

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          #hidden {
            visibility: hidden;
          }
        `}
      >
        <VisibilityLabel
          id="hidden"
          label="hidden"
          focusable
          autoFocus
          onKey={() => {
            received.push("hidden");
          }}
        />
        <VisibilityLabel
          id="visible"
          label="visible"
          focusable
          onKey={() => {
            received.push("visible");
          }}
        />
      </TextualApp>,
    );

    await framework.whenIdle();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(instance.lastFrame()).toContain("visible");
    expect(instance.lastFrame()).not.toContain("hidden");

    framework.postKey("x");
    await framework.whenIdle();

    expect(received).toEqual(["visible"]);

    instance.unmount();
    instance.cleanup();
  });

  it("resolves viewport units against terminal size instead of parent percentages", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          #viewport {
            width: 50vw;
            height: 25vh;
          }
        `}
      >
        <StyledLabel id="viewport" label="viewport" />
      </TextualApp>,
    );

    framework.setTerminalSize(new Size(200, 80));
    await framework.whenIdle();

    const viewport = framework.registry.getByCssId("viewport") as Widget;

    expect(viewport.resolvedStyles.box.width).toBe(100);
    expect(viewport.resolvedStyles.box.height).toBe(20);

    instance.unmount();
    instance.cleanup();
  });

  it("translates the Stage 2 resolved value model to Ink props", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp
        framework={framework}
        stylesheet={`
          #bridge {
            margin-top: 2;
            padding-left: 3;
            background: #010203;
            color: #fefefe;
            text-style: bold underline reverse;
            text-wrap: ellipsis;
            opacity: 0.5;
            align: right bottom;
          }
        `}
      >
        <StyledLabel id="bridge" label="bridge" />
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.getByCssId("bridge") as Widget;

    expect(widget.resolvedStyles.box.marginTop).toBe(2);
    expect(widget.resolvedStyles.box.paddingLeft).toBe(3);
    expect(widget.resolvedStyles.box.backgroundColor).toBe(normalizeColor("#010203"));
    expect(widget.resolvedStyles.box.justifyContent).toBe("flex-end");
    expect(widget.resolvedStyles.box.alignItems).toBe("flex-end");
    expect(widget.resolvedStyles.text.color).toBe(normalizeColor("#fefefe"));
    expect(widget.resolvedStyles.text.backgroundColor).toBe(normalizeColor("#010203"));
    expect(widget.resolvedStyles.text.bold).toBe(true);
    expect(widget.resolvedStyles.text.underline).toBe(true);
    expect(widget.resolvedStyles.text.inverse).toBe(true);
    expect(widget.resolvedStyles.text.wrap).toBe("truncate-end");
    expect(widget.resolvedStyles.text.dimColor).toBe(true);
    expect(widget.resolvedStyles.style.bold).toBe(true);
    expect(widget.resolvedStyles.components).toBeDefined();

    instance.unmount();
    instance.cleanup();
  });

  it("normalizes programmatic style assignments through the public styles surface", async () => {
    const framework = new App().framework;

    const instance = render(
      <TextualApp framework={framework}>
        <StyledLabel id="programmatic" label="programmatic" />
      </TextualApp>,
    );

    await framework.whenIdle();

    const widget = framework.registry.getByCssId("programmatic") as Widget;
    widget.styles.width = "25%";
    widget.styles.grid_columns = [new Scalar(1, Unit.FRACTION, Unit.PERCENT), new Scalar(50, Unit.PERCENT, Unit.PERCENT)];
    await framework.whenIdle();

    expect(widget.resolvedStyles.getRule("width")).toEqual(new Scalar(25, Unit.WIDTH, Unit.WIDTH));
    expect(widget.resolvedStyles.getRule("grid-columns")).toEqual([
      new Scalar(1, Unit.FRACTION, Unit.WIDTH),
      new Scalar(50, Unit.WIDTH, Unit.WIDTH),
    ]);
    expect(() => normalizeStyleAssignment("width", {} as never)).toThrow();

    instance.unmount();
    instance.cleanup();
  });

  it("rejects conflicting DEFAULT_CSS declarations for the same widget type", () => {
    const framework = new App().framework;

    framework.registerWidgetType("ConflictedLabel", "ConflictedLabel { color: red; }");

    expect(() => {
      framework.registerWidgetType("ConflictedLabel", "ConflictedLabel { color: blue; }");
    }).toThrow(/conflicting DEFAULT_CSS/);
  });
});
