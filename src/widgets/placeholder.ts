// [LAW:decomposition] Placeholder is one widget: a variant, a label, and the
// colour it was dealt. Every fact about it that does not need React lives here,
// so the component beside this file is wiring and nothing else.

import {
  alignContentInPaddedBox,
  Content,
  type ContentAlign,
  type ContentBox,
} from "../content/index.js";
import type { MeasuredSize } from "../framework/measured-size.js";
import { Color } from "../styles/index.js";

export class InvalidPlaceholderVariant extends Error {}

// Ordered, not a set, because clicking a placeholder walks this order.
export const PLACEHOLDER_VARIANTS = ["default", "size", "text"] as const;

export type PlaceholderVariant = (typeof PLACEHOLDER_VARIANTS)[number];

function friendlyList(values: readonly string[]): string {
  const quoted = values.map((value) => `'${value}'`);
  const last = quoted[quoted.length - 1];

  return quoted.length === 1 ? last : `${quoted.slice(0, -1).join(", ")}, and ${last}`;
}

// [LAW:parse-dont-validate] The one crossing between "some string a caller
// typed" and "a variant this widget can render". Everything downstream takes
// `PlaceholderVariant`, so the renderable table below needs no default arm and
// no unknown-variant branch: an unknown variant cannot reach it.
export function parsePlaceholderVariant(variant: string): PlaceholderVariant {
  const parsed = PLACEHOLDER_VARIANTS.find((candidate) => candidate === variant);

  if (parsed === undefined) {
    throw new InvalidPlaceholderVariant(
      `Valid placeholder variants are ${friendlyList(PLACEHOLDER_VARIANTS)}`,
    );
  }

  return parsed;
}

export function cyclePlaceholderVariant(
  variant: PlaceholderVariant,
  steps: number,
): PlaceholderVariant {
  const start = PLACEHOLDER_VARIANTS.indexOf(variant);

  return PLACEHOLDER_VARIANTS[(start + steps) % PLACEHOLDER_VARIANTS.length];
}

// [LAW:one-source-of-truth] Transcribed from Textual's
// `_PLACEHOLDER_BACKGROUND_COLORS`, and the only transcribed colour data here:
// both colours a placeholder paints are derived from this list below, so a
// background can never disagree with the text drawn on it.
const PLACEHOLDER_SOURCE_COLORS = [
  "#881177",
  "#aa3355",
  "#cc6666",
  "#ee9944",
  "#eedd00",
  "#99dd55",
  "#44dd88",
  "#22ccbb",
  "#00bbcc",
  "#0099cc",
  "#3366bb",
  "#663399",
];

// Upstream sets `background: {colour} 50%` — a translucent colour the
// compositor blends over whatever sits behind the widget. This port paints flat
// colours (`colorToInkValue` emits an opaque hex, and nothing composites alpha
// against an ancestor), so the blend happens here against the dark-theme base
// every visual baseline is captured on. Same trade, and same limitation, as the
// pre-blended rail colours in `sparkline-component.tsx`: a placeholder on a
// differently-coloured parent will not re-blend.
const PLACEHOLDER_BLEND_BASE = Color.parse("#121212");
const PLACEHOLDER_BACKGROUND_ALPHA = 0.5;

// Upstream says `color: $text`, which Textual resolves per widget as its own
// background's contrast text at 87%. This port's `$text` is a theme-level
// variable resolved once against the theme background, so it cannot vary from
// placeholder to placeholder the way the baselines show it varying. Deriving it
// from the blended background is what makes each row's foreground match.
const PLACEHOLDER_TEXT_ALPHA = 0.87;

export interface PlaceholderColors {
  readonly background: string;
  readonly color: string;
}

export const PLACEHOLDER_PALETTE: readonly PlaceholderColors[] = PLACEHOLDER_SOURCE_COLORS.map(
  (hex) => {
    const background = PLACEHOLDER_BLEND_BASE.blend(
      Color.parse(hex),
      PLACEHOLDER_BACKGROUND_ALPHA,
    );

    return {
      background: background.hex6.toLowerCase(),
      color: background.add(background.getContrastText(PLACEHOLDER_TEXT_ALPHA)).hex6.toLowerCase(),
    };
  },
);

// The class a placeholder wears to pick its palette entry. The colour is not an
// instance style because this port registers CSS per widget *type*; making the
// palette a table of classes turns "which colour am I" back into a value
// crossing the class seam. [LAW:dataflow-not-control-flow]
const PLACEHOLDER_COLOR_CLASS_PREFIX = "-placeholder-color-";

export function placeholderColorClass(index: number): string {
  return `${PLACEHOLDER_COLOR_CLASS_PREFIX}${index % PLACEHOLDER_PALETTE.length}`;
}

export function placeholderPaletteCss(): string {
  return PLACEHOLDER_PALETTE.map(
    (colors, index) =>
      `  Placeholder.${PLACEHOLDER_COLOR_CLASS_PREFIX}${index} {\n` +
      `    background: ${colors.background};\n` +
      `    color: ${colors.color};\n` +
      `  }`,
  ).join("\n");
}

// [LAW:no-shared-mutable-globals] Upstream hangs this counter off the running
// App in a `WeakKeyDictionary`, so consecutive placeholders in one app get
// consecutive colours and two apps never share a sequence. Same ownership here:
// one map, one mutator, and an entry that dies with the app that keyed it.
const PLACEHOLDER_COLOR_SEQUENCE = new WeakMap<object, number>();

export function nextPlaceholderColorIndex(app: object): number {
  const next = (PLACEHOLDER_COLOR_SEQUENCE.get(app) ?? -1) + 1;
  PLACEHOLDER_COLOR_SEQUENCE.set(app, next);

  return next;
}

const LOREM_IPSUM_PLACEHOLDER_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam feugiat ac elit sit amet accumsan. Suspendisse bibendum nec libero quis gravida. Phasellus id eleifend ligula. Nullam imperdiet sem tellus, sed vehicula nisl faucibus sit amet. Praesent iaculis tempor ultricies. Sed lacinia, tellus id rutrum lacinia, sapien sapien congue mauris, sit amet pellentesque quam quam vel nisl. Curabitur vulputate erat pellentesque mauris posuere, non dictum risus mattis.";

// Upstream repeats the paragraph five times so the block overflows a
// placeholder of any height; only the rows that fit are ever painted.
const PLACEHOLDER_TEXT_REPEATS = 5;
const PLACEHOLDER_TEXT = Array.from(
  { length: PLACEHOLDER_TEXT_REPEATS },
  () => LOREM_IPSUM_PLACEHOLDER_TEXT,
).join("\n\n");

export interface PlaceholderContentInput {
  readonly label: string;
  readonly size: MeasuredSize;
}

// Upstream renders the size through markup, `"[b]{} x {}[/b]"`. The same bold
// span is assembled directly so the widget never routes generated text back
// through the markup parser.
function sizeContent({ width, height }: MeasuredSize): Content {
  // Both axes come from `MeasuredSizeReader`, where `undefined` means "not
  // placed yet" rather than "zero". Upstream is in the same state before its
  // first resize event and holds the empty string until one arrives.
  return width === undefined || height === undefined
    ? new Content("")
    : Content.styled(`${width} x ${height}`, "bold");
}

const CENTRED: ContentAlign = { horizontal: "center", vertical: "middle" };

// Upstream declares `content-align: center middle` for every variant, and the
// text variant lands top-left anyway: the wrapped paragraph is as wide as the
// box, so horizontal centring has no slack to spend, and it is taller than the
// box, so Textual's compositor crops it from the top whatever the vertical
// alignment asks for. Naming that outcome is what makes it survive here, where
// centring an over-tall block would obediently start it mid-sentence.
const TOP_LEFT: ContentAlign = { horizontal: "left", vertical: "top" };

interface PlaceholderRendering {
  readonly content: (input: PlaceholderContentInput) => Content;
  readonly align: ContentAlign;
  readonly padding: number;
}

// [LAW:dataflow-not-control-flow] One entry per variant, selected by value.
// Adding a variant is a row here; it is never a branch anywhere else.
const PLACEHOLDER_RENDERINGS: Record<PlaceholderVariant, PlaceholderRendering> = {
  // `new Content` rather than `Content.fromText`, which parses markup: a label
  // is a caller's plain string, and "[draft]" must survive as seven visible
  // characters instead of vanishing into an unknown tag.
  default: { content: ({ label }) => new Content(label), align: CENTRED, padding: 0 },
  size: { content: ({ size }) => sizeContent(size), align: CENTRED, padding: 0 },
  text: { content: () => new Content(PLACEHOLDER_TEXT), align: TOP_LEFT, padding: 1 },
};

export function placeholderContent(
  variant: PlaceholderVariant,
  input: PlaceholderContentInput,
): Content {
  const rendering = PLACEHOLDER_RENDERINGS[variant];
  const content = rendering.content(input);
  const box = measuredBox(input.size);

  // Before the first measurement there is no region to paint, so the caption
  // goes out at its natural size and the widget is placed around it — the same
  // "size yourself" pass every measured widget takes.
  return box === undefined
    ? content
    : alignContentInPaddedBox(content, box, rendering.padding, rendering.align);
}

function measuredBox({ width, height }: MeasuredSize): ContentBox | undefined {
  return width === undefined || height === undefined ? undefined : { width, height };
}

// Upstream falls back through label → `#id` → the type name, on truthiness, so
// an explicitly empty label reads as "no label given" there and here alike.
export function placeholderLabel(label: string | undefined, id: string | undefined): string {
  return label !== undefined && label !== ""
    ? label
    : id !== undefined && id !== ""
      ? `#${id}`
      : "Placeholder";
}

// [LAW:one-source-of-truth] The public `Placeholder` name belongs to the React
// component; this state holder stays behind the model seam, as `StaticModel`
// does for `Static`.
export class PlaceholderModel {
  private _variant: PlaceholderVariant;

  constructor(variant = "default") {
    this._variant = parsePlaceholderVariant(variant);
  }

  get variant(): PlaceholderVariant {
    return this._variant;
  }

  set variant(value: string) {
    this._variant = parsePlaceholderVariant(value);
  }
}
