import React from "react";
import { Box, Text } from "ink";
import { Panel } from "rich-js";
import { describe, expect, it } from "vitest";

import { Button, Static, WidgetScope, measureVisual, runTest, visualize, useWidget } from "../src/index.js";
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

function stripAnsi(output: string): string {
  return output.replace(/\u001B\[[0-9;]*m/g, "");
}

describe("styled content integration", () => {
  it("preserves styled spans in Static terminal output", async () => {
    const session = await runTest(<Static content={"A [bright_red]B[/]"} />, {
      props: { css: "Static { color: blue; }" } as never,
    });
    await session.pilot.pause();

    const grid = parseAnsiToStyledGrid(session.lastFrame());

    expect(findCell(grid, "A")?.text).toBe("A");
    expect(findCell(grid, "B")?.foreground).toBe("standard:9");

    session.unmount();
  });

  it("preserves rich-js palette colors in Button labels", async () => {
    const session = await runTest(<Button label={"[grey70]G[/]"} />);

    const grid = parseAnsiToStyledGrid(session.lastFrame());

    expect(findCell(grid, "G")?.foreground).toBe("eight-bit:249");

    session.unmount();
  });

  it("preserves styled tooltip content in the terminal frame", async () => {
    const session = await runTest(<TooltipLeaf id="target" label="leaf" tooltip="[bright_red]T[/]" />, {
      transients: { tooltips: true },
    });
    session.app.tooltipDelay = 10;

    await session.pilot.hover("#target");
    await session.pilot.pause(0.02);

    const grid = parseAnsiToStyledGrid(session.lastFrame());

    expect(findCell(grid, "T")?.foreground).toBe("standard:9");

    session.unmount();
  });

  it("renders width-sensitive visuals against the measured widget width", async () => {
    const panel = new Panel("Hello world");
    const expectedLines = measureVisual(visualize(panel), 10).lines.map((line) => line.map((segment) => segment.text).join(""));
    const session = await runTest(
      <Box width={10}>
        <Static content={panel} />
      </Box>,
    );
    await session.pilot.pause();

    const actualLines = stripAnsi(session.lastFrame() ?? "").split("\n").slice(0, expectedLines.length);

    expect(actualLines).toEqual(expectedLines);

    session.unmount();
  });
});
