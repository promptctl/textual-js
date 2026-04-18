// [LAW:single-enforcer] The command palette owns command discovery and
// execution. No other subsystem searches or dispatches palette commands.

import uFuzzy from "@leeoniya/ufuzzy";

import { visualize, type Visual } from "../content/index.js";
import type { Provider, CommandHit, DiscoveryHit, ProviderContext } from "./provider.js";

export interface CommandPaletteOptions {
  runOnSelect?: boolean;
  noMatchesTimeout?: number;
}

export interface PaletteResult {
  display: Visual;
  text: string;
  helpText?: string;
  command: () => void;
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

export class CommandPalette {
  static readonly SCREEN_NAME = "__command_palette__";
  readonly providers: readonly Provider[];
  readonly runOnSelect: boolean;
  readonly noMatchesTimeout: number;
  private readonly fuzzy = new uFuzzy();
  private started = false;

  constructor(
    providers: readonly Provider[],
    context: ProviderContext,
    options: CommandPaletteOptions = {},
  ) {
    this.providers = providers;
    this.runOnSelect = options.runOnSelect ?? true;
    this.noMatchesTimeout = options.noMatchesTimeout ?? 250;

    // [LAW:one-source-of-truth] Provider context is set once at construction;
    // providers read it throughout their lifecycle.
    for (const provider of providers) {
      provider.context = context;
    }
  }

  async startup(): Promise<void> {
    // [LAW:dataflow-not-control-flow] Every provider's startup runs; empty
    // implementations are no-ops by design.
    for (const provider of this.providers) {
      await provider.startup();
    }

    this.started = true;
  }

  async shutdown(): Promise<void> {
    for (const provider of this.providers) {
      await provider.shutdown();
    }

    this.started = false;
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

  get isStarted(): boolean {
    return this.started;
  }

  static isOpen(app: unknown): boolean {
    const activeScreen = (app as { activeScreen?: { name: string | null } | null }).activeScreen;

    // [LAW:one-source-of-truth] Palette visibility is derived from the active
    // screen entry name so future launchers and observers read one shared marker.
    return activeScreen?.name === CommandPalette.SCREEN_NAME;
  }
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

function normalizeDiscoveryHit(hit: DiscoveryHit): NormalizedDiscoveryHit {
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
