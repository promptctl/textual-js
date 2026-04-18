import React from "react";
import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";

import { ButtonWidget, StaticWidget, WidgetScope, runTest, useWidget } from "../src/index.js";
import { parseAnsiToStyledGrid } from "../visual-tests/styled-grid.ts";

function TooltipLeaf(props: {
  id: string;
  label: string;
  tooltip?: string | null;
}): React.JSX.Element {
  const widget = useWidget({
    typeName: "TooltipLeaf",
    id: props.id,
    tooltip: props.tooltip ?? null,
  });

  return (
    <WidgetScope widget={widget.handle}>
      <Box width={8} height={1}>
        <Text>{props.label}</Text>
      </Box>
    </WidgetScope>
  );
}

function findCell(grid: ReturnType<typeof parseAnsiToStyledGrid>, text: string) {
  for (const row of grid.rows) {
    const cell = row.find((candidate) => candidate.text === text && !candidate.continuation);

    if (cell !== undefined) {
      return cell;
    }
  }

  return undefined;
}

describe("styled content integration", () => {
  it("preserves styled spans in StaticWidget terminal output", async () => {
    const session = await runTest(<StaticWidget content={"A [bright_red]B[/]"} />, {
      props: { css: "Static { color: blue; }" } as never,
    });
    await session.pilot.pause();

    const grid = parseAnsiToStyledGrid(session.lastFrame());

    expect(findCell(grid, "A")?.text).toBe("A");
    expect(findCell(grid, "B")?.foreground).toBe("standard:9");

    session.unmount();
  });

  it("preserves rich-js palette colors in ButtonWidget labels", async () => {
    const session = await runTest(<ButtonWidget label={"[grey70]G[/]"} />);

    const grid = parseAnsiToStyledGrid(session.lastFrame());

    expect(findCell(grid, "G")?.foreground).toBe("eight-bit:249");

    session.unmount();
  });

  it("preserves styled tooltip content in the terminal frame", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip="[bright_red]T[/]" />, {
      transients: { tooltips: true },
    });
    session.framework.setTooltipDelay(10);

    await session.pilot.hover("#target");
    await session.pilot.pause(20);

    const grid = parseAnsiToStyledGrid(session.lastFrame());

    expect(findCell(grid, "T")?.foreground).toBe("standard:9");

    session.unmount();
  });
});
