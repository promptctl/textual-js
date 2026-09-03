import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import React from "react";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { InvalidPlaceholderVariant, Placeholder, runTest, type TestSession } from "../src/index.js";
import {
  PLACEHOLDER_PALETTE,
  PLACEHOLDER_VARIANTS,
  PlaceholderModel,
  cyclePlaceholderVariant,
  placeholderColorClass,
  placeholderLabel,
} from "../src/widgets/placeholder.js";

// [LAW:behavior-not-structure] Every expectation below is something a reader
// could see on screen or query from the app — never a call the component
// happens to make on the way there.

// The colours real Textual painted, read out of the committed baseline rather
// than restated as literals here.
//
// [LAW:one-source-of-truth] CLAUDE.md's rule, and the one assertion in this
// file that a wrong palette could not satisfy by construction: the table under
// test is derived from twelve upstream hexes by blending, and a literal written
// from that same arithmetic would agree with the implementation however wrong
// both were. These triplets were drawn by upstream.
const VARIANTS_BASELINE_ANSI = readFileSync(
  fileURLToPath(new URL("../visual-tests/snapshots/python/placeholder_variants.ansi", import.meta.url)),
  "utf8",
);

/** Every distinct `foreground on background` pair the baseline paints, in the order it paints them. */
function baselineColorPairs(ansi: string): { color: string; background: string }[] {
  const pairs: { color: string; background: string }[] = [];
  const pattern = /\[(?:\d;)?38;2;(\d+);(\d+);(\d+);48;2;(\d+);(\d+);(\d+)m/g;

  for (const match of ansi.matchAll(pattern)) {
    const [, red, green, blue, backRed, backGreen, backBlue] = match;
    const pair = {
      color: hex(Number(red), Number(green), Number(blue)),
      background: hex(Number(backRed), Number(backGreen), Number(backBlue)),
    };

    const seen = pairs.some(
      (existing) => existing.color === pair.color && existing.background === pair.background,
    );

    if (!seen) {
      pairs.push(pair);
    }
  }

  return pairs;
}

function hex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function screenText(session: TestSession): string {
  return stripAnsi(session.lastFrame() ?? "");
}

function screenRows(session: TestSession): string[] {
  return screenText(session)
    .split("\n")
    .map((row) => row.trimEnd());
}

describe("placeholder variants", () => {
  it("starts at the default variant", () => {
    expect(new PlaceholderModel().variant).toBe("default");
  });

  it("constructs at a valid variant", () => {
    expect(new PlaceholderModel("size").variant).toBe("size");
  });

  it("rejects an unknown variant at construction", () => {
    expect(() => new PlaceholderModel("bogus")).toThrow(InvalidPlaceholderVariant);
  });

  it("rejects an unknown variant on assignment", () => {
    const placeholder = new PlaceholderModel();

    expect(() => {
      placeholder.variant = "bogus";
    }).toThrow(InvalidPlaceholderVariant);
  });

  it("accepts reassignment to a valid variant", () => {
    const placeholder = new PlaceholderModel("default");
    placeholder.variant = "text";

    expect(placeholder.variant).toBe("text");
  });

  it("names the variants it would have accepted when it rejects one", () => {
    // The message is the only thing that tells a caller which spelling they
    // missed, so it is worth pinning rather than the exception type alone.
    expect(() => new PlaceholderModel("bogus")).toThrow(
      "Valid placeholder variants are 'default', 'size', and 'text'",
    );
  });

  it("knows exactly the three variants upstream knows", () => {
    // "css" was a fourth variant in older Textual and is gone from the version
    // these baselines were captured against; accepting it here would let a
    // fixture ask for a variant with nothing to render.
    expect([...PLACEHOLDER_VARIANTS]).toEqual(["default", "size", "text"]);
  });

  it("cycles forward through the variants and wraps around", () => {
    expect(cyclePlaceholderVariant("default", 1)).toBe("size");
    expect(cyclePlaceholderVariant("size", 1)).toBe("text");
    expect(cyclePlaceholderVariant("text", 1)).toBe("default");
  });

  it("stays put at zero steps, so an unclicked placeholder shows the variant it was given", () => {
    expect(cyclePlaceholderVariant("size", 0)).toBe("size");
  });
});

describe("placeholder labels", () => {
  it("prefers the label it was given", () => {
    expect(placeholderLabel("Sidebar", "nav")).toBe("Sidebar");
  });

  it("falls back to the id, marked as one", () => {
    expect(placeholderLabel(undefined, "nav")).toBe("#nav");
  });

  it("falls back to the widget name when it has neither", () => {
    expect(placeholderLabel(undefined, undefined)).toBe("Placeholder");
  });

  it("treats an empty label as no label, the way upstream's truthiness check does", () => {
    expect(placeholderLabel("", "nav")).toBe("#nav");
  });
});

describe("placeholder palette", () => {
  it("paints the colours Python Textual painted, for each of the first three placeholders", () => {
    const baseline = baselineColorPairs(VARIANTS_BASELINE_ANSI);

    expect(baseline).toHaveLength(3);
    expect(PLACEHOLDER_PALETTE.slice(0, 3)).toEqual(baseline);
  });

  it("holds the twelve colours upstream deals from", () => {
    expect(PLACEHOLDER_PALETTE).toHaveLength(12);
  });

  it("wraps back to the first colour once the twelve are spent", () => {
    // Driving the wrap, not just asserting the length: the length assertion
    // above passes with the modulo deleted, and nothing else in the suite
    // reaches an index past eleven.
    expect(placeholderColorClass(12)).toBe(placeholderColorClass(0));
    expect(placeholderColorClass(13)).toBe(placeholderColorClass(1));
    // A non-zero remainder too, so a stray `% 1` or a constant fails here.
    expect(placeholderColorClass(5)).not.toBe(placeholderColorClass(0));
  });
});

describe("Placeholder widget", () => {
  it("names itself when it has no label and no id", async () => {
    const session = await runTest(<Placeholder />);
    await session.app.whenIdle();

    expect(screenText(session)).toContain("Placeholder");

    session.unmount();
  });

  it("shows the label it was given", async () => {
    const session = await runTest(<Placeholder label="Sidebar" />);
    await session.app.whenIdle();

    expect(screenText(session)).toContain("Sidebar");

    session.unmount();
  });

  it("shows its id when it has no label", async () => {
    const session = await runTest(<Placeholder id="nav" />);
    await session.app.whenIdle();

    expect(screenText(session)).toContain("#nav");

    session.unmount();
  });

  it("shows a label containing square brackets rather than reading it as markup", async () => {
    // [LAW:parse-dont-validate] The regression this guards: handing the label
    // downstream as a plain string routes it through Content.fromMarkup, where
    // "[draft]" opens an unknown tag and the word disappears.
    const session = await runTest(<Placeholder label="[draft]" />);
    await session.app.whenIdle();

    expect(screenText(session)).toContain("[draft]");

    session.unmount();
  });

  it("reports the box it was given in the size variant", async () => {
    const session = await runTest(<Placeholder variant="size" />, {
      appProps: { css: "Placeholder { height: 5; }" },
    });
    await session.app.whenIdle();

    expect(screenText(session)).toContain("80 x 5");

    session.unmount();
  });

  it("draws the size in bold, as upstream's markup does", async () => {
    const session = await runTest(<Placeholder variant="size" />, {
      appProps: { css: "Placeholder { height: 5; }" },
    });
    await session.app.whenIdle();

    expect(session.lastFrame() ?? "").toMatch(/\[1[;m]/);

    session.unmount();
  });

  it("opens the text variant on the first line of the lorem, not the middle of it", async () => {
    // Upstream repeats the paragraph until it overflows and lets the compositor
    // crop at the top-left. Centring an over-tall block instead would start it
    // mid-sentence, which is the failure this pins.
    const session = await runTest(<Placeholder variant="text" />, {
      appProps: { css: "Placeholder { height: 5; }" },
    });
    await session.app.whenIdle();

    expect(screenRows(session)[1]).toContain("Lorem ipsum dolor sit amet");

    session.unmount();
  });

  it("centres a short label in the box, horizontally and vertically", async () => {
    const session = await runTest(<Placeholder label="Mid" />, {
      appProps: { css: "Placeholder { height: 5; }" },
    });
    await session.app.whenIdle();

    const rows = screenRows(session);

    expect(rows[2]?.trim()).toBe("Mid");
    expect(rows[0]?.trim()).toBe("");
    expect(rows[1]?.trim()).toBe("");

    session.unmount();
  });

  it("paints every cell of its region, so the background has no holes in it", async () => {
    // Ink colours Text and not Box: a cell this widget does not emit is a cell
    // its background does not reach. The label occupies eleven of four hundred.
    const session = await runTest(<Placeholder />, {
      appProps: { css: "Placeholder { height: 5; }" },
    });
    await session.app.whenIdle();

    const rows = stripAnsi(session.lastFrame() ?? "").split("\n").slice(0, 5);

    expect(rows.map((row) => row.length)).toEqual([80, 80, 80, 80, 80]);

    session.unmount();
  });

  it("reports its content area in the size variant, not its outer region", async () => {
    // Verified against textual 8.2.3: `Widget.size` is documented as "The size
    // of the content area" and returns `content_region.size`, so a 40x7
    // Placeholder with `padding: 1 2; border: round` reports 34 x 3 there.
    // Upstream's `_on_resize` renders exactly that value.
    //
    // `round` rather than Textual's usual `solid` because this port hands
    // border style names to Ink unmapped and Ink knows neither `solid` nor
    // most of the others — a separate defect, filed as textual-styles-3of.
    const session = await runTest(<Placeholder variant="size" />, {
      appProps: {
        css: "Placeholder { width: 40; height: 7; padding: 1 2; border: round red; }",
      },
    });
    await session.app.whenIdle();

    expect(screenText(session)).toContain("34 x 3");

    session.unmount();
  });

  it("fills a bordered, padded box edge to edge, with the label still centred", async () => {
    // The no-holes guarantee has to survive ordinary styling. Building the
    // content against the outer region instead of the content area would push
    // the block off centre and drop the trailing columns' background.
    const session = await runTest(<Placeholder label="Mid" />, {
      appProps: {
        css: "Placeholder { width: 20; height: 5; padding: 1 2; border: round red; }",
      },
    });
    await session.app.whenIdle();

    // Strip the border column from each side; what is left is what the widget
    // painted, and every cell of it must be emitted rather than ragged.
    const painted = screenRows(session)
      .slice(1, 4)
      .map((row) => row.slice(1, -1));

    // Seven leading spaces is the assertion that matters. The content area is
    // 20 less two border columns less four padding columns = 14, so a 3-cell
    // label centres at floor((14 - 3) / 2) = 5, plus the 2 padding columns.
    // Building the block against the outer 20 instead would put it at 8 and
    // then crop the overhang — which is exactly what this used to do.
    expect(painted).toEqual([" ".repeat(18), "       Mid        ", " ".repeat(18)]);

    session.unmount();
  });

  it("wraps the lorem exactly where Python Textual wrapped it", async () => {
    // [LAW:one-source-of-truth] Read from the committed baseline rather than
    // restated here, so this cannot drift from the frame Gate 4 measures — and
    // so it fails on a word-wrap that is merely close. The three rows are the
    // text variant's visible ones; rows 11 and 15 are its blank padding.
    const baseline = readFileSync(
      fileURLToPath(new URL("../visual-tests/snapshots/python/placeholder_variants.txt", import.meta.url)),
      "utf8",
    ).split("\n");

    const session = await runTest(
      <>
        <Placeholder variant="default" label="Default" />
        <Placeholder variant="size" label="Size" />
        <Placeholder variant="text" label="Text" />
      </>,
      { appProps: { css: "Placeholder { height: 5; }" } },
    );
    await session.app.whenIdle();

    const rows = screenRows(session);

    expect(rows.slice(0, 15)).toEqual(baseline.slice(0, 15).map((row) => row.trimEnd()));

    session.unmount();
  });

  it("wears its variant as a class, so CSS can target one variant", async () => {
    // Upstream swaps a `-{variant}` class on every variant change, and user CSS
    // written against `Placeholder.-text` is what that class is for.
    const session = await runTest(<Placeholder variant="text" />, {
      appProps: { css: "Placeholder.-text { color: #55ffff; }" },
    });
    await session.app.whenIdle();

    expect(session.lastFrame() ?? "").toContain("38;2;85;255;255");

    session.unmount();
  });

  it("registers with the framework as typeName Placeholder", async () => {
    const session = await runTest(<Placeholder id="nav" />);
    await session.app.whenIdle();

    expect(session.app.findWidgets("Placeholder").map((widget) => widget.id)).toEqual(["nav"]);

    session.unmount();
  });

  it("refuses a variant it cannot render", async () => {
    await expect(runTest(<Placeholder variant="bogus" />)).rejects.toThrow(
      InvalidPlaceholderVariant,
    );
  });

  it("cycles to the next variant when clicked", async () => {
    const session = await runTest(<Placeholder label="Sidebar" />, {
      appProps: { css: "Placeholder { height: 5; }" },
    });
    await session.app.whenIdle();

    expect(screenText(session)).toContain("Sidebar");

    await session.pilot.click("Placeholder");
    await session.app.whenIdle();

    expect(screenText(session)).toContain("80 x 5");

    session.unmount();
  });

  it("deals consecutive colours to consecutive placeholders", async () => {
    const session = await runTest(
      <>
        <Placeholder label="One" />
        <Placeholder label="Two" />
      </>,
      { appProps: { css: "Placeholder { height: 5; }" } },
    );
    await session.app.whenIdle();

    const frame = session.lastFrame() ?? "";

    expect(frame).toContain(ansiBackground(PLACEHOLDER_PALETTE[0].background));
    expect(frame).toContain(ansiBackground(PLACEHOLDER_PALETTE[1].background));

    session.unmount();
  });
});

function ansiBackground(hexColor: string): string {
  const value = Number.parseInt(hexColor.slice(1), 16);

  return `48;2;${(value >> 16) & 0xff};${(value >> 8) & 0xff};${value & 0xff}`;
}
