import { Color } from "./color.js";

/**
 * The one spelling of a colour every consumer downstream accepts: an opaque
 * lowercase hex, or nothing at all.
 *
 * Both consumers are stricter than `Color.css` is. Ink resolves a colour
 * through chalk, and rich-js's `Style` parses it itself — and rich-js rejects
 * the `rgba(r,g,b,a)` form `Color.css` returns for any alpha below 1, throwing
 * `Failed to parse color` out of style resolution. That crashed two different
 * paths: a widget's own `background` since long before border cells were
 * painted here, and every border edge colour once those cells started reaching
 * rich-js instead of Ink's `borderColor`.
 *
 * Alpha is dropped rather than composited. Textual blends a translucent colour
 * over whatever lies beneath it, and nothing in this port does: a widget's
 * rules resolve with no ancestor in hand, and `EdgeGrounds.outer` is
 * `undefined` precisely because what sits under a widget is unknown here.
 * `placeholder.ts` pre-blends its own background against the theme base for
 * this same reason and documents the same limitation. Dropping alpha keeps the
 * hue the stylesheet asked for; mapping it to `undefined` instead would make a
 * translucent colour indistinguishable from no colour at all.
 *
 * Alpha 0 is the one case that genuinely carries no colour — `transparent`
 * means the ground shows through, which is what `undefined` means to every
 * consumer here.
 */
export function colorToInkValue(value: Color | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Color) {
    return value.alpha === 0 ? undefined : value.hex6.toLowerCase();
  }

  return value;
}
