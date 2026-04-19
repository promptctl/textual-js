import { makeAutoObservable, observable } from "mobx";

import { normalizeColor } from "../styles/color.js";

export interface ThemeDefinition {
  name: string;
  dark: boolean;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  panel: string;
  foreground: string;
  warning: string;
  error: string;
  success: string;
  variables?: Record<string, string | number>;
}

export interface ActiveTheme extends ThemeDefinition {
  variables: Record<string, string>;
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

function normalizeThemeVariable(value: string | number): string {
  if (typeof value === "number") {
    return `${value}`;
  }

  try {
    return normalizeColor(value);
  } catch {
    return value.trim();
  }
}

function normalizeTheme(theme: ThemeDefinition): ActiveTheme {
  return {
    ...theme,
    primary: normalizeColor(theme.primary),
    secondary: normalizeColor(theme.secondary),
    accent: normalizeColor(theme.accent),
    background: normalizeColor(theme.background),
    surface: normalizeColor(theme.surface),
    panel: normalizeColor(theme.panel),
    foreground: normalizeColor(theme.foreground),
    warning: normalizeColor(theme.warning),
    error: normalizeColor(theme.error),
    success: normalizeColor(theme.success),
    variables: Object.fromEntries(
      Object.entries(theme.variables ?? {}).map(([name, value]) => [name, normalizeThemeVariable(value)]),
    ),
  };
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
    makeAutoObservable(
      this,
      {
        themes: false,
        ansiThemeDark: observable.ref,
        ansiThemeLight: observable.ref,
      } as never,
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

    return {
      "--theme-primary": theme.primary,
      "--theme-secondary": theme.secondary,
      "--theme-accent": theme.accent,
      "--theme-background": theme.background,
      "--theme-surface": theme.surface,
      "--theme-panel": theme.panel,
      "--theme-foreground": theme.foreground,
      "--theme-warning": theme.warning,
      "--theme-error": theme.error,
      "--theme-success": theme.success,
      "--primary": theme.primary,
      "--secondary": theme.secondary,
      "--accent": theme.accent,
      "--background": theme.background,
      "--surface": theme.surface,
      "--panel": theme.panel,
      "--foreground": theme.foreground,
      "--warning": theme.warning,
      "--error": theme.error,
      "--success": theme.success,
      ...Object.fromEntries(
        Object.entries(theme.variables).map(([name, value]) => [`--${name.replace(/^--/, "")}`, value]),
      ),
    };
  }
}
