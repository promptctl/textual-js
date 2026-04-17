// [LAW:single-enforcer] The command palette owns command discovery and
// execution. No other subsystem searches or dispatches palette commands.

import uFuzzy from "@leeoniya/ufuzzy";

import type { Provider, CommandHit, DiscoveryHit, ProviderContext } from "./provider.js";

export interface CommandPaletteOptions {
  runOnSelect?: boolean;
  noMatchesTimeout?: number;
}

export interface PaletteResult {
  display: string;
  helpText?: string;
  command: () => void;
  disabled?: boolean;
}

export class CommandPalette {
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
        results.push(discoveryHitToResult(hit));
      }
    }

    return results;
  }

  async search(query: string): Promise<PaletteResult[]> {
    if (query.length === 0) {
      return this.discover();
    }

    const allHits: CommandHit[] = [];

    for (const provider of this.providers) {
      const hits = provider.search(query);

      for await (const hit of hits) {
        allHits.push(hit);
      }
    }

    // [LAW:dataflow-not-control-flow] Fuzzy re-ranking always runs; empty
    // hit lists produce empty results without a conditional skip.
    const names = allHits.map((hit) => hit.matchDisplay);
    const [idxs, info, order] = this.fuzzy.search(names, query);

    if (idxs === null || order === null) {
      return allHits
        .sort((left, right) => right.score - left.score)
        .map(commandHitToResult);
    }

    const ranked: CommandHit[] = [];

    for (const orderIndex of order) {
      const originalIndex = idxs[orderIndex];
      ranked.push(allHits[originalIndex]);
    }

    return ranked.map(commandHitToResult);
  }

  get isStarted(): boolean {
    return this.started;
  }

  static isOpen(_app: unknown): boolean {
    return false;
  }
}

function commandHitToResult(hit: CommandHit): PaletteResult {
  return {
    display: hit.matchDisplay,
    helpText: hit.helpText,
    command: hit.command,
  };
}

function discoveryHitToResult(hit: DiscoveryHit): PaletteResult {
  return {
    display: hit.display,
    helpText: hit.helpText,
    command: hit.command,
  };
}
