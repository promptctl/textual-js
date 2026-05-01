// [LAW:single-enforcer] StyleEngine is the sole owner of stylesheet ingestion
// (user/cssPath sources), screen-stylesheet caching, CSS file watching, and
// the pending-recalc deferral flag. The framework orchestrator triggers the
// actual widget-tree recalculation through a narrow dep callback — the engine
// never reaches back into TextualFramework directly.
// [LAW:one-source-of-truth] userStylesheets/cssPath/cssWatchers/
// screenStyleCache/pendingStyleRecalc live in exactly one place: this engine.
// Framework methods are thin delegators that read through it.
// [LAW:one-way-deps] The engine depends only on a narrow injected deps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import React from "react";
import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { autoObservable } from "./auto-observable.js";

import { parseTcss, type ParsedStylesheet } from "../styles/index.js";
import {
  StylesheetError,
  type Screen,
  type ScreenOptions,
} from "./app-framework.js";

export interface ScreenStylesheetState {
  css: string | null;
  cssPath: string[];
  scopedCss: boolean;
  scopeTypeName?: string;
  stylesheets: ParsedStylesheet[];
}

// [LAW:one-way-deps] Narrow capability interface the engine requires from its
// host (typically TextualFramework). The engine never imports the host class.
export interface StyleEngineDeps {
  isInBatch(): boolean;
  isDebug(): boolean;
  iterScreens(): Iterable<Screen[]>;
  recalculateStyles(): void;
}

export function normalizeCssSource(source: string | undefined): string | undefined {
  const normalizedSource = source?.trim();
  return normalizedSource === undefined || normalizedSource.length === 0 ? undefined : normalizedSource;
}

export function normalizeCssPathSource(path: string | readonly string[] | undefined): string[] {
  if (path === undefined) {
    return [];
  }

  return typeof path === "string" ? [path] : [...path];
}

export function parseStylesheetOrThrow(
  source: string,
  options: { origin: "default" | "user"; scopeTypeName?: string; scopeMode?: "self" | "descendant" },
): ParsedStylesheet {
  try {
    return parseTcss(source, options);
  } catch (error) {
    throw new StylesheetError((error as Error).message, { cause: error as Error });
  }
}

export class StyleEngine {
  // [LAW:one-source-of-truth] These fields are the single backing store for
  // stylesheet ingestion, screen-stylesheet caching, watcher tracking, and
  // recalc deferral state.
  private userStylesheets: ParsedStylesheet[] = [];
  private cssPathList: string[] = [];
  private readonly cssWatchers = new Map<string, FSWatcher>();
  private readonly screenStyleCache = new Map<unknown, ScreenStylesheetState>();
  pendingStyleRecalc = false;
  private readonly deps: StyleEngineDeps;

  constructor(deps: StyleEngineDeps, initialCssPath: readonly string[] = []) {
    this.deps = deps;
    this.cssPathList = [...initialCssPath];

    autoObservable(
      this,
      {
        cssWatchers: false,
        screenStyleCache: false,
        deps: false,
      },
      { autoBind: true },
    );
  }

  // ---- Public API ----

  setUserStylesheet(source: string): void {
    this.userStylesheets =
      source.trim().length === 0 ? [] : [parseStylesheetOrThrow(source, { origin: "user" })];
    this.deps.recalculateStyles();
  }

  setCssPath(path: string | readonly string[]): void {
    this.cssPathList = typeof path === "string" ? [path] : [...path];
    this.refreshCssWatchers();
    this.onCssChange();
  }

  getActiveStylesheetsFor(
    defaultStylesheets: ParsedStylesheet[],
    activeScreenStylesheets: ParsedStylesheet[],
  ): ParsedStylesheet[] {
    const cachedScreenStylesheets = [...this.screenStyleCache.values()].flatMap((state) => state.stylesheets);
    return [
      ...defaultStylesheets,
      ...this.userStylesheets,
      ...cachedScreenStylesheets,
      ...activeScreenStylesheets,
    ];
  }

  // [LAW:single-enforcer] Style-recalc deferral is owned here so batch-exit
  // and direct refreshes share one boundary. The engine flips the flag while
  // the framework's batch coordinator pulls the trigger.
  refreshStyles(changed: boolean): void {
    // Caller is responsible for the registry "touch" side-effect; this engine
    // owns only stylesheet-related decisions.
    if (!changed) {
      return;
    }

    if (this.deps.isInBatch()) {
      this.pendingStyleRecalc = true;
    } else {
      this.deps.recalculateStyles();
    }
  }

  flushPendingRecalc(): void {
    if (!this.pendingStyleRecalc) {
      return;
    }

    this.pendingStyleRecalc = false;
    this.deps.recalculateStyles();
  }

  resetPendingRecalc(): void {
    this.pendingStyleRecalc = false;
  }

  readScreenStylesheetState(
    element: React.ReactElement,
    options: ScreenOptions,
  ): ScreenStylesheetState {
    const screenType = element.type as {
      CSS?: string;
      CSS_PATH?: string | readonly string[];
      SCOPED_CSS?: boolean;
      name?: string;
    };
    const css = normalizeCssSource(options.css ?? screenType.CSS) ?? null;
    const cssPath = normalizeCssPathSource(options.cssPath ?? screenType.CSS_PATH);
    const scopedCss = options.scopedCss ?? screenType.SCOPED_CSS ?? true;
    const scopeTypeName =
      scopedCss && typeof screenType.name === "string" && screenType.name.length > 0 ? screenType.name : undefined;
    const cacheKey = element.type;
    const cached = this.screenStyleCache.get(cacheKey);

    if (
      cached !== undefined &&
      cached.css === css &&
      cached.scopedCss === scopedCss &&
      JSON.stringify(cached.cssPath) === JSON.stringify(cssPath) &&
      cached.scopeTypeName === scopeTypeName
    ) {
      return cached;
    }

    const parsed = this.parseScreenStylesheetState({
      css,
      cssPath,
      scopedCss,
      scopeTypeName,
    });
    this.screenStyleCache.set(cacheKey, parsed);
    return parsed;
  }

  refreshCssWatchers(): void {
    const watchedPaths = new Set(this.deps.isDebug() ? this.getWatchedCssPaths() : []);

    for (const [path, watcher] of this.cssWatchers.entries()) {
      if (!watchedPaths.has(path)) {
        watcher.close();
        this.cssWatchers.delete(path);
      }
    }

    for (const path of watchedPaths) {
      if (this.cssWatchers.has(path)) {
        continue;
      }

      try {
        const watcher = watch(path, () => {
          this.onCssChange();
        });
        this.cssWatchers.set(path, watcher);
      } catch {
        continue;
      }
    }
  }

  onCssChange(): void {
    let stylesheets: ParsedStylesheet[];

    try {
      stylesheets = this.cssPathList.filter((path) => existsSync(path)).map((path) => {
        return parseStylesheetOrThrow(readFileSync(path, "utf8"), { origin: "user" });
      });
    } catch {
      return;
    }

    // [LAW:one-source-of-truth] CSS_PATH files are parsed into the same
    // userStylesheets list consumed by cascade resolution and hot reload.
    this.userStylesheets = stylesheets;
    this.refreshScreenStylesheets();
    this.refreshCssWatchers();
    this.deps.recalculateStyles();
  }

  // [LAW:single-enforcer] Watcher disposal flows through the engine so
  // framework shutdown does not duplicate the close-and-clear sequence.
  closeAllWatchers(): void {
    for (const watcher of this.cssWatchers.values()) {
      watcher.close();
    }
    this.cssWatchers.clear();
  }

  // ---- Private helpers ----

  private parseScreenStylesheetState(state: Omit<ScreenStylesheetState, "stylesheets">): ScreenStylesheetState {
    const stylesheets = [
      ...(state.css === null
        ? []
        : [
            parseStylesheetOrThrow(state.css, {
              origin: "user",
              scopeTypeName: state.scopedCss ? state.scopeTypeName : undefined,
              scopeMode: "descendant",
            }),
          ]),
      ...state.cssPath
        .filter((path) => existsSync(path))
        .map((path) =>
          parseStylesheetOrThrow(readFileSync(path, "utf8"), {
            origin: "user",
            scopeTypeName: state.scopedCss ? state.scopeTypeName : undefined,
            scopeMode: "descendant",
          }),
        ),
    ];

    return {
      ...state,
      stylesheets,
    };
  }

  private refreshScreenStylesheets(): void {
    for (const [cacheKey, cached] of this.screenStyleCache.entries()) {
      try {
        this.screenStyleCache.set(cacheKey, this.parseScreenStylesheetState(cached));
      } catch {
        continue;
      }
    }

    for (const stack of this.deps.iterScreens()) {
      for (const entry of stack) {
        if (entry.implicit || entry.element === null) {
          continue;
        }

        const cached = this.screenStyleCache.get(entry.element.type);

        if (cached !== undefined) {
          entry.css = cached.css;
          entry.cssPath = cached.cssPath;
          entry.scopedCss = cached.scopedCss;
          entry.stylesheets = cached.stylesheets;
        }
      }
    }
  }

  private getWatchedCssPaths(): string[] {
    const screenPaths = [...this.deps.iterScreens()].flatMap((stack) =>
      stack.flatMap((entry) => entry.cssPath),
    );
    return [...new Set([...this.cssPathList, ...screenPaths])];
  }
}
