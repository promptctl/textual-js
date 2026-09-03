// [LAW:decomposition] One purpose: turn a value into the three rows Textual's
// 3x3 font draws for it. No React, no widget handle, no resolved styles — so
// the font is exercisable with no mocks and the component below it stays a
// wiring layer.

import { Content } from "../content/index.js";

/**
 * Three horizontal strips of cells.
 *
 * // [LAW:one-type-per-behavior] One character's glyph and a fully rendered
 * value are the same shape, because the font is 3 rows tall and stays 3 rows
 * tall however many characters you set side by side. Sharing the type is what
 * lets `digitsRows` be a row-wise fold with `["", "", ""]` as its identity,
 * rather than a loop that special-cases the empty value.
 *
 * The height being a fact about the *type* rather than a number returned at
 * runtime is the whole reason Textual's `get_content_height` — which hardcodes
 * `return 3  # Always 3 lines` — has no counterpart here.
 */
export type DigitsRows = readonly [string, string, string];

// The font, transcribed from `DIGITS` / `DIGITS3X3` in
// textual/renderables/digits.py — generated from that module rather than typed
// by eye, because a mistranscribed glyph is the one defect a port like this is
// most likely to ship.
//
// // [LAW:one-source-of-truth] Upstream keeps the character set and the glyph
// blob in two separate strings, joined at read time by `DIGITS.index(ch) * 3`.
// Holding both in one literal means a character can no longer point at the
// wrong glyph, because there is no index left to get wrong.
//
// A `Map` rather than the bare object, so a lookup miss is typed `undefined`
// and `glyphFor` below is a total function over characters instead of an
// assertion that every character has a glyph.
//
// `)` really is four cells wide here, while upstream's `get_width` calls it
// three. That is an upstream inconsistency, copied verbatim on purpose: the
// Python baselines this port is measured against draw the four-cell glyph, so
// squaring it up would be a pixel diff, not a fix.
const GLYPHS = new Map<string, DigitsRows>(Object.entries({
  " ": ["   ", "   ", "   "],
  "0": ["╭─╮", "│ │", "╰─╯"],
  "1": ["╶╮ ", " │ ", "╶┴╴"],
  "2": ["╶─╮", "┌─┘", "╰─╴"],
  "3": ["╶─╮", " ─┤", "╶─╯"],
  "4": ["╷ ╷", "╰─┤", "  ╵"],
  "5": ["╭─╴", "╰─╮", "╶─╯"],
  "6": ["╭─╴", "├─╮", "╰─╯"],
  "7": ["╶─┐", "  │", "  ╵"],
  "8": ["╭─╮", "├─┤", "╰─╯"],
  "9": ["╭─╮", "╰─┤", "╶─╯"],
  "+": ["   ", "╶┼╴", "   "],
  "-": ["   ", "╶─╴", "   "],
  "^": [" ^ ", "   ", "   "],
  "x": ["   ", " × ", "   "],
  ":": ["   ", " : ", "   "],
  A: ["╭─╮", "├─┤", "╵ ╵"],
  B: ["┌─╮", "├─┤", "└─╯"],
  C: ["╭─╮", "│  ", "╰─╯"],
  D: ["┌─╮", "│ │", "└─╯"],
  E: ["╭─╴", "├─ ", "╰─╴"],
  F: ["╭─╴", "├─ ", "╵  "],
  $: ["╭╫╮", "╰╫╮", "╰╫╯"],
  "£": ["╭─╮", "╪═ ", "┷━╸"],
  "€": ["╭─╮", "╪═ ", "╰─╯"],
  "(": ["╭╴ ", "│  ", "╰╴ "],
  ")": [" ╶╮ ", "  │ ", " ╶╯ "],
} as const satisfies Readonly<Record<string, DigitsRows>>));

// Upstream's `REPLACEMENTS = str.maketrans({".": "•"})`: a period is drawn as a
// bullet sitting on the baseline rather than given a glyph of its own.
const REPLACEMENTS = new Map<string, string>([[".", "•"]]);

/**
 * The glyph for one character — every character, including the ones the font
 * has never heard of.
 *
 * Upstream reaches the same place through `except ValueError`. Unmapped
 * characters are drawn verbatim on the bottom row and occupy a single cell,
 * which is both how the bullet above actually reaches the screen and how a
 * stray character degrades into something readable instead of vanishing.
 */
function glyphFor(character: string): DigitsRows {
  const drawn = REPLACEMENTS.get(character) ?? character;

  return GLYPHS.get(drawn) ?? [" ", " ", drawn];
}

/**
 * Draw `value` in the 3x3 font.
 *
 * // [LAW:dataflow-not-control-flow] Every character takes the same path: look
 * up a glyph, append its three strips. The empty value is not a case — it is
 * the fold's starting value, returned untouched.
 */
export function digitsRows(value: string): DigitsRows {
  return [...value].reduce<DigitsRows>(
    (rows, character) => {
      const glyph = glyphFor(character);

      return [rows[0] + glyph[0], rows[1] + glyph[1], rows[2] + glyph[2]];
    },
    ["", "", ""],
  );
}

/**
 * The drawn value as content a widget can display.
 *
 * // [LAW:parse-dont-validate] `Content` is the stamp. Handing the rows across
 * as a plain string would leave them unparsed, and every content widget runs an
 * unparsed string through `Content.fromMarkup` — so a value of `"[3]"` would
 * come out as an opening tag rather than three glyphs. Returning a `Content`
 * means the markup boundary has already been crossed here, once, and nothing
 * downstream can re-cross it.
 */
export function digitsContent(value: string | number): Content {
  return new Content(digitsRows(String(value)).join("\n"));
}
