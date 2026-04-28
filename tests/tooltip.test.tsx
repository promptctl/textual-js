import React, { useLayoutEffect, useState } from "react";
import { Segment, type Measurable, type RenderOptions, type Renderable } from "rich-js";
import { Box, Text } from "ink";
import { describe, expect, it, vi } from "vitest";

import { WidgetScope, type VisualInput, type Widget, runTest, useWidget } from "../src/index.js";

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

function TooltipLeaf(props: {
  id: string;
  label: string;
  tooltip?: VisualInput | null;
  onReady?: (widget: Widget) => void;
}): React.JSX.Element {
  const widget = useWidget({
    typeName: "TooltipLeaf",
    id: props.id,
    tooltip: props.tooltip ?? null,
  });

  useLayoutEffect(() => {
    props.onReady?.(widget.handle);
  }, [props, widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Box width={8} height={1}>
        <Text>{props.label}</Text>
      </Box>
    </WidgetScope>
  );
}

function ToggleTooltipHarness(props: {
  onWidgetReady?: (widget: Widget) => void;
  onToggleReady?: (setMounted: (mounted: boolean) => void) => void;
}): React.JSX.Element {
  const [mounted, setMounted] = useState(true);

  useLayoutEffect(() => {
    props.onToggleReady?.((nextMounted) => {
      setMounted(nextMounted);
    });
  }, [props]);

  return mounted ? <TooltipLeaf id="target" label="leaf" tooltip="details" onReady={props.onWidgetReady} /> : <Text>gone</Text>;
}

describe("tooltip and hover lifecycle", () => {
  it("sets :hover from pointer movement and clears it when the pointer leaves", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip="details" />);
    const widget = session.app.getByCssId("target")!;

    expect(widget.hasPseudoClass("hover")).toBe(false);

    await session.pilot.hover("#target");
    expect(widget.hasPseudoClass("hover")).toBe(true);

    await session.pilot.hover({ offset: { x: 79, y: 23 } });
    expect(widget.hasPseudoClass("hover")).toBe(false);

    session.unmount();
  });

  it("shows tooltips after the configured dwell delay when transients opt in", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip="details" />, {
      transients: { tooltips: true },
    });
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    expect(session.app.activeTooltip).toBeNull();

    await session.pilot.pause(0.02);

    expect(session.app.activeTooltip?.visual.plainText).toBe("details");
    expect(session.lastFrame()).toContain("details");

    session.unmount();
  });

  it("renders tooltip bubble padding as styled cells in the terminal frame", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip="[#ff5555]Tip[/]" />, {
      transients: { tooltips: true },
    });
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    await session.pilot.pause(0.02);

    const frame = session.lastFrame() ?? "";
    expect(frame).toContain("\u001B[48;2;36;47;56m       ");
    expect(frame).toContain("\u001B[48;2;36;47;56m  ");
    expect(frame).toContain("\u001B[38;2;255;85;85mTip");

    session.unmount();
  });

  it("renders rich-js renderables through the Visual seam", async () => {
    const tooltip = createTestRenderable("details");
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip={tooltip} />, {
      transients: { tooltips: true },
    });
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    await session.pilot.pause(0.02);

    expect(session.app.activeTooltip?.visual.plainText).toBeNull();
    expect(session.lastFrame()).toContain("details");
    expect(tooltip.measure).toHaveBeenCalled();
    expect(tooltip.render).toHaveBeenCalled();

    session.unmount();
  });

  it("keeps the overlay hidden when test transients stay off", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip="details" />);
    const widget = session.app.getByCssId("target")!;
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    await session.pilot.pause(0.02);

    expect(widget.hasPseudoClass("hover")).toBe(true);
    expect(session.app.activeTooltip).toBeNull();
    expect(session.lastFrame()).not.toContain("details");

    session.unmount();
  });

  it("never shows a tooltip for widgets without tooltip content", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip={null} />, {
      transients: { tooltips: true },
    });
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    await session.pilot.pause(0.02);

    expect(session.app.activeTooltip).toBeNull();

    session.unmount();
  });

  it("hides the old tooltip immediately when hover moves to another widget", async () => {
    const session = await runTest(
      <>
        <TooltipLeaf id="first" label="one" tooltip="first tip" />
        <TooltipLeaf id="second" label="two" tooltip="second tip" />
      </>,
      { transients: { tooltips: true } },
    );
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#first");
    await session.pilot.pause(0.02);
    expect(session.app.activeTooltip?.visual.plainText).toBe("first tip");

    await session.pilot.hover("#second");
    expect(session.app.activeTooltip).toBeNull();

    await session.pilot.pause(0.02);
    expect(session.app.activeTooltip?.visual.plainText).toBe("second tip");

    session.unmount();
  });

  it("clears the tooltip when the source unmounts", async () => {
    let toggleMounted!: (mounted: boolean) => void;
    const session = await runTest(
      <ToggleTooltipHarness
        onToggleReady={(value) => {
          toggleMounted = value;
        }}
      />,
      { transients: { tooltips: true } },
    );
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    await session.pilot.pause(0.02);
    expect(session.app.activeTooltip?.visual.plainText).toBe("details");

    toggleMounted(false);
    await session.pilot.pause();
    expect(session.app.activeTooltip).toBeNull();

    session.unmount();
  });

  it("clears the tooltip when the source display becomes none", async () => {
    let widget!: Widget;
    const session = await runTest(
      <TooltipLeaf
        id="target"
        label="leaf"
        tooltip="details"
        onReady={(value) => {
          widget = value;
        }}
      />,
      { transients: { tooltips: true } },
    );
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    await session.pilot.pause(0.02);
    expect(session.app.activeTooltip?.visual.plainText).toBe("details");

    widget.setDisplay(false);
    await session.pilot.pause();
    expect(session.app.activeTooltip).toBeNull();

    session.unmount();
  });
});
