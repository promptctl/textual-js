import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import React from "react";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { Pretty, runTest } from "../src/index.js";
import { prettyContent } from "../src/widgets/pretty.js";

// [LAW:behavior-not-structure] Every expectation below is glyphs a reader could
// see on screen, or the text of a repr — never a call the formatter happens to
// make on the way there.

const SCREEN_WIDTH = 80;

// [LAW:one-source-of-truth] The reprs real Textual drew, read out of the
// committed baselines rather than restated as literals here. CLAUDE.md's rule,
// and it is what makes these the one set of assertions the formatter could not
// satisfy by construction: a stored copy would agree with whatever the port
// happens to produce, while the baseline is the frame Gate 4 measures.
function baselineRepr(name: string): string {
  const path = fileURLToPath(
    new URL(`../visual-tests/snapshots/python/${name}.txt`, import.meta.url),
  );
  return readFileSync(path, "utf8")
    .split("\n")
    .map((row) => row.trimEnd())
    .join("\n")
    .trimEnd();
}

/** The repr `prettyContent` produces, with the trailing blank rows removed. */
function repr(value: unknown, width = SCREEN_WIDTH): string {
  return prettyContent(value, width).plain;
}

describe("Pretty formatting", () => {
  it("reproduces the reprs Textual drew for the committed fixtures", () => {
    // The three fixture values, spelled as the JavaScript counterparts of the
    // Python literals in visual-tests/fixtures/pretty_*.py. The point of
    // checking all three against their baselines rather than one is that they
    // fail differently: basic and nested exercise the single-line form, and
    // expanded is the only one whose repr had to be broken to a width at all.
    expect(repr(["alpha", "beta", "gamma"])).toBe(baselineRepr("pretty_basic"));

    expect(
      repr({
        name: "widget",
        counts: { hits: 1, misses: 2 },
        tags: ["a", "b", "c"],
      }),
    ).toBe(baselineRepr("pretty_nested"));

    expect(
      repr({
        widgets: ["Header", "Footer", "Placeholder", "LoadingIndicator"],
        counts: { shipped: 6, remaining: 2, skipped: null, unverified: true },
        note: "[draft]",
        complete: false,
      }),
    ).toBe(baselineRepr("pretty_expanded"));
  });

  it("keeps square brackets in a value out of the markup parser", () => {
    // The defect this widget is most likely to ship. A Content built from a
    // bare string is parsed as markup, and a repr is made of brackets — so
    // `Pretty([1, 2, 3])` would arrive as an unclosed tag rather than a list,
    // and a bracketed string inside one would lose its visible characters.
    //
    // This discriminates: swapping the `[text, style]` pairs in
    // `prettyContent` for bare string parts makes both of these fail and
    // nothing else in the file.
    expect(repr([1, 2, 3])).toBe("[1, 2, 3]");
    expect(repr({ note: "[draft]" })).toBe("{'note': '[draft]'}");
  });

  it("breaks a structure at the width Rich breaks it", () => {
    // Verified against the oracle rather than reasoned about:
    //   uv run python -c "from rich.pretty import pretty_repr; \
    //     print(pretty_repr(OBJ, max_width=39))"
    //
    // The 39/40 boundary is the one that catches the asymmetry buried in
    // Rich's `_Line`: a child's separator is *measured* as `", "` and
    // *rendered* through `rstrip()` as `,`. At 40 the 'counts' line is 4
    // indent + 34 repr + 2 measured separator, which fits exactly; drop one
    // column and it expands, even though the line as printed is 39 cells wide
    // and would have fitted. Measuring the separator as it prints would put
    // this boundary one column off, invisibly, at every nesting depth.
    const value = {
      name: "widget",
      counts: { hits: 1, misses: 2 },
      tags: ["a", "b", "c"],
    };

    expect(repr(value, 40)).toBe(
      ["{", "    'name': 'widget',", "    'counts': {'hits': 1, 'misses': 2},", "    'tags': ['a', 'b', 'c']", "}"].join(
        "\n",
      ),
    );

    expect(repr(value, 39)).toBe(
      [
        "{",
        "    'name': 'widget',",
        "    'counts': {",
        "        'hits': 1,",
        "        'misses': 2",
        "    },",
        "    'tags': ['a', 'b', 'c']",
        "}",
      ].join("\n"),
    );
  });

  it("counts the indent against the width, so depth can force a break", () => {
    // The root is over the limit at both widths here, so what is under test is
    // only the child. `'counts': {'hits': 1, 'miss': 2}` is 32 cells; under 4
    // cells of indent and 2 of measured separator it needs 38, and at 37 it has
    // to break.
    //
    // The width was chosen to discriminate rather than to look tidy. An
    // implementation that measured the child without its indent would keep it
    // inline all the way down to 34, so it would still pass at 38 and still
    // pass at 25 — and would print a line four columns past the limit at every
    // width between. 37 is the first width where the two disagree. Read off the
    // oracle:
    //   uv run python -c "from rich.pretty import pretty_repr; \
    //     print(pretty_repr({'counts': {'hits': 1, 'miss': 2}, 'n': 3}, max_width=37))"
    const value = { counts: { hits: 1, miss: 2 }, n: 3 };

    expect(repr(value, 38)).toBe(
      ["{", "    'counts': {'hits': 1, 'miss': 2},", "    'n': 3", "}"].join("\n"),
    );

    expect(repr(value, 37)).toBe(
      [
        "{",
        "    'counts': {",
        "        'hits': 1,",
        "        'miss': 2",
        "    },",
        "    'n': 3",
        "}",
      ].join("\n"),
    );
  });

  it("writes Python's repr for the values that have a Python counterpart", () => {
    // Textual is the oracle, so a JavaScript value renders the way Rich renders
    // the Python value it stands for. Every expectation here was read back from
    // `rich.pretty.pretty_repr` on the corresponding Python literal.
    expect(repr(true)).toBe("True");
    expect(repr(false)).toBe("False");
    expect(repr(null)).toBe("None");
    expect(repr(1.5)).toBe("1.5");
    expect(repr(123n)).toBe("123");
    expect(repr(Number.POSITIVE_INFINITY)).toBe("inf");
    expect(repr(Number.NEGATIVE_INFINITY)).toBe("-inf");
    expect(repr(Number.NaN)).toBe("nan");
    expect(repr([])).toBe("[]");
    expect(repr({})).toBe("{}");
  });

  it("keeps a JavaScript name for the one value Python has no word for", () => {
    // `undefined` is the only value in the domain with no Python counterpart.
    // Rendering it `None` would merge two distinct facts about the data into
    // one glyph, in a widget whose entire job is telling them apart.
    expect(repr(undefined)).toBe("undefined");
    expect(repr([null, undefined])).toBe("[None, undefined]");
  });

  it("quotes strings the way Python's repr quotes them", () => {
    // Single quotes by default; double quotes when that is what avoids an
    // escape; and back to single quotes with an escape when neither is free.
    expect(repr("plain")).toBe("'plain'");
    expect(repr("it's")).toBe('"it\'s"');
    expect(repr('say "hi"')).toBe("'say \"hi\"'");
    expect(repr("both ' and \"")).toBe("'both \\' and \"'");
    expect(repr("tab\tnewline\n")).toBe("'tab\\tnewline\\n'");
    expect(repr("back\\slash")).toBe("'back\\\\slash'");
    expect(repr("unié中")).toBe("'unié中'");
  });

  it("escapes exactly what Python will not print, at the width Python writes it", () => {
    // Python's `repr` escapes what `str.isprintable()` rejects — General_Category
    // Other or Separator — and picks `\xNN` / `\uNNNN` / `\UNNNNNNNN` from the
    // code point. A code range like `< 0x20 || 0x7f` looks like that rule and is
    // not it: each of the first four below sits outside such a range and would
    // paint as a raw invisible byte, which is the one class of error a terminal
    // fixture is physically incapable of showing \u2014 which is also why every one
    // is spelled as an escape here: an invisible literal in the source is a
    // test nobody can review.
    expect(repr("a\u0085b")).toBe("'a\\x85b'"); // Cc, C1 control
    expect(repr("a\u00a0b")).toBe("'a\\xa0b'"); // Zs, no-break space
    expect(repr("a\u200bb")).toBe("'a\\u200bb'"); // Cf, zero-width space
    expect(repr("a\u2028b")).toBe("'a\\u2028b'"); // Zl, line separator
    expect(repr("a\uffffb")).toBe("'a\\uffffb'"); // Cn, unassigned
    expect(repr("a\u{1d173}b")).toBe("'a\\U0001d173b'"); // Cf above the BMP

    // The ASCII space is the one Separator Python prints, and an astral glyph
    // with a real category is printable like any other letter.
    expect(repr("a b")).toBe("'a b'");
    expect(repr("\u00e9\u4e2d\u{1f600}")).toBe("'\u00e9\u4e2d\u{1f600}'");
  });

  it("renders a Map as a mapping and a Set as a set", () => {
    // The JavaScript spellings of Python's dict and set, so they get Python's
    // renderings. An empty set is `set()` rather than `{}`, which is the one
    // container with no brace for a line break to fall at.
    expect(repr(new Map([["a", 1]]))).toBe("{'a': 1}");
    expect(repr(new Set([1, 2]))).toBe("{1, 2}");
    expect(repr(new Set())).toBe("set()");
  });

  it("prints an ellipsis rather than recursing forever", () => {
    // A widget whose job is showing you data you do not yet understand is
    // exactly where a cycle is met, and Rich answers a cycle with `...`.
    const cyclicList: unknown[] = [1];
    cyclicList.push(cyclicList);
    expect(repr(cyclicList)).toBe("[1, ...]");

    const cyclicObject: Record<string, unknown> = { x: 1 };
    cyclicObject.self = cyclicObject;
    expect(repr(cyclicObject)).toBe("{'x': 1, 'self': ...}");
  });

  it("leaves an object that is not a data structure to its own repr", () => {
    // Python unpacks its own containers and hands every other object to that
    // object's `repr`. Unpacking a RegExp into its enumerable keys would print
    // the empty `{}`; `String` prints something a reader can act on.
    expect(repr(/ab+c/g)).toBe("/ab+c/g");
    expect(repr(new Error("boom"))).toBe("Error: boom");
    expect(repr(() => 1)).toBe("[Function: anonymous]");
    expect(repr({ handler: function named() {} })).toBe("{'handler': [Function: named]}");
  });

  it("keeps a value's own repr on the one row the layout counted", () => {
    // An `Error` whose message spans lines is the ordinary way a newline
    // reaches a leaf. The layout pass measures the token once and indents it
    // once, so a literal newline inside it paints a second row that nothing
    // measured and nothing indented — the container's fit decision would
    // describe output that was never produced. Two children, because a
    // single-child container's fit is the same inequality with or without the
    // indent and so cannot tell the two apart.
    expect(repr({ err: new Error("a\nb"), tail: 1 })).toBe("{'err': Error: a\\nb, 'tail': 1}");

    // The other two values that hand uncontrolled text to a leaf: a symbol's
    // description, and a function's `name` — an identifier in practice, and
    // settable to anything at all through `defineProperty`.
    expect(repr(Symbol("a\nb"))).toBe("Symbol(a\\nb)");
    expect(repr(Object.defineProperty(() => 1, "name", { value: "a\nb" }))).toBe(
      "[Function: a\\nb]",
    );

    // ...and escapes nothing further. A quoted string's repr doubles its
    // backslashes because it is Python source that has to round-trip; this is
    // the value's own rendered form, where the same doubling would misreport
    // the value. `/a\.b/g` is a regexp matching a literal dot, and `/a\\.b/g`
    // is a different one — routing this through the string table to share code
    // has to fail here, loudly.
    expect(repr(/a\.b/g)).toBe("/a\\.b/g");
  });
});

describe("Pretty widget", () => {
  it("paints the repr Textual painted, broken to the screen it was given", async () => {
    // The whole path rather than the formatter alone: the width the repr is
    // laid out against has to arrive from the measured region, and nothing
    // below `prettyContent` can prove it does. The expanded value is the one
    // that shows it — at any width the widget failed to receive, this renders
    // on one line instead of nine.
    const session = await runTest(
      <Pretty
        object={{
          widgets: ["Header", "Footer", "Placeholder", "LoadingIndicator"],
          counts: { shipped: 6, remaining: 2, skipped: null, unverified: true },
          note: "[draft]",
          complete: false,
        }}
      />,
    );
    await session.app.whenIdle();

    const painted = stripAnsi(session.lastFrame() ?? "")
      .split("\n")
      .map((row) => row.trimEnd())
      .join("\n")
      .trimEnd();

    expect(painted).toBe(baselineRepr("pretty_expanded"));

    session.unmount();
  });

  it("takes its colour from a Pretty rule", async () => {
    // The observable consequence of registering under upstream's type name: a
    // stylesheet can reach it by that name and nothing else. The colour lands
    // on the braces and separators, which are the runs Rich's own highlighting
    // leaves for the widget to colour.
    const session = await runTest(<Pretty object={["alpha"]} />, {
      appProps: { css: "Pretty { color: #55ffff; }" },
    });
    await session.app.whenIdle();

    expect(session.lastFrame() ?? "").toContain("38;2;85;255;255");

    session.unmount();
  });

  it("does not take focus", async () => {
    // Upstream's Pretty subclasses Widget and never sets `can_focus`, so it
    // keeps the default of False. The observable is that tabbing leaves focus
    // where it was rather than landing on a widget that only displays.
    const session = await runTest(<Pretty object={["alpha"]} />);
    await session.app.whenIdle();

    session.app.focusNext();
    await session.app.whenIdle();

    expect(session.app.focusedNodeId).toBeNull();

    session.unmount();
  });

  it("highlights strings in the colour Textual highlighted them", async () => {
    // The plain-text assertions above cannot see colour at all — the blind spot
    // a text match always has, and the one a left-aligned fixture shares. The
    // hex comes out of the committed baseline rather than a literal, so this
    // cannot drift from the frame Gate 4 measures.
    // The baseline sets exactly two foregrounds: the widget's own #e0e0e0 on
    // the braces and separators, and one more on the quoted strings. Naming
    // the widget colour and taking the other is what keeps this from silently
    // asserting the widget colour twice.
    const ansi = readFileSync(
      fileURLToPath(new URL("../visual-tests/snapshots/python/pretty_basic.ansi", import.meta.url)),
      "utf8",
    );
    const widgetForeground = "38;2;224;224;224";
    const foregrounds = new Set(ansi.match(/38;2;\d+;\d+;\d+/g) ?? []);
    foregrounds.delete(widgetForeground);
    const [stringForeground, ...extra] = [...foregrounds];

    expect(extra).toEqual([]);
    expect(stringForeground).toBeDefined();

    const session = await runTest(<Pretty object={["alpha", "beta", "gamma"]} />, {
      appProps: { css: `Pretty { color: #e0e0e0; }` },
    });
    await session.app.whenIdle();

    expect(session.lastFrame() ?? "").toContain(stringForeground);

    session.unmount();
  });
});
