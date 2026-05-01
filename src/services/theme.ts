import { observable } from "mobx";
import { autoObservable } from "../framework/auto-observable.js";

import { Color, normalizeColor } from "../styles/color.js";

type ThemeColorInput = string | Color;
type ThemeVariableInput = string | number | Color;
type ActiveThemeVariable = string | Color;
type ThemePaletteKey =
  | "primary"
  | "secondary"
  | "accent"
  | "background"
  | "surface"
  | "panel"
  | "foreground"
  | "warning"
  | "error"
  | "success";

const THEME_PALETTE_KEYS: ThemePaletteKey[] = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "panel",
  "foreground",
  "warning",
  "error",
  "success",
];

const DERIVED_STEPS = [1, 2, 3] as const;

export interface ThemeDefinition {
  name: string;
  dark: boolean;
  primary: ThemeColorInput;
  secondary: ThemeColorInput;
  accent: ThemeColorInput;
  background: ThemeColorInput;
  surface: ThemeColorInput;
  panel: ThemeColorInput;
  foreground: ThemeColorInput;
  warning: ThemeColorInput;
  error: ThemeColorInput;
  success: ThemeColorInput;
  variables?: Record<string, ThemeVariableInput>;
}

export interface ActiveTheme extends Omit<ThemeDefinition, ThemePaletteKey | "variables"> {
  primary: Color;
  secondary: Color;
  accent: Color;
  background: Color;
  surface: Color;
  panel: Color;
  foreground: Color;
  warning: Color;
  error: Color;
  success: Color;
  variables: Record<string, ActiveThemeVariable>;
}

export interface AnsiTheme {
  name: string;
  colors: readonly string[];
}

export const ANSI_THEME_LIGHT: AnsiTheme = {
  name: "textual-light",
  colors: [
    "#000000",
    "#ba2121",
    "#008000",
    "#a45c00",
    "#0044aa",
    "#7a1fa2",
    "#008b8b",
    "#f0f0f0",
    "#555555",
    "#d32f2f",
    "#2e7d32",
    "#b26b00",
    "#0178d4",
    "#6d28d9",
    "#008b8b",
    "#ffffff",
  ],
};

export const ANSI_THEME_DARK: AnsiTheme = {
  name: "textual-dark",
  colors: [
    "#0d1117",
    "#f85149",
    "#3fb950",
    "#d29922",
    "#58a6ff",
    "#bc8cff",
    "#39c5cf",
    "#b1bac4",
    "#6e7681",
    "#ff7b72",
    "#56d364",
    "#e3b341",
    "#79c0ff",
    "#d2a8ff",
    "#56d4dd",
    "#f0f6fc",
  ],
};

function normalizeThemeVariable(value: ThemeVariableInput): ActiveThemeVariable {
  if (typeof value === "number") {
    return `${value}`;
  }

  if (value instanceof Color) {
    return value;
  }

  try {
    return Color.parse(value);
  } catch {
    return value.trim();
  }
}

function normalizeTheme(theme: ThemeDefinition): ActiveTheme {
  return {
    ...theme,
    // [LAW:one-source-of-truth] Theme palette inputs are parsed once at the
    // registration boundary; active themes carry Color as the canonical model.
    primary: Color.parse(theme.primary),
    secondary: Color.parse(theme.secondary),
    accent: Color.parse(theme.accent),
    background: Color.parse(theme.background),
    surface: Color.parse(theme.surface),
    panel: Color.parse(theme.panel),
    foreground: Color.parse(theme.foreground),
    warning: Color.parse(theme.warning),
    error: Color.parse(theme.error),
    success: Color.parse(theme.success),
    variables: Object.fromEntries(
      Object.entries(theme.variables ?? {}).map(([name, value]) => [name, normalizeThemeVariable(value)]),
    ),
  };
}

function cssVariableValue(value: ActiveThemeVariable): string {
  return value instanceof Color ? normalizeColor(value) : value;
}

function addThemeVariable(target: Record<string, string>, name: string, value: ActiveThemeVariable): void {
  target[`--${name.replace(/^--/, "")}`] = cssVariableValue(value);
}

function getDerivedPaletteVariables(theme: ActiveTheme): Record<string, string> {
  const variables: Record<string, string> = {};

  for (const key of THEME_PALETTE_KEYS) {
    const color = theme[key];

    for (const step of DERIVED_STEPS) {
      const amount = step * 0.15;
      addThemeVariable(variables, `${key}-lighten-${step}`, color.lighten(amount));
      addThemeVariable(variables, `${key}-darken-${step}`, color.darken(amount));
      addThemeVariable(variables, `theme-${key}-lighten-${step}`, color.lighten(amount));
      addThemeVariable(variables, `theme-${key}-darken-${step}`, color.darken(amount));
    }

    addThemeVariable(variables, `${key}-muted`, color.blend(theme.background, 0.7));
    addThemeVariable(variables, `text-${key}`, color.getContrastText());
  }

  addThemeVariable(variables, "foreground-muted", theme.foreground.blend(theme.background, 0.45));
  addThemeVariable(variables, "foreground-disabled", theme.foreground.blend(theme.background, 0.7));
  addThemeVariable(variables, "text", theme.background.getContrastText());
  addThemeVariable(variables, "text-muted", theme.background.getContrastText(0.7));
  addThemeVariable(variables, "text-disabled", theme.background.getContrastText(0.45));

  return variables;
}

export const BUILTIN_THEMES: ThemeDefinition[] = [
  {
    name: "default",
    dark: false,
    primary: "#0178d4",
    secondary: "#3a7ca5",
    accent: "#ff8c42",
    background: "#f6f8fa",
    surface: "#ffffff",
    panel: "#e9eef5",
    foreground: "#202938",
    warning: "#b26b00",
    error: "#c62828",
    success: "#2e7d32",
  },
  {
    name: "dark",
    dark: true,
    primary: "#58a6ff",
    secondary: "#79c0ff",
    accent: "#ffa657",
    background: "#0d1117",
    surface: "#161b22",
    panel: "#21262d",
    foreground: "#f0f6fc",
    warning: "#d29922",
    error: "#f85149",
    success: "#3fb950",
  },
  {
    name: "textual-light",
    dark: false,
    primary: "#5b21b6",
    secondary: "#6d28d9",
    accent: "#ea580c",
    background: "#fffaf3",
    surface: "#ffffff",
    panel: "#efe7da",
    foreground: "#2f1f16",
    warning: "#b45309",
    error: "#dc2626",
    success: "#15803d",
  },
  {
    name: "textual-dark",
    dark: true,
    primary: "#a78bfa",
    secondary: "#c4b5fd",
    accent: "#fb923c",
    background: "#120f1a",
    surface: "#1b1627",
    panel: "#261f36",
    foreground: "#f8f5ff",
    warning: "#f59e0b",
    error: "#f87171",
    success: "#4ade80",
  },
];

export class ThemeManager {
  private readonly themes = observable.map<string, ActiveTheme>();
  activeThemeName = "default";
  ansiThemeDark: AnsiTheme = ANSI_THEME_DARK;
  ansiThemeLight: AnsiTheme = ANSI_THEME_LIGHT;

  constructor() {
    autoObservable(
      this,
      {
        themes: false,
        ansiThemeDark: observable.ref,
        ansiThemeLight: observable.ref,
      },
      { autoBind: true },
    );

    for (const theme of BUILTIN_THEMES) {
      this.register(theme);
    }
  }

  get activeTheme(): ActiveTheme {
    const theme = this.themes.get(this.activeThemeName);

    if (theme === undefined) {
      throw new Error(`Unknown theme "${this.activeThemeName}"`);
    }

    return theme;
  }

  get dark(): boolean {
    return this.activeTheme.dark;
  }

  get ansiTheme(): AnsiTheme {
    return this.dark ? this.ansiThemeDark : this.ansiThemeLight;
  }

  register(theme: ThemeDefinition): ActiveTheme {
    const normalizedTheme = normalizeTheme(theme);
    this.themes.set(normalizedTheme.name, normalizedTheme);
    return normalizedTheme;
  }

  setActiveTheme(name: string): ActiveTheme {
    if (!this.themes.has(name)) {
      throw new Error(`Unknown theme "${name}"`);
    }

    this.activeThemeName = name;
    return this.activeTheme;
  }

  setDarkMode(dark: boolean): ActiveTheme {
    // [LAW:one-source-of-truth] Dark/light mode is derived from the active
    // theme name, so switching mode selects the corresponding theme instead of
    // storing a second mutable dark flag.
    return this.setActiveTheme(dark ? "textual-dark" : "textual-light");
  }

  setAnsiTheme(dark: boolean, theme: AnsiTheme): void {
    if (dark) {
      this.ansiThemeDark = theme;
      return;
    }

    this.ansiThemeLight = theme;
  }

  getCssVariables(): Record<string, string> {
    const theme = this.activeTheme;
    const variables: Record<string, string> = {};

    for (const key of THEME_PALETTE_KEYS) {
      addThemeVariable(variables, `theme-${key}`, theme[key]);
      addThemeVariable(variables, key, theme[key]);
    }

    Object.assign(variables, getDerivedPaletteVariables(theme));

    // [LAW:one-source-of-truth] Theme variables are layered after generated
    // values so explicit theme definitions are the single override boundary.
    for (const [name, value] of Object.entries(theme.variables)) {
      addThemeVariable(variables, name, value);
    }

    return variables;
  }
}
