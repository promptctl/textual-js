function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

const NAMED_COLORS: Record<string, string> = {
  aqua: "#00ffff",
  black: "#000000",
  blue: "#0000ff",
  coral: "#ff7f50",
  deepskyblue: "#00bfff",
  green: "#008000",
  lime: "#00ff00",
  magenta: "#ff00ff",
  orange: "#ffa500",
  rebeccapurple: "#663399",
  red: "#ff0000",
  tomato: "#ff6347",
  transparent: "rgba(0,0,0,0)",
  white: "#ffffff",
  yellow: "#ffff00",
};

function toHexByte(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function normalizeAlpha(value: number): string {
  const normalized = clamp(value, 0, 1);
  return `${normalized}`.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function normalizeHex(value: string): string {
  const hex = value.toLowerCase();

  if (hex.length === 4 || hex.length === 5) {
    return `#${hex
      .slice(1)
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`;
  }

  return hex;
}

function hslToRgb(hueDegrees: number, saturationPercent: number, lightnessPercent: number): [number, number, number] {
  const hue = ((hueDegrees % 360) + 360) % 360 / 360;
  const saturation = clamp(saturationPercent, 0, 100) / 100;
  const lightness = clamp(lightnessPercent, 0, 100) / 100;

  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return [channel, channel, channel];
  }

  const hueToChannel = (p: number, q: number, t: number): number => {
    let adjusted = t;

    if (adjusted < 0) {
      adjusted += 1;
    }

    if (adjusted > 1) {
      adjusted -= 1;
    }

    if (adjusted < 1 / 6) {
      return p + (q - p) * 6 * adjusted;
    }

    if (adjusted < 1 / 2) {
      return q;
    }

    if (adjusted < 2 / 3) {
      return p + (q - p) * (2 / 3 - adjusted) * 6;
    }

    return p;
  };

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return [
    Math.round(hueToChannel(p, q, hue + 1 / 3) * 255),
    Math.round(hueToChannel(p, q, hue) * 255),
    Math.round(hueToChannel(p, q, hue - 1 / 3) * 255),
  ];
}

export function normalizeColor(input: string): string {
  const value = input.trim().toLowerCase();
  const namedColor = NAMED_COLORS[value];

  if (namedColor !== undefined) {
    return namedColor;
  }

  const hexMatch = value.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);

  if (hexMatch !== null) {
    return normalizeHex(value);
  }

  const rgbMatch = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);

  if (rgbMatch !== null) {
    return `#${toHexByte(Number(rgbMatch[1]))}${toHexByte(Number(rgbMatch[2]))}${toHexByte(Number(rgbMatch[3]))}`;
  }

  const rgbaMatch = value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(-?\d*\.?\d+)\s*\)$/);

  if (rgbaMatch !== null) {
    return `rgba(${clamp(Number(rgbaMatch[1]), 0, 255)},${clamp(Number(rgbaMatch[2]), 0, 255)},${clamp(
      Number(rgbaMatch[3]),
      0,
      255,
    )},${normalizeAlpha(Number(rgbaMatch[4]))})`;
  }

  const hslMatch = value.match(/^hsl\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)%\s*,\s*(-?\d*\.?\d+)%\s*\)$/);

  if (hslMatch !== null) {
    const [red, green, blue] = hslToRgb(Number(hslMatch[1]), Number(hslMatch[2]), Number(hslMatch[3]));
    return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
  }

  const hslaMatch = value.match(
    /^hsla\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)%\s*,\s*(-?\d*\.?\d+)%\s*,\s*(-?\d*\.?\d+)\s*\)$/,
  );

  if (hslaMatch !== null) {
    const [red, green, blue] = hslToRgb(Number(hslaMatch[1]), Number(hslaMatch[2]), Number(hslaMatch[3]));
    return `rgba(${red},${green},${blue},${normalizeAlpha(Number(hslaMatch[4]))})`;
  }

  throw new Error(`Invalid color "${input}"`);
}
