import { ColorRgba } from "rich-js";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function clampAlpha(value: number): number {
  return clamp(value, 0, 1);
}

const CSS_NAMED_COLORS: Record<string, string> = {
  aliceblue: "#f0f8ff",
  antiquewhite: "#faebd7",
  aqua: "#00ffff",
  aquamarine: "#7fffd4",
  azure: "#f0ffff",
  beige: "#f5f5dc",
  bisque: "#ffe4c4",
  black: "#000000",
  blanchedalmond: "#ffebcd",
  blue: "#0000ff",
  blueviolet: "#8a2be2",
  brown: "#a52a2a",
  burlywood: "#deb887",
  cadetblue: "#5f9ea0",
  chartreuse: "#7fff00",
  chocolate: "#d2691e",
  coral: "#ff7f50",
  cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc",
  crimson: "#dc143c",
  cyan: "#00ffff",
  darkblue: "#00008b",
  darkcyan: "#008b8b",
  darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9",
  darkgreen: "#006400",
  darkgrey: "#a9a9a9",
  darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b",
  darkolivegreen: "#556b2f",
  darkorange: "#ff8c00",
  darkorchid: "#9932cc",
  darkred: "#8b0000",
  darksalmon: "#e9967a",
  darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f",
  darkslategrey: "#2f4f4f",
  darkturquoise: "#00ced1",
  darkviolet: "#9400d3",
  deeppink: "#ff1493",
  deepskyblue: "#00bfff",
  dimgray: "#696969",
  dimgrey: "#696969",
  dodgerblue: "#1e90ff",
  firebrick: "#b22222",
  floralwhite: "#fffaf0",
  forestgreen: "#228b22",
  fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff",
  gold: "#ffd700",
  goldenrod: "#daa520",
  gray: "#808080",
  green: "#008000",
  greenyellow: "#adff2f",
  grey: "#808080",
  honeydew: "#f0fff0",
  hotpink: "#ff69b4",
  indianred: "#cd5c5c",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00",
  lemonchiffon: "#fffacd",
  lightblue: "#add8e6",
  lightcoral: "#f08080",
  lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2",
  lightgray: "#d3d3d3",
  lightgreen: "#90ee90",
  lightgrey: "#d3d3d3",
  lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa",
  lightslategray: "#778899",
  lightslategrey: "#778899",
  lightsteelblue: "#b0c4de",
  lightyellow: "#ffffe0",
  lime: "#00ff00",
  limegreen: "#32cd32",
  linen: "#faf0e6",
  magenta: "#ff00ff",
  maroon: "#800000",
  mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd",
  mediumorchid: "#ba55d3",
  mediumpurple: "#9370db",
  mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585",
  midnightblue: "#191970",
  mintcream: "#f5fffa",
  mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  navy: "#000080",
  oldlace: "#fdf5e6",
  olive: "#808000",
  olivedrab: "#6b8e23",
  orange: "#ffa500",
  orangered: "#ff4500",
  orchid: "#da70d6",
  palegoldenrod: "#eee8aa",
  palegreen: "#98fb98",
  paleturquoise: "#afeeee",
  palevioletred: "#db7093",
  papayawhip: "#ffefd5",
  peachpuff: "#ffdab9",
  peru: "#cd853f",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  powderblue: "#b0e0e6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  rosybrown: "#bc8f8f",
  royalblue: "#4169e1",
  saddlebrown: "#8b4513",
  salmon: "#fa8072",
  sandybrown: "#f4a460",
  seagreen: "#2e8b57",
  seashell: "#fff5ee",
  sienna: "#a0522d",
  silver: "#c0c0c0",
  skyblue: "#87ceeb",
  slateblue: "#6a5acd",
  slategray: "#708090",
  slategrey: "#708090",
  snow: "#fffafa",
  springgreen: "#00ff7f",
  steelblue: "#4682b4",
  tan: "#d2b48c",
  teal: "#008080",
  thistle: "#d8bfd8",
  tomato: "#ff6347",
  transparent: "#00000000",
  turquoise: "#40e0d0",
  violet: "#ee82ee",
  wheat: "#f5deb3",
  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  yellow: "#ffff00",
  yellowgreen: "#9acd32",
};

const ANSI_COLOR_INDEXES: Record<string, number> = {
  ansi_black: 0,
  ansi_red: 1,
  ansi_green: 2,
  ansi_yellow: 3,
  ansi_blue: 4,
  ansi_magenta: 5,
  ansi_cyan: 6,
  ansi_white: 7,
  ansi_bright_black: 8,
  ansi_bright_red: 9,
  ansi_bright_green: 10,
  ansi_bright_yellow: 11,
  ansi_bright_blue: 12,
  ansi_bright_magenta: 13,
  ansi_bright_cyan: 14,
  ansi_bright_white: 15,
};

export class ColorParseError extends Error {}

export interface HslColor {
  h: number;
  s: number;
  l: number;
  css: string;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

function toHexByte(value: number): string {
  return clampByte(value).toString(16).padStart(2, "0");
}

function toAlphaHex(value: number): string {
  return Math.floor(clampAlpha(value) * 255).toString(16).padStart(2, "0");
}

function normalizeAlpha(value: number): string {
  const normalized = clampAlpha(value);
  return `${normalized}`.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function parseHexChannels(value: string): [number, number, number, number] {
  const hex = value.toLowerCase();
  const expanded =
    hex.length === 4 || hex.length === 5
      ? hex
          .slice(1)
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex.slice(1);
  const alphaHex = expanded.length === 8 ? expanded.slice(6, 8) : "ff";

  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
    Number.parseInt(alphaHex, 16) / 255,
  ];
}

function hslToRgb(hueDegrees: number, saturationPercent: number, lightnessPercent: number): [number, number, number] {
  const hue = (((hueDegrees % 360) + 360) % 360) / 360;
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
    Math.round(hueToChannel(p, q, hue + 1 / 3) * 255 + 1e-10),
    Math.round(hueToChannel(p, q, hue) * 255 + 1e-10),
    Math.round(hueToChannel(p, q, hue - 1 / 3) * 255 + 1e-10),
  ];
}

function rgbToHsl(red: number, green: number, blue: number): HslColor {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    delta === 0
      ? 0
      : max === r
        ? (((g - b) / delta) % 6) / 6
        : max === g
          ? ((b - r) / delta + 2) / 6
          : ((r - g) / delta + 4) / 6;
  const normalizedHue = (hue + 1) % 1;
  const hueDegrees = Math.round(normalizedHue * 360);
  const saturationPercent = Number((saturation * 100).toFixed(1));
  const lightnessPercent = Number((lightness * 100).toFixed(1));

  return {
    h: normalizedHue,
    s: saturation,
    l: lightness,
    css: `hsl(${hueDegrees},${saturationPercent}%,${lightnessPercent}%)`,
  };
}

function rgbToHsv(red: number, green: number, blue: number): HsvColor {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const hue =
    delta === 0
      ? 0
      : max === r
        ? (((g - b) / delta) % 6) / 6
        : max === g
          ? ((b - r) / delta + 2) / 6
          : ((r - g) / delta + 4) / 6;

  return {
    h: (hue + 1) % 1,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function xyzPivot(value: number): number {
  return value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
}

function labPivot(value: number): number {
  const cube = value ** 3;
  return cube > 0.008856 ? cube : (value - 16 / 116) / 7.787;
}

function gammaExpand(value: number): number {
  return value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92;
}

function gammaCompress(value: number): number {
  return value > 0.0031308 ? 1.055 * value ** (1 / 2.4) - 0.055 : 12.92 * value;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current.push(
        Math.min(
          current[rightIndex]! + 1,
          previous[rightIndex + 1]! + 1,
          previous[rightIndex]! + substitutionCost,
        ),
      );
    }

    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length]!;
}

export function suggestColorName(input: string): string | undefined {
  const normalized = input.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const candidates = Object.keys(CSS_NAMED_COLORS);
  const scored = candidates
    .map((candidate) => ({ candidate, score: editDistance(normalized, candidate) }))
    .sort((left, right) => left.score - right.score || left.candidate.localeCompare(right.candidate));
  const best = scored[0];

  return best !== undefined && best.score <= Math.max(2, Math.floor(normalized.length / 3)) ? best.candidate : undefined;
}

function colorParseMessage(input: string): string {
  const suggestion = /^[A-Za-z][A-Za-z\s_-]*$/.test(input) ? suggestColorName(input) : undefined;
  const suffix = suggestion === undefined ? "" : `. Did you mean "${suggestion}"?`;

  return `Invalid color "${input}"${suffix}`;
}

export class Color {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  readonly ansi: number | undefined;
  readonly isAutomatic: boolean;
  readonly automaticPercentage: number | undefined;

  constructor(
    red: number,
    green: number,
    blue: number,
    alpha = 1,
    options: { ansi?: number; auto?: boolean; automaticPercentage?: number } = {},
  ) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
    this.ansi = options.ansi;
    this.isAutomatic = options.auto === true;
    this.automaticPercentage = options.automaticPercentage;
  }

  static parse(input: string | Color): Color {
    if (input instanceof Color) {
      return input;
    }

    const value = input.trim().toLowerCase();
    const opacitySuffixMatch = value.match(/^(.+?)\s+(-?\d*\.?\d+)%$/);

    if (opacitySuffixMatch !== null && opacitySuffixMatch[1] !== "auto") {
      return Color.parse(opacitySuffixMatch[1]).withAlpha(Number(opacitySuffixMatch[2]) / 100);
    }

    const automaticMatch = value.match(/^auto(?:\s+(-?\d*\.?\d+)%)?$/);

    if (automaticMatch !== null) {
      return Color.automatic(automaticMatch[1] === undefined ? undefined : Number(automaticMatch[1]) / 100);
    }

    const ansi = ANSI_COLOR_INDEXES[value];

    if (ansi !== undefined) {
      return new Color(0, 0, 0, 1, { ansi });
    }

    const namedColor = CSS_NAMED_COLORS[value];

    if (namedColor !== undefined) {
      return Color.parse(namedColor);
    }

    const hexMatch = value.match(/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);

    if (hexMatch !== null) {
      const [red, green, blue, alpha] = parseHexChannels(value);
      return new Color(red, green, blue, alpha);
    }

    const rgbMatch = value.match(/^rgb\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/);

    if (rgbMatch !== null) {
      return new Color(clampByte(Number(rgbMatch[1])), clampByte(Number(rgbMatch[2])), clampByte(Number(rgbMatch[3])));
    }

    const rgbaMatch = value.match(
      /^rgba\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/,
    );

    if (rgbaMatch !== null) {
      return new Color(
        clampByte(Number(rgbaMatch[1])),
        clampByte(Number(rgbaMatch[2])),
        clampByte(Number(rgbaMatch[3])),
        clampAlpha(Number(rgbaMatch[4])),
      );
    }

    const hslMatch = value.match(/^hsl\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)%\s*,\s*(-?\d*\.?\d+)%\s*\)$/);

    if (hslMatch !== null) {
      const [red, green, blue] = hslToRgb(Number(hslMatch[1]), Number(hslMatch[2]), Number(hslMatch[3]));
      return new Color(red, green, blue);
    }

    const hslaMatch = value.match(
      /^hsla\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)%\s*,\s*(-?\d*\.?\d+)%\s*,\s*(-?\d*\.?\d+)\s*\)$/,
    );

    if (hslaMatch !== null) {
      const [red, green, blue] = hslToRgb(Number(hslaMatch[1]), Number(hslaMatch[2]), Number(hslaMatch[3]));
      return new Color(red, green, blue, clampAlpha(Number(hslaMatch[4])));
    }

    throw new ColorParseError(colorParseMessage(input));
  }

  static fromHsl(hue: number, saturation: number, lightness: number): Color {
    const [red, green, blue] = hslToRgb(hue * 360, saturation * 100, lightness * 100);
    return new Color(red, green, blue);
  }

  static fromHsv(hue: number, saturation: number, value: number): Color {
    const h = (((hue % 1) + 1) % 1) * 6;
    const c = value * saturation;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = value - c;
    const [r, g, b] =
      h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];

    return new Color((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  static automatic(percentage?: number): Color {
    return new Color(0, 0, 0, 1, { auto: true, automaticPercentage: percentage });
  }

  static fromRichColor(color: ColorRgba): Color {
    return new Color(color.red, color.green, color.blue, color.alpha);
  }

  static from_hsl(hue: number, saturation: number, lightness: number): Color {
    return Color.fromHsl(hue, saturation, lightness);
  }

  static from_hsv(hue: number, saturation: number, value: number): Color {
    return Color.fromHsv(hue, saturation, value);
  }

  static from_rich_color(color: ColorRgba): Color {
    return Color.fromRichColor(color);
  }

  get rgb(): [number, number, number] {
    return [clampByte(this.red), clampByte(this.green), clampByte(this.blue)];
  }

  get normalized(): [number, number, number] {
    const [red, green, blue] = this.rgb;
    return [red / 255, green / 255, blue / 255];
  }

  get hsl(): HslColor {
    const [red, green, blue] = this.rgb;
    return rgbToHsl(red, green, blue);
  }

  get hsv(): HsvColor {
    const [red, green, blue] = this.rgb;
    return rgbToHsv(red, green, blue);
  }

  get brightness(): number {
    const [red, green, blue] = this.normalized;
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  get hex6(): string {
    const [red, green, blue] = this.rgb;
    return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`.toUpperCase();
  }

  get hex(): string {
    return this.alpha === 1 ? this.hex6 : `${this.hex6}${toAlphaHex(this.alpha)}`.toUpperCase();
  }

  get css(): string {
    if (this.isAutomatic) {
      const percentage = this.automaticPercentage === undefined ? 50 : this.automaticPercentage * 100;
      return `auto ${Number(percentage.toFixed(3))}%`;
    }

    if (this.ansi !== undefined) {
      return Object.entries(ANSI_COLOR_INDEXES).find(([, value]) => value === this.ansi)?.[0] ?? `ansi_${this.ansi}`;
    }

    const [red, green, blue] = this.rgb;
    return this.alpha === 1 ? `rgb(${red},${green},${blue})` : `rgba(${red},${green},${blue},${normalizeAlpha(this.alpha)})`;
  }

  get isTransparent(): boolean {
    return this.ansi === undefined && this.alpha === 0;
  }

  get is_transparent(): boolean {
    return this.isTransparent;
  }

  get richColor(): ColorRgba {
    const [red, green, blue] = this.rgb;
    return new ColorRgba(red, green, blue);
  }

  get rich_color(): ColorRgba {
    return this.richColor;
  }

  get clamped(): Color {
    return new Color(clampByte(this.red), clampByte(this.green), clampByte(this.blue), clampAlpha(this.alpha), {
      ansi: this.ansi,
      auto: this.isAutomatic,
      automaticPercentage: this.automaticPercentage,
    });
  }

  get monochrome(): Color {
    const channel = clampByte(this.brightness * 255);
    return new Color(channel, channel, channel, this.alpha, { ansi: this.ansi });
  }

  get inverse(): Color {
    const [red, green, blue] = this.rgb;
    return new Color(255 - red, 255 - green, 255 - blue, this.alpha, { ansi: this.ansi });
  }

  withAlpha(alpha: number): Color {
    return new Color(this.red, this.green, this.blue, clampAlpha(alpha), {
      ansi: this.ansi,
      auto: this.isAutomatic,
      automaticPercentage: this.automaticPercentage,
    });
  }

  multiplyAlpha(factor: number): Color {
    return this.withAlpha(this.alpha * factor);
  }

  with_alpha(alpha: number): Color {
    return this.withAlpha(alpha);
  }

  multiply_alpha(factor: number): Color {
    return this.multiplyAlpha(factor);
  }

  get luminance(): number {
    const [red, green, blue] = this.normalized.map(gammaExpand) as [number, number, number];
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  contrastRatio(other: Color): number {
    const lighter = Math.max(this.luminance, other.luminance);
    const darker = Math.min(this.luminance, other.luminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  contrast_ratio(other: Color): number {
    return this.contrastRatio(other);
  }

  getContrastText(alpha = 0.95): Color {
    const white = new Color(255, 255, 255, alpha);
    const black = new Color(0, 0, 0, alpha);
    return this.contrastRatio(white) >= this.contrastRatio(black) ? white : black;
  }

  get_contrast_text(alpha = 0.95): Color {
    return this.getContrastText(alpha);
  }

  blend(other: Color, factor: number): Color {
    const clampedFactor = clamp(factor, 0, 1);
    const [red, green, blue] = this.rgb;
    const [otherRed, otherGreen, otherBlue] = other.rgb;

    return new Color(
      red + (otherRed - red) * clampedFactor,
      green + (otherGreen - green) * clampedFactor,
      blue + (otherBlue - blue) * clampedFactor,
      this.alpha + (other.alpha - this.alpha) * clampedFactor,
    ).clamped;
  }

  tint(tintColor: Color): Color {
    if (tintColor.ansi !== undefined) {
      return this;
    }

    return this.blend(tintColor, tintColor.alpha).withAlpha(this.alpha);
  }

  add(other: Color): Color {
    const concreteOther = other.isAutomatic ? other.resolveAutomatic(this) : other;
    return concreteOther.alpha === 1 ? concreteOther : this.blend(concreteOther, concreteOther.alpha);
  }

  darken(amount: number): Color {
    return amount < 0 ? this.lighten(-amount) : this.blend(new Color(0, 0, 0, this.alpha), amount).withAlpha(this.alpha);
  }

  lighten(amount: number): Color {
    return amount < 0 ? this.darken(-amount) : this.blend(new Color(255, 255, 255, this.alpha), amount).withAlpha(this.alpha);
  }

  private resolveAutomatic(background: Color): Color {
    const target = background.brightness < 0.5 ? new Color(255, 255, 255) : new Color(0, 0, 0);
    const percentage = this.automaticPercentage ?? 1;
    return background.blend(target, percentage);
  }
}

export function rgbToLab(color: Color): Lab {
  const [red, green, blue] = color.normalized.map(gammaExpand) as [number, number, number];
  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047;
  const y = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883;
  const fx = xyzPivot(x);
  const fy = xyzPivot(y);
  const fz = xyzPivot(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToRgb(lab: Lab): Color {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  const x = 0.95047 * labPivot(fx);
  const y = labPivot(fy);
  const z = 1.08883 * labPivot(fz);
  const red = gammaCompress(x * 3.2406 + y * -1.5372 + z * -0.4986) * 255;
  const green = gammaCompress(x * -0.9689 + y * 1.8758 + z * 0.0415) * 255;
  const blue = gammaCompress(x * 0.0557 + y * -0.204 + z * 1.057) * 255;

  return new Color(red, green, blue).clamped;
}

export const rgb_to_lab = rgbToLab;
export const lab_to_rgb = labToRgb;

export interface GradientOptions {
  quality?: number;
}

export class Gradient {
  readonly stops: Array<{ position: number; color: Color }>;
  readonly quality: number;
  private readonly samples: Color[];

  constructor(...entries: Array<[number, Color | string] | GradientOptions>) {
    const lastEntry = entries[entries.length - 1];
    const options =
      Array.isArray(lastEntry) || lastEntry === undefined
        ? {}
        : (entries.pop() as GradientOptions);
    const stops = entries as Array<[number, Color | string]>;

    if (stops.length < 2) {
      throw new Error("Gradient requires at least two stops");
    }

    const parsedStops = stops
      .map(([position, color]) => ({ position, color: Color.parse(color) }))
      .sort((left, right) => left.position - right.position);

    if (parsedStops[0]?.position !== 0 || parsedStops[parsedStops.length - 1]?.position !== 1) {
      throw new Error("Gradient stops must start at 0.0 and end at 1.0");
    }

    this.stops = parsedStops;
    this.quality = Math.max(2, Math.floor(options.quality ?? 100));
    // [LAW:one-source-of-truth] Gradient samples are derived from validated stops;
    // callers never provide or mutate a second interpolation table.
    this.samples = Array.from({ length: this.quality }, (_value, index) =>
      this.interpolate(index / (this.quality - 1)),
    );
  }

  static fromColors(...colors: Array<Color | string>): Gradient {
    if (colors.length < 2) {
      throw new Error("Gradient.fromColors requires at least two colors");
    }

    const divisor = colors.length - 1;
    return new Gradient(...colors.map((color, index) => [index / divisor, color] as [number, Color | string]));
  }

  static from_colors(...colors: Array<Color | string>): Gradient {
    return Gradient.fromColors(...colors);
  }

  private interpolate(position: number): Color {
    const clampedPosition = clamp(position, 0, 1);

    for (let index = 1; index < this.stops.length; index += 1) {
      const previous = this.stops[index - 1];
      const next = this.stops[index];

      if (previous === undefined || next === undefined) {
        continue;
      }

      if (clampedPosition <= next.position) {
        const span = next.position - previous.position;
        const factor = span === 0 ? 0 : (clampedPosition - previous.position) / span;
        return previous.color.blend(next.color, factor);
      }
    }

    return this.stops[this.stops.length - 1]!.color;
  }

  getColor(position: number): Color {
    const clampedPosition = clamp(position, 0, 1);
    const exactStop = this.stops.find((stop) => stop.position === clampedPosition);

    if (exactStop !== undefined) {
      return exactStop.color;
    }

    const index = Math.round(clampedPosition * (this.samples.length - 1));
    return this.samples[index] ?? this.stops[this.stops.length - 1]!.color;
  }

  get_color(position: number): Color {
    return this.getColor(position);
  }
}

export function normalizeColor(input: string | Color): string {
  const color = Color.parse(input);

  // [LAW:one-source-of-truth] Color.parse is the single parser for style color
  // inputs; normalizeColor only serializes the canonical Color for Ink callers.
  if (color.isAutomatic || color.ansi !== undefined) {
    return color.css;
  }

  if (typeof input === "string") {
    const normalizedInput = input.trim().toLowerCase();

    if (
      normalizedInput === "transparent" ||
      normalizedInput.startsWith("rgba(") ||
      normalizedInput.startsWith("hsla(") ||
      /^.+\s+-?\d*\.?\d+%$/.test(normalizedInput)
    ) {
      const [red, green, blue] = color.rgb;
      return `rgba(${red},${green},${blue},${normalizeAlpha(color.alpha)})`;
    }

    if (/^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/.test(normalizedInput)) {
      const expanded =
        normalizedInput.length === 5
          ? normalizedInput
              .slice(1)
              .split("")
              .map((part) => `${part}${part}`)
              .join("")
          : normalizedInput.slice(1);
      return `#${expanded}`;
    }
  }

  return color.alpha === 1 ? color.hex6.toLowerCase() : color.hex.toLowerCase();
}
