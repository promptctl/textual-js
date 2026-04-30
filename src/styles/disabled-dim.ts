// [LAW:one-source-of-truth] Disabled-state dimming derives from a single pivot
// color and a single mix function. Per-widget factors live with each widget
// because Textual's Python implementation tunes them per-widget.
// [LAW:single-enforcer] Color dim math lives here; widgets do not redefine it.

export const DISABLED_DIM_TARGET = "#121212";
// Default factor preserves the previous Button-tuned value for any caller
// that does not supply an explicit factor.
export const DISABLED_DIM_FACTOR = 0.5825;

export function parseHexColor(color: string): [number, number, number] | null {
  // [LAW:single-enforcer] CSS custom-property values arrive with the
  // whitespace from `: value;` parsing intact; trim once here so every
  // consumer of dimColor stays a one-liner.
  const match = color.trim().toLowerCase().match(/^#([0-9a-f]{6})$/);

  if (match === null) {
    return null;
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

export function mixColor(color: string, target: string, factor: number): string | undefined {
  const source = parseHexColor(color);
  const destination = parseHexColor(target);

  if (source === null || destination === null) {
    return undefined;
  }

  return toHexColor(
    source[0] + (destination[0] - source[0]) * factor,
    source[1] + (destination[1] - source[1]) * factor,
    source[2] + (destination[2] - source[2]) * factor,
  );
}

export function dimColor(
  color: string | undefined,
  factor: number = DISABLED_DIM_FACTOR,
): string | undefined {
  return color === undefined
    ? undefined
    : mixColor(color, DISABLED_DIM_TARGET, factor) ?? color;
}
