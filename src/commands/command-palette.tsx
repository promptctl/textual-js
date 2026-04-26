// [LAW:single-enforcer] The command palette owns command discovery and
// execution. No other subsystem searches or dispatches palette commands.

import React from "react";
import uFuzzy from "@leeoniya/ufuzzy";
import { Box, Text } from "ink";
import { makeAutoObservable, runInAction } from "mobx";
import { observer } from "mobx-react-lite";

import { renderVisual, visualize, type Visual } from "../content/index.js";
import { Click, Key } from "../events/events.js";
import { Message, type MessageInit } from "../events/message.js";
import { useTextual, WidgetScope, useWidget } from "../framework/context.js";
import { Worker, WorkerCancelled, type WorkerCallable, type WorkerOptions } from "../services/worker.js";
import type { Provider, CommandHit, DiscoveryHitLike, ProviderContext } from "./provider.js";

export interface CommandPaletteOptions {
  runOnSelect?: boolean;
  run_on_select?: boolean;
  noMatchesTimeout?: number;
}

export interface PaletteResult {
  display: Visual;
  text: string;
  helpText?: string;
  command?: () => void;
  disabled?: boolean;
}

interface NormalizedCommandHit {
  score: number;
  display: Visual;
  text: string;
  command: () => void;
  helpText?: string;
}

interface NormalizedDiscoveryHit {
  display: Visual;
  text: string;
  command: () => void;
  helpText?: string;
}

export class CommandPaletteOpened extends Message {
  constructor(init?: MessageInit) {
    super({ bubble: false, ...init });
  }
}

export class CommandPaletteClosed extends Message {
  constructor(
    readonly optionSelected: boolean,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class CommandPaletteOptionHighlighted extends Message {
  constructor(
    readonly option: PaletteResult,
    readonly index: number,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class CommandPalette {
  static readonly SCREEN_NAME = "__command_palette__";
  static readonly Opened = CommandPaletteOpened;
  static readonly Closed = CommandPaletteClosed;
  static readonly OptionHighlighted = CommandPaletteOptionHighlighted;
  static run_on_select = true;

  static get runOnSelect(): boolean {
    return CommandPalette.run_on_select;
  }

  static set runOnSelect(value: boolean) {
    CommandPalette.run_on_select = value;
  }
  readonly providers: readonly Provider[];
  readonly runOnSelect: boolean;
  readonly noMatchesTimeout: number;
  private readonly context: ProviderContext;
  private readonly fuzzy = new uFuzzy();
  private started = false;
  private searchGeneration = 0;
  private noMatchesTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmation: PaletteResult | null = null;
  private readonly ownedWorkers = new Set<Worker<unknown>>();
  query = "";
  results: PaletteResult[] = [];
  highlightedIndex: number | null = null;
  listVisible = false;

  constructor(
    providers: readonly Provider[],
    context: ProviderContext,
    options: CommandPaletteOptions = {},
  ) {
    this.providers = providers;
    this.context = context;
    this.runOnSelect = options.runOnSelect ?? options.run_on_select ?? CommandPalette.run_on_select;
    this.noMatchesTimeout = options.noMatchesTimeout ?? 250;

    // [LAW:one-source-of-truth] Provider context is set once at construction;
    // providers read it throughout their lifecycle.
    for (const provider of providers) {
      provider.context = context;
    }

    makeAutoObservable(
      this,
      {
        providers: false,
        fuzzy: false,
        ownedWorkers: false,
        searchGeneration: false,
        noMatchesTimer: false,
        confirmation: false,
        context: false,
      } as never,
      { autoBind: true },
    );
  }

  async startup(): Promise<void> {
    // [LAW:dataflow-not-control-flow] Every provider's startup runs; empty
    // implementations are no-ops by design.
    for (const provider of this.providers) {
      await provider.startup();
    }

    runInAction(() => {
      this.started = true;
    });
  }

  async shutdown(): Promise<void> {
    this.clearNoMatchesTimer();
    for (const worker of this.ownedWorkers) {
      worker.cancel();
    }

    await this.requireFramework().workers.waitForComplete(this.ownedWorkers);

    for (const provider of this.providers) {
      await provider.shutdown();
    }

    runInAction(() => {
      this.started = false;
    });
  }

  runWorker<TResult>(work: WorkerCallable<TResult>, options: WorkerOptions = {}): Worker<TResult> {
    const worker = this.requireFramework().runAppWorker(work, {
      ...options,
      start: options.start ?? true,
      group: options.group ?? "command-palette",
    });
    this.ownedWorkers.add(worker as Worker<unknown>);

    void worker.wait().catch((error) => {
      if (!(error instanceof WorkerCancelled)) {
        return undefined;
      }

      return undefined;
    }).finally(() => {
      this.ownedWorkers.delete(worker as Worker<unknown>);
    });

    return worker;
  }

  async discover(): Promise<PaletteResult[]> {
    const results: PaletteResult[] = [];

    for (const provider of this.providers) {
      const hits = provider.discover();

      for await (const hit of hits) {
        results.push(discoveryHitToResult(normalizeDiscoveryHit(hit)));
      }
    }

    return results;
  }

  async search(query: string): Promise<PaletteResult[]> {
    if (query.length === 0) {
      return this.discover();
    }

    const allHits: NormalizedCommandHit[] = [];

    for (const provider of this.providers) {
      const hits = provider.search(query);

      for await (const hit of hits) {
        allHits.push(normalizeCommandHit(hit));
      }
    }

    // [LAW:dataflow-not-control-flow] Fuzzy re-ranking always runs; empty
    // hit lists produce empty results without a conditional skip.
    const names = allHits.map((hit) => hit.text);
    const [idxs, info, order] = this.fuzzy.search(names, query);

    if (idxs === null || order === null) {
      return allHits
        .sort((left, right) => right.score - left.score)
        .map(commandHitToResult);
    }

    const ranked: NormalizedCommandHit[] = [];

    for (const orderIndex of order) {
      const originalIndex = idxs[orderIndex];
      ranked.push(allHits[originalIndex]);
    }

    return ranked.map(commandHitToResult);
  }

  async open(): Promise<void> {
    const discoveryResults = await this.discover();

    runInAction(() => {
      this.query = "";
      this.confirmation = null;
      this.results = discoveryResults;
      this.listVisible = discoveryResults.length > 0;
      this.highlightedIndex = firstEnabledIndex(discoveryResults);
    });
  }

  async updateQuery(query: string): Promise<void> {
    const generation = this.searchGeneration + 1;
    this.searchGeneration = generation;
    this.query = query;
    this.confirmation = null;
    this.clearNoMatchesTimer();
    const nextResults = await this.search(query);

    if (generation !== this.searchGeneration) {
      return;
    }

    runInAction(() => {
      this.results = nextResults;
      this.listVisible = query.length > 0 || nextResults.length > 0;
      this.highlightedIndex = firstEnabledIndex(nextResults);
    });

    if (query.length > 0 && nextResults.length === 0) {
      this.noMatchesTimer = setTimeout(() => {
        if (generation === this.searchGeneration && this.results.length === 0) {
          runInAction(() => {
            this.results = [createNoMatchesResult()];
            this.highlightedIndex = null;
            this.listVisible = true;
          });
        }
      }, this.noMatchesTimeout);
    }
  }

  moveHighlight(delta: number): PaletteResult | null {
    const enabledIndexes = this.results
      .map((result, index) => (result.disabled === true ? null : index))
      .filter((index): index is number => index !== null);

    if (enabledIndexes.length === 0) {
      this.highlightedIndex = null;
      return null;
    }

    const current = this.highlightedIndex ?? enabledIndexes[0];
    const currentPosition = Math.max(0, enabledIndexes.indexOf(current));
    const nextPosition = (currentPosition + delta + enabledIndexes.length) % enabledIndexes.length;
    const nextIndex = enabledIndexes[nextPosition];
    this.highlightedIndex = nextIndex;
    return this.results[nextIndex] ?? null;
  }

  selectHighlighted(): { command: (() => void) | null; selected: boolean } {
    const result = this.highlightedIndex === null ? undefined : this.results[this.highlightedIndex];

    if (result === undefined || result.disabled === true || result.command === undefined) {
      return { command: null, selected: false };
    }

    if (!this.runOnSelect && this.confirmation !== result) {
      this.confirmation = result;
      this.query = result.text;
      this.results = [result];
      this.highlightedIndex = 0;
      this.listVisible = true;
      return { command: null, selected: false };
    }

    return { command: result.command, selected: true };
  }

  get isStarted(): boolean {
    return this.started;
  }

  static isOpen(app: unknown): boolean {
    const isObject = typeof app === "object" && app !== null;
    const framework = isObject && "framework" in app
      ? (app as { framework: { activeScreen?: { name: string | null } | null } }).framework
      : (app as { activeScreen?: { name: string | null } | null });
    const activeScreen = framework.activeScreen;

    // [LAW:one-source-of-truth] Palette visibility is derived from the active
    // screen entry name so future launchers and observers read one shared marker.
    return activeScreen?.name === CommandPalette.SCREEN_NAME;
  }

  static is_open(app: unknown): boolean {
    // [LAW:one-source-of-truth] isOpen is the canonical JS state check; the
    // snake_case Stage 6 alias delegates so visibility cannot diverge.
    return CommandPalette.isOpen(app);
  }

  private clearNoMatchesTimer(): void {
    if (this.noMatchesTimer !== null) {
      clearTimeout(this.noMatchesTimer);
      this.noMatchesTimer = null;
    }
  }

  private requireFramework() {
    const context = this.context;

    if (context === null) {
      throw new Error("Command palette worker support requires a provider context");
    }

    return context.app.framework;
  }
}

export interface CommandPaletteScreenProps {
  palette: CommandPalette;
}

export const CommandPaletteScreen = observer(function CommandPaletteScreen({
  palette,
}: CommandPaletteScreenProps): React.JSX.Element {
  const framework = useTextual();
  const widget = useWidget({
    typeName: "CommandPalette",
    focusable: true,
    autoFocus: true,
    handlers: {
      onKey: (message) => {
        handlePaletteKey(framework, palette, message as Key);
      },
      onClick: (message) => {
        message.stop();
        const insidePalette = isLocalClickInsideWidget(message as Click, widget.handle);

        if (!insidePalette) {
          void framework.closeActiveCommandPalette(false);
        }
      },
    },
  });

  const visibleResults = palette.listVisible ? palette.results : [];

  return (
    <WidgetScope widget={widget.handle}>
      <Box flexDirection="column" borderStyle="round" paddingX={1} width={Math.min(70, framework.terminalSize.width)}>
        <Text>{`> ${palette.query}`}</Text>
        {visibleResults.map((result, index) => (
          <Box key={`${result.text}:${index}`}>
            <Text>{palette.highlightedIndex === index ? ">" : " "}</Text>
            {renderVisual(result.display, result.disabled === true ? { color: "#777777" } : {}, `command-palette:${index}`)}
            {result.helpText === undefined ? null : <Text>{` ${result.helpText}`}</Text>}
          </Box>
        ))}
      </Box>
    </WidgetScope>
  );
});

function handlePaletteKey(
  framework: ProviderContext["app"]["framework"],
  palette: CommandPalette,
  message: Key,
): void {
  message.stop();

  if (message.key === "escape") {
    void framework.closeActiveCommandPalette(false);
    return;
  }

  if (message.key === "down") {
    const highlighted = palette.moveHighlight(1);

    if (highlighted !== null && palette.highlightedIndex !== null) {
      framework.postAppMessage(new CommandPalette.OptionHighlighted(highlighted, palette.highlightedIndex));
    }

    return;
  }

  if (message.key === "enter") {
    const selection = palette.selectHighlighted();

    if (selection.selected) {
      void framework.closeActiveCommandPalette(true, selection.command ?? undefined);
    }

    return;
  }

  if (message.key === "backspace") {
    void palette.updateQuery(palette.query.slice(0, -1));
    return;
  }

  if (message.input.length > 0) {
    void palette.updateQuery(`${palette.query}${message.input}`);
  }
}

function isLocalClickInsideWidget(message: Click, widget: ProviderContext["focused"]): boolean {
  if (widget === null) {
    return false;
  }

  const region = widget.effectiveScreenRegion;
  return message.x >= 0 && message.y >= 0 && message.x < region.width && message.y < region.height;
}

function resolvePaletteText(display: Visual, text: string | undefined): string {
  if (text !== undefined) {
    return text;
  }

  if (display.plainText !== null) {
    return display.plainText;
  }

  throw new TypeError("Command palette providers must supply plain-text search text for non-text displays");
}

function normalizeCommandHit(hit: CommandHit): NormalizedCommandHit {
  const display = visualize(hit.matchDisplay);

  return {
    score: hit.score,
    display,
    text: resolvePaletteText(display, hit.text),
    command: hit.command,
    helpText: hit.helpText,
  };
}

function normalizeDiscoveryHit(hit: DiscoveryHitLike): NormalizedDiscoveryHit {
  const display = visualize(hit.display);

  return {
    display,
    text: resolvePaletteText(display, hit.text),
    command: hit.command,
    helpText: hit.helpText,
  };
}

function commandHitToResult(hit: NormalizedCommandHit): PaletteResult {
  return {
    display: hit.display,
    text: hit.text,
    helpText: hit.helpText,
    command: hit.command,
  };
}

function discoveryHitToResult(hit: NormalizedDiscoveryHit): PaletteResult {
  return {
    display: hit.display,
    text: hit.text,
    helpText: hit.helpText,
    command: hit.command,
  };
}

function firstEnabledIndex(results: readonly PaletteResult[]): number | null {
  const index = results.findIndex((result) => result.disabled !== true);
  return index >= 0 ? index : null;
}

function createNoMatchesResult(): PaletteResult {
  return {
    display: visualize("No matches found"),
    text: "No matches found",
    disabled: true,
  };
}
