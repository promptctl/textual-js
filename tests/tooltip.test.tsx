import React, { useLayoutEffect, useState } from "react";
import { Box, Text } from "ink";
import { describe, expect, it, vi } from "vitest";

import { Content, WidgetScope, type WidgetNode, runTest, useWidget } from "../src/index.js";

function TooltipLeaf(props: {
  id: string;
  label: string;
  tooltip?: string | Content | null;
  onReady?: (widget: WidgetNode) => void;
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
  onWidgetReady?: (widget: WidgetNode) => void;
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
    const widget = session.framework.registry.getByCssId("target")!;

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
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#target");
    expect(session.framework.activeTooltip).toBeNull();

    await session.pilot.pause(20);

    expect(session.framework.activeTooltip?.content.plain).toBe("details");
    expect(session.lastFrame()).toContain("details");

    session.unmount();
  });

  it("renders styled tooltip content through the Content render bridge", async () => {
    const tooltip = Content.styled("details", "bold");
    const toRichText = vi.spyOn(tooltip, "toRichText");
    const toSegments = vi.spyOn(tooltip, "toSegments");
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip={tooltip} />, {
      transients: { tooltips: true },
    });
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#target");
    await session.pilot.pause(20);

    expect(session.framework.activeTooltip?.content).toBe(tooltip);
    expect(toRichText.mock.calls.length + toSegments.mock.calls.length).toBeGreaterThan(0);

    session.unmount();
  });

  it("keeps the overlay hidden when test transients stay off", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip="details" />);
    const widget = session.framework.registry.getByCssId("target")!;
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#target");
    await session.pilot.pause(20);

    expect(widget.hasPseudoClass("hover")).toBe(true);
    expect(session.framework.activeTooltip).toBeNull();
    expect(session.lastFrame()).not.toContain("details");

    session.unmount();
  });

  it("never shows a tooltip for widgets without tooltip content", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip={null} />, {
      transients: { tooltips: true },
    });
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#target");
    await session.pilot.pause(20);

    expect(session.framework.activeTooltip).toBeNull();

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
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#first");
    await session.pilot.pause(20);
    expect(session.framework.activeTooltip?.content.plain).toBe("first tip");

    await session.pilot.hover("#second");
    expect(session.framework.activeTooltip).toBeNull();

    await session.pilot.pause(20);
    expect(session.framework.activeTooltip?.content.plain).toBe("second tip");

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
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#target");
    await session.pilot.pause(20);
    expect(session.framework.activeTooltip?.content.plain).toBe("details");

    toggleMounted(false);
    await session.pilot.pause();
    expect(session.framework.activeTooltip).toBeNull();

    session.unmount();
  });

  it("clears the tooltip when the source display becomes none", async () => {
    let widget!: WidgetNode;
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
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#target");
    await session.pilot.pause(20);
    expect(session.framework.activeTooltip?.content.plain).toBe("details");

    widget.setDisplay(false);
    await session.pilot.pause();
    expect(session.framework.activeTooltip).toBeNull();

    session.unmount();
  });
});
