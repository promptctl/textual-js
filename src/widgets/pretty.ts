// [LAW:decomposition] One purpose: turn a JavaScript value into the styled
// lines Textual's Pretty paints for it. No React, no widget handle, no resolved
// styles — so the formatter is exercisable with no mocks and the component
// above it stays a wiring layer.
//
// This renders a JavaScript value in *Python's* repr vocabulary: single-quoted
// strings, `True`/`False`/`None`, `{'k': v}` for an object. That looks wrong at
// first glance and is not. Textual is the oracle here, the committed baselines
// are the only contract this widget has — there is no spec-tests file for
// Pretty — and `pretty_basic.txt` reads `['alpha', 'beta', 'gamma']`. A version
// that emitted JavaScript's own syntax could not match a single baseline, and
// the port would have quietly stopped being a port.
//
// The rule that settles every edge the fixtures do not reach: a value renders
// the way Rich renders the Python value it stands for, and keeps its JavaScript
// spelling only where Python has no counterpart. So `true` is `True` and
// `Infinity` is `inf`, while `undefined` stays `undefined`.
//
// Upstream's Pretty renders `rich.pretty.Pretty`, which does two things: build
// a repr string, then run `ReprHighlighter` — a list of regexes — back over
// that string to decide which characters were braces, which were quoted
// strings, which were numbers. This port keeps the first half and drops the
// second. [LAW:parse-dont-validate] the traversal already knows what every
// piece is; emitting a string and regex-matching it back is throwing the proof
// away and re-deriving it. Tokens carry the proof to the style table, so a `[`
// inside a string cannot be mistaken for a bracket — not because a regex is
// ordered carefully, but because nothing downstream is guessing.

import { cellLen } from "rich-js";

import { Content, type ContentPart } from "../content/index.js";

/**
 * What a run of characters *is*, which is the only thing the style table needs
 * to know about it.
 *
 * One member per `repr.*` style in Rich's default theme that this port's value
 * domain can actually produce, plus `plain` for text Rich leaves unhighlighted
 * — the `, ` and `: ` separators, and the fallback repr of a value with no
 * Python counterpart.
 */
type PrettyTokenKind =
  | "brace"
  | "str"
  | "number"
  | "boolTrue"
  | "boolFalse"
  | "none"
  | "ellipsis"
  | "plain";

interface PrettyToken {
  readonly text: string;
  readonly kind: PrettyTokenKind;
}

/**
 * A value laid out as a tree, before any decision about line breaks.
 *
 * [LAW:types-are-the-program] The split is exactly the one that decides
 * layout: a leaf is a token run that can never be broken across lines, and a
 * container is the only thing that can. Rich carries both in one `Node` class
 * with an `expandable` property derived at runtime from whether `children` is
 * a non-empty list; here "can this expand" is the discriminator itself, so the
 * layout pass below never asks.
 */
type PrettyTree =
  | { readonly kind: "leaf"; readonly tokens: readonly PrettyToken[] }
  | {
      readonly kind: "container";
      readonly open: string;
      readonly close: string;
      readonly entries: readonly PrettyEntry[];
    };

/**
 * One member of a container, and the unit the layout pass places on a line.
 *
 * `key` is empty for a sequence element rather than absent. [LAW:dataflow-not-control-flow]
 * an empty token run is the identity of the concatenation that builds every
 * line, so mapping and dict entries take the same code path instead of one
 * arm testing for a key that isn't there.
 */
interface PrettyEntry {
  readonly key: readonly PrettyToken[];
  readonly value: PrettyTree;
}

// Rich's own layout constants (`Node.render` defaults), named rather than
// spelled inline because the separator's *length* and its *rendered text*
// differ and both have to come from the one string — see LineSuffix below.
const INDENT_SIZE = 4;
const SEPARATOR = ", ";
const KEY_SEPARATOR = ": ";

/**
 * What follows a line's content, in the two ways it matters.
 *
 * These differ, and the difference is load-bearing rather than a typo. Rich
 * measures a child line with `cell_len(self.suffix)` — the full `", "` — but
 * renders it through `self.suffix.rstrip()`, so a line that *fits* only
 * because the trailing space was counted still prints one cell narrower. The
 * last child of a container is measured with the separator too and rendered
 * without any of it. Collapsing these into one string changes where nested
 * structures break, off by one cell, at exactly the widths a fixture is least
 * likely to sit on.
 *
 * [LAW:one-source-of-truth] both fields derive from `SEPARATOR`; neither is
 * typed out a second time.
 */
interface LineSuffix {
  readonly measuredCells: number;
  readonly text: string;
}

// The three positions a line can occupy, as values rather than as flags the
// layout pass branches on.
const ROOT_SUFFIX: LineSuffix = { measuredCells: 0, text: "" };
const ITEM_SUFFIX: LineSuffix = { measuredCells: SEPARATOR.length, text: SEPARATOR.trimEnd() };
const LAST_ITEM_SUFFIX: LineSuffix = { measuredCells: SEPARATOR.length, text: "" };

// Rich's `DEFAULT_STYLES`, transcribed entry for entry, with each colour name
// resolved to the hex Textual actually emits for it.
//
// The names in Rich are ANSI ones — `green`, `cyan`, `bright_red`. Textual
// converts those to RGB through its dark ANSI theme (Monokai) before they
// reach the terminal, so `repr.str`'s "green" arrives as `#98e024` and not as
// SGR 32. Writing the resolved hex is the same call `loading-indicator-component.tsx`
// makes for `$primary`, and for the same reason: the name would resolve
// somewhere else here, or not at all. The two hexes the committed baselines
// exercise are readable straight out of them —
// `visual-tests/snapshots/python/pretty_nested.ansi` carries `38;2;152;224;36`
// for every quoted string and `38;2;88;209;235` for every number.
//
// `plain` maps to `undefined` rather than to `""`: `Content.assemble` treats
// an absent style as "no span at all", so unhighlighted text contributes no
// empty span for a later pass to carry around.
const TOKEN_STYLES: Record<PrettyTokenKind, string | undefined> = {
  brace: "bold",
  str: "not bold not italic #98e024",
  number: "bold not italic #58d1eb",
  boolTrue: "italic #98e024",
  boolFalse: "italic #f4005f",
  none: "italic #f4005f",
  ellipsis: "#fd971f",
  plain: undefined,
};

const SEPARATOR_TOKEN: PrettyToken = { text: SEPARATOR, kind: "plain" };
const KEY_SEPARATOR_TOKEN: PrettyToken = { text: KEY_SEPARATOR, kind: "plain" };

// Python spells the three non-finite floats differently from JavaScript, and
// they are the same values, so they get Python's spelling. A `Map` rather than
// a comparison chain because `Map` keys use SameValueZero, which matches NaN.
const NON_FINITE_NAMES = new Map<number, string>([
  [Number.POSITIVE_INFINITY, "inf"],
  [Number.NEGATIVE_INFINITY, "-inf"],
  [Number.NaN, "nan"],
]);

// Keyed by the boolean's own name so the lookup is total by construction —
// `${value}` on a `boolean` is typed `"true" | "false"`, which is exactly the
// key set. A `Map<boolean, …>` would need a non-null assertion at every read
// to say what the table already guarantees.
const BOOLEAN_TOKENS: Record<`${boolean}`, PrettyToken> = {
  true: { text: "True", kind: "boolTrue" },
  false: { text: "False", kind: "boolFalse" },
};

// The escapes Python's `repr` writes as a short form. Everything else in the
// control range falls through to `\xNN` below; the chosen quote is escaped by
// `pythonStringRepr`, which is why neither quote appears here.
const STRING_ESCAPES = new Map<string, string>([
  ["\\", "\\\\"],
  ["\n", "\\n"],
  ["\r", "\\r"],
  ["\t", "\\t"],
]);

function token(text: string, kind: PrettyTokenKind): PrettyToken {
  return { text, kind };
}

function leaf(...tokens: readonly PrettyToken[]): PrettyTree {
  return { kind: "leaf", tokens };
}

function container(
  open: string,
  close: string,
  entries: readonly PrettyEntry[],
): PrettyTree {
  return { kind: "container", open, close, entries };
}

/**
 * Python's `repr` of a string, which is what Rich prints and what the
 * committed baselines show: single quotes by default, double quotes when that
 * avoids escaping, and the short escapes for the control characters that have
 * one.
 */
function pythonStringRepr(value: string): string {
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  const body = [...value]
    .map((character) => STRING_ESCAPES.get(character) ?? escapeCharacter(character, quote))
    .join("");
  return `${quote}${body}${quote}`;
}

function escapeCharacter(character: string, quote: string): string {
  const code = character.codePointAt(0) ?? 0;
  const isControl = code < 0x20 || code === 0x7f;
  return character === quote
    ? `\\${character}`
    : isControl
      ? `\\x${code.toString(16).padStart(2, "0")}`
      : character;
}

/**
 * The value laid out as a tree, with no line-break decisions taken yet.
 *
 * A separate pass from the layout below because it answers a separate set of
 * questions — quoting, `True`/`None`, which values are containers — and none of
 * them needs a width or a style to answer.
 */
function prettyTree(value: unknown): PrettyTree {
  return treeOf(value, new Set<object>());
}

// `ancestors` is the chain of containers currently open above this value, and
// it is what makes the traversal total over cyclic input. Rich prints `...` for
// a value already on the stack; a widget whose whole job is showing you data
// you do not yet understand is exactly where an unguarded recursion would be
// found, so the same answer is given here.
function treeOf(value: unknown, ancestors: ReadonlySet<object>): PrettyTree {
  switch (typeof value) {
    case "string":
      return leaf(token(pythonStringRepr(value), "str"));
    case "number":
      return leaf(token(NON_FINITE_NAMES.get(value) ?? String(value), "number"));
    // Python's int is arbitrary-precision, so a bigint is a plain number here
    // and drops JavaScript's `n` suffix.
    case "bigint":
      return leaf(token(String(value), "number"));
    case "boolean":
      return leaf(BOOLEAN_TOKENS[`${value}`]);
    // The one value with no Python counterpart, so it keeps its own name.
    // Rendering it as `None` would merge two distinct facts about the data into
    // one glyph, in a widget whose only job is telling them apart.
    case "undefined":
      return leaf(token("undefined", "none"));
    // `String(fn)` is the function's entire source text, which is not a repr.
    // Node's own inspector spells this `[Function: name]` and that is the
    // convention a JavaScript reader already knows.
    case "function":
      return leaf(token(`[Function: ${value.name || "anonymous"}]`, "plain"));
    case "symbol":
      return leaf(token(String(value), "plain"));
    case "object":
      return objectTree(value, ancestors);
  }
}

// [LAW:dataflow-not-control-flow] exception: JavaScript's object types carry no
// shared discriminator, so distinguishing an Array from a Map from a plain
// object is a chain of predicates rather than a switch over a tag. Each arm
// produces a whole tree, so the variability still ends up in the value that
// crosses the seam — what is missing is a tag to read it off, not a reason for
// the branch.
function objectTree(value: object | null, ancestors: ReadonlySet<object>): PrettyTree {
  if (value === null) {
    return leaf(token("None", "none"));
  }
  if (ancestors.has(value)) {
    return leaf(token("...", "ellipsis"));
  }

  const nested = new Set(ancestors).add(value);
  const element = (item: unknown): PrettyEntry => ({ key: [], value: treeOf(item, nested) });
  const pair = ([key, item]: readonly [unknown, unknown]): PrettyEntry => ({
    key: [...flattenTree(treeOf(key, nested)), KEY_SEPARATOR_TOKEN],
    value: treeOf(item, nested),
  });

  if (Array.isArray(value)) {
    return container("[", "]", value.map(element));
  }
  if (value instanceof Map) {
    return container("{", "}", [...value].map(pair));
  }
  // A non-empty set shares the dict's braces; an empty one is `set()` in
  // Python, which is atomic — there is no brace for a layout pass to break at.
  if (value instanceof Set) {
    return value.size === 0
      ? leaf(token("set", "plain"), token("(", "brace"), token(")", "brace"))
      : container("{", "}", [...value].map(element));
  }
  // Only a plain object is unpacked, which is where Python stops too: it
  // unpacks its own containers and leaves every other object to that object's
  // `repr`. A Date, a RegExp or an Error reads far better through `String`
  // than as the empty `{}` its own enumerable keys would produce.
  if (isPlainObject(value)) {
    return container("{", "}", Object.entries(value).map(pair));
  }
  return leaf(token(String(value), "plain"));
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

/** One laid-out line: how far it is indented, and what is on it. */
interface PrettyLine {
  readonly indent: number;
  readonly tokens: readonly PrettyToken[];
}

// The tree's single-line form. Rich's `Node.iter_tokens`, with the empty
// container falling out of the fold rather than needing its own `empty` field:
// no entries means nothing between the braces, which is `[]` or `{}` already.
function flattenTree(tree: PrettyTree): readonly PrettyToken[] {
  if (tree.kind === "leaf") {
    return tree.tokens;
  }
  return [
    token(tree.open, "brace"),
    ...tree.entries.flatMap((entry, index) => [
      ...(index > 0 ? [SEPARATOR_TOKEN] : []),
      ...entry.key,
      ...flattenTree(entry.value),
    ]),
    token(tree.close, "brace"),
  ];
}

function tokenCells(tokens: readonly PrettyToken[]): number {
  return tokens.reduce((total, item) => total + cellLen(item.text), 0);
}

/**
 * Rich's expansion rule: keep an entry on one line when it fits, and otherwise
 * put its opening brace, each child, and its closing brace on lines of their
 * own — recursively, because a child that still does not fit expands in turn.
 *
 * The one branch is the domain's own: an entry either fits or it does not, and
 * both arms produce a full set of lines. Note that the width being compared
 * against includes the indent, so a structure that fits at the top level can
 * still expand three levels down.
 */
function layoutEntry(
  entry: PrettyEntry,
  indent: number,
  suffix: LineSuffix,
  maxWidth: number,
): readonly PrettyLine[] {
  const body = flattenTree(entry.value);
  const inline: PrettyLine = {
    indent,
    tokens: [...entry.key, ...body, token(suffix.text, "plain")],
  };
  const inlineCells =
    indent + tokenCells(entry.key) + tokenCells(body) + suffix.measuredCells;

  if (
    entry.value.kind !== "container" ||
    entry.value.entries.length === 0 ||
    inlineCells <= maxWidth
  ) {
    return [inline];
  }

  const { open, close, entries } = entry.value;
  const lastIndex = entries.length - 1;
  return [
    { indent, tokens: [...entry.key, token(open, "brace")] },
    ...entries.flatMap((child, index) =>
      layoutEntry(
        child,
        indent + INDENT_SIZE,
        index === lastIndex ? LAST_ITEM_SUFFIX : ITEM_SUFFIX,
        maxWidth,
      ),
    ),
    // The closing brace carries the suffix of the entry it closes, so a nested
    // container that is not the last member ends `},` rather than `}`.
    { indent, tokens: [token(close, "brace"), token(suffix.text, "plain")] },
  ];
}

/**
 * The value, pretty-printed and highlighted, wrapped to `maxWidth` columns.
 *
 * `Content.assemble` is fed `[text, style]` pairs and never a bare string: a
 * bare string part goes through `Content.fromText`, which parses markup, and a
 * repr is made of brackets. `Pretty([1, 2, 3])` would lose its list to an
 * unclosed tag.
 */
export function prettyContent(value: unknown, maxWidth: number): Content {
  const lines = layoutEntry(
    { key: [], value: prettyTree(value) },
    0,
    ROOT_SUFFIX,
    maxWidth,
  );

  return Content.assemble(
    ...lines.flatMap((line, index): ContentPart[] => [
      ...(index > 0 ? [["\n"] as ContentPart] : []),
      [" ".repeat(line.indent)],
      ...line.tokens.map((item): ContentPart => [item.text, TOKEN_STYLES[item.kind]]),
    ]),
  );
}
