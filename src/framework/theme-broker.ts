// [LAW:single-enforcer] ThemeBroker is the sole owner of theme registration,
// dark-mode coordination, and the display-policy fields (animationLevel,
// tooltipDelay, showTooltips, appAutoFocus) that callers tune through the
// public API. Framework methods are thin delegators that read through it.
// [LAW:one-source-of-truth] themeManager + theme-name + animationLevel +
// tooltipDelay + showTooltips + appAutoFocus live in exactly one place: this
// service.
// [LAW:one-way-deps] The service depends only on a narrow injected deps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import { autoObservable } from "./auto-observable.js";

import {
  ThemeManager,
  type ActiveTheme,
  type AnsiTheme,
  type ThemeDefinition,
} from "../services/theme.js";
import type { AnimationLevel } from "./app-framework.js";

// [LAW:one-way-deps] Narrow capability interface the broker requires from its
// host (typically TextualFramework). The broker never imports the host class
// — only this shape.
export interface ThemeBrokerDeps {
  // Style recalculation when theme/dark-mode changes alter resolved CSS.
  recalculateStyles(): void;
  // theme_changed_signal publish hook (owned by SignalRegistry).
  publishThemeChanged(theme: ActiveTheme): void;
  // App-running probe + active screen focus reschedule for setAppAutoFocus.
  isRunning(): boolean;
  isAppBlurred(): boolean;
  getFocusedNodeId(): string | null;
  scheduleActiveScreenFocusResolution(forceRefresh: boolean): void;
  // Tooltip side-effects when showTooltips toggles.
  hideTooltip(): void;
  refreshTooltipFromHover(): void;
}

export class ThemeBroker {
  readonly themeManager = new ThemeManager();
  theme = "default";
  animationLevel: AnimationLevel = "full";
  showTooltips = true;
  tooltipDelay = 500;
  appAutoFocus: string | null = null;
  private readonly deps: ThemeBrokerDeps;

  constructor(deps: ThemeBrokerDeps) {
    this.deps = deps;

    autoObservable(
      this,
      {
        deps: false,
        themeManager: false,
      },
      { autoBind: true },
    );
  }

  // ---- Theme registration / activation ----

  registerTheme(theme: ThemeDefinition): ActiveTheme {
    return this.themeManager.register(theme);
  }

  setTheme(name: string): ActiveTheme {
    const nextTheme = this.themeManager.setActiveTheme(name);
    this.theme = name;
    this.deps.recalculateStyles();
    this.deps.publishThemeChanged(nextTheme);
    return nextTheme;
  }

  setDarkMode(value: boolean): ActiveTheme {
    const nextTheme = this.themeManager.setDarkMode(value);
    this.theme = nextTheme.name;
    this.deps.recalculateStyles();
    this.deps.publishThemeChanged(nextTheme);
    return nextTheme;
  }

  get activeTheme(): ActiveTheme {
    return this.themeManager.activeTheme;
  }

  get dark(): boolean {
    return this.themeManager.dark;
  }

  get ansiTheme(): AnsiTheme {
    return this.themeManager.ansiTheme;
  }

  get ansiThemeDark(): AnsiTheme {
    return this.themeManager.ansiThemeDark;
  }

  setAnsiThemeDark(theme: AnsiTheme): void {
    this.themeManager.setAnsiTheme(true, theme);
  }

  get ansiThemeLight(): AnsiTheme {
    return this.themeManager.ansiThemeLight;
  }

  setAnsiThemeLight(theme: AnsiTheme): void {
    this.themeManager.setAnsiTheme(false, theme);
  }

  // ---- Display-policy setters ----

  setAppAutoFocus(selector: string | null | undefined): void {
    this.appAutoFocus = selector ?? null;

    if (this.deps.isRunning() && !this.deps.isAppBlurred() && this.deps.getFocusedNodeId() === null) {
      this.deps.scheduleActiveScreenFocusResolution(true);
    }
  }

  setAnimationLevel(level: AnimationLevel): void {
    // [LAW:single-enforcer] Animation policy is owned here so scroll-capable
    // widgets derive behavior from one runtime setting.
    this.animationLevel = level;
  }

  setTooltipDelay(delayMs: number | null | undefined): void {
    this.tooltipDelay = delayMs ?? 500;
  }

  setShowTooltips(enabled: boolean | null | undefined): void {
    this.showTooltips = enabled ?? true;

    if (!this.showTooltips) {
      this.deps.hideTooltip();
      return;
    }

    this.deps.refreshTooltipFromHover();
  }

  getCssVariables(): Record<string, string> {
    return this.themeManager.getCssVariables();
  }
}
