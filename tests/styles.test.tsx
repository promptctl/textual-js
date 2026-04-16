import React from "react";
import { Box, Text } from "ink";
import { observer } from "mobx-react-lite";
import { describe, expect, it } from "vitest";

import {
  Key,
  Size,
  TextualApp,
  TextualFramework,
  WidgetNode,
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
  const background = String(styles.rules.get("background") ?? "none");
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

describe("styles and useStyles", () => {
  it("resolves DEFAULT_CSS and user CSS into Ink-compatible props with cascade ordering", async () => {
    const framework = new TextualFramework();

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

    const styled = framework.registry.getByCssId("styled") as WidgetNode;

    expect(styled.resolvedStyles.getRule("background")).toBe("yellow");
    expect(styled.resolvedStyles.getRule("color")).toBe("white");
    expect(styled.resolvedStyles.box.paddingLeft).toBe(2);
    expect(styled.resolvedStyles.box.paddingTop).toBe(1);
    expect(styled.resolvedStyles.box.borderStyle).toBe("round");
    expect(styled.resolvedStyles.box.borderColor).toBe("magenta");
    expect(styled.resolvedStyles.box.width).toBe(12);
    expect(styled.resolvedStyles.text.color).toBe("white");
    expect(instance.lastFrame()).toContain("styled:");

    instance.unmount();
    instance.cleanup();
  });

  it("recalculates styles on class mutation, resolves inherited custom properties, and rerenders useStyles consumers", async () => {
    const framework = new TextualFramework();
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

    const dynamic = framework.registry.getByCssId("dynamic") as WidgetNode;

    expect(dynamic.resolvedStyles.getRule("background")).toBe("tomato");
    expect(instance.lastFrame()).toContain("dynamic:");

    dynamic.addClass("active");
    await framework.whenIdle();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dynamic.resolvedStyles.getRule("background")).toBe("rebeccapurple");
    expect(renders.some((entry) => entry.startsWith("rebeccapurple@"))).toBe(true);

    instance.unmount();
    instance.cleanup();
  });

  it("hides visibility-hidden output while routing input to visible widgets", async () => {
    const framework = new TextualFramework();
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
    const framework = new TextualFramework();

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

    const viewport = framework.registry.getByCssId("viewport") as WidgetNode;

    expect(viewport.resolvedStyles.box.width).toBe(100);
    expect(viewport.resolvedStyles.box.height).toBe(20);

    instance.unmount();
    instance.cleanup();
  });
});
