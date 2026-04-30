// [LAW:one-source-of-truth] Disabled-state dimming derives from a single pivot
// color and a single mix function. Per-widget factors live with each widget
// because Textual's Python implementation tunes them per-widget.
// [LAW:single-enforcer] Color dim math lives here; widgets do not redefine it.

export const DISABLED_DIM_TARGET = "#121212";
// Default factor preserves the previous Button-tuned value for any caller
// that does not supply an explicit factor.
export const DISABLED_DIM_FACTOR = 0.5825;

export class HexColorParseError extends Error {
  constructor(input: string) {
    super(`Expected #RRGGBB hex color; got ${JSON.stringify(input)}`);
    this.name = "HexColorParseError";
  }
}

// [LAW:behavior-not-structure] Internal helper. Callers pass values that
// are already known to be hex by the cascade; if they aren't, that is a
// bug at the call site, not a runtime input-validation question. Throws
// loudly rather than returning a sentinel that callers can silently
// swallow with `?? fallback`.
export function parseHexColor(color: string): [number, number, number] {
  const match = color.toLowerCase().match(/^#([0-9a-f]{6})$/);

  if (match === null) {
    throw new HexColorParseError(color);
  }

  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

export function toHexColor(red: number, green: number, blue: number): string {
  const channel = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

export function mixColor(color: string, target: string, factor: number): string {
  const source = parseHexColor(color);
  const destination = parseHexColor(target);

  return toHexColor(
    source[0] + (destination[0] - source[0]) * factor,
    source[1] + (destination[1] - source[1]) * factor,
    source[2] + (destination[2] - source[2]) * factor,
  );
}

// Optionality (`undefined` passthrough) is preserved so callers with
// optional palette entries don't have to write the same null-check at
// every call site. Malformed-hex still throws — silence is reserved for
// "no value to dim", never for "value present but unparseable".
export function dimColor(color: string, factor?: number): string;
export function dimColor(color: string | undefined, factor?: number): string | undefined;
export function dimColor(color: string | undefined, factor: number = DISABLED_DIM_FACTOR): string | undefined {
  return color === undefined ? undefined : mixColor(color, DISABLED_DIM_TARGET, factor);
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
