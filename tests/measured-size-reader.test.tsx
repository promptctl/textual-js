// [LAW:behavior-not-structure] The contract `MeasuredSizeReader` owes its
// callers, asserted by mounting widgets rather than by reading the source. The
// sibling `measured-size-seam.test.ts` guards the boundary — that nothing walks
// around the seam — which is a different claim and no substitute for this one: a
// seam nobody bypasses can still hand back the wrong answer.

import { describe, expect, it } from "vitest";
import React from "react";
import { Box, Text } from "ink";

import { runTest } from "../src/testing/run-test.js";
import { WidgetScope, useWidget } from "../src/framework/context.js";
import { MeasuredSizeReader, type MeasuredSize } from "../src/framework/measured-size.js";
import { Static } from "../src/widgets/index.js";

// Built the way the five converted widgets are — `useWidget` + `WidgetScope`,
// rendering immediately rather than behind `WidgetHost`'s `lifecycleReady` gate
// — so the unmeasured first pass this seam exists to describe is actually
// reachable here. Every size the seam hands down is recorded, so that pass stays
// observable instead of being overwritten by the settled value one commit later.
function SizeRecorder({ into, css }: { into: MeasuredSize[]; css: string }): React.JSX.Element {
  const widget = useWidget({ id: "probe", typeName: "Probe", defaultCss: css });

  return (
    <WidgetScope widget={widget.handle}>
      <MeasuredSizeReader widget={widget.handle}>
        {(size) => {
          into.push(size);
          return <Text>.</Text>;
        }}
      </MeasuredSizeReader>
    </WidgetScope>
  );
}

async function record(css: string): Promise<MeasuredSize[]> {
  const seen: MeasuredSize[] = [];
  const session = await runTest(
    <Box flexDirection="column">
      <SizeRecorder into={seen} css={css} />
    </Box>,
  );

  session.unmount();
  return seen;
}

describe("MeasuredSizeReader", () => {
  it("reports absence before placement and the real size after it", async () => {
    const seen = await record("Probe { width: 12; height: 2; }");

    // The first pass is unmeasured: both axes absent, and absent is not zero.
    // This is the distinction the whole seam exists to carry.
    expect(seen[0]).toEqual({ width: undefined, height: undefined });
    // The last is the widget's own placed rectangle: 12 columns from the declared
    // width rather than the 80 its container offered. The height is the single
    // rendered row, not the declared 2, because r1k.1 left the whole height axis
    // on the inner box — so the measured outer box hugs its content vertically.
    expect(seen[seen.length - 1]).toEqual({ width: 12, height: 1 });
  });

  it("reports a real zero for a widget placed with no room, never absence", async () => {
    const seen = await record("Probe { display: none; }");

    // A hidden widget really is measured, and it really is zero wide. Collapsing
    // that onto `undefined` would tell every consumer to size itself to its own
    // content — the opposite of what a widget with no room should do, and the
    // exact conflation `Region.EMPTY` used to force on all five of them.
    expect(seen[seen.length - 1]).toEqual({ width: 0, height: 0 });
    expect(seen[seen.length - 1].width).not.toBeUndefined();
  });

  it("reports the width Yoga resolved, not the width the CSS asked for", async () => {
    const seen = await record("Probe { width: 5; min-width: 16; }");

    // The two disagree by construction: `styles.box.width` is what the author
    // wrote, the measurement is what survived the bounds Yoga applied on top of
    // it. Reading the declaration first would render five columns forever, so
    // this is the case that makes the measurement the only width worth reading
    // rather than merely the later one.
    expect(seen[seen.length - 1].width).toBe(16);
  });

  // What the zero arm is for, followed all the way to the screen. `renderVisual`
  // cannot accept a zero budget — rich-js throws `RangeError` at `maxWidth: 0`,
  // so the floor of 1 stays — which makes "decline to render" the consumer's job
  // and worth pinning: painting into that floor wraps the content one glyph per
  // row and grows the widget vertically out of a box measured at zero width.
  it("paints nothing for a Static placed with no room", async () => {
    const session = await runTest(
      <Box flexDirection="column">
        <Static id="zero" content="ABCDEFG" />
        <Static id="after" content="AFTER" />
      </Box>,
      { appProps: { css: `#zero { width: 0; }` } },
    );

    const zero = session.app.getByCssId("zero")!;
    expect({ width: zero.screenRegion.width, height: zero.screenRegion.height }).toEqual({
      width: 0,
      height: 0,
    });
    // The row below it is not displaced, and no stray glyph column survives.
    expect(session.lastFrame!().split("\n")[0]).toBe("AFTER");

    session.unmount();
  });
});
