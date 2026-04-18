// [LAW:one-type-per-behavior] All command providers share one base class.
// The palette calls the same search/discover interface on every provider.

import type { VisualInput } from "../content/index.js";
import type { TextualFramework } from "../framework/app-framework.js";

export interface CommandHit {
  score: number;
  matchDisplay: VisualInput;
  text?: string;
  command: () => void;
  helpText?: string;
}

export interface DiscoveryHit {
  display: VisualInput;
  text?: string;
  command: () => void;
  helpText?: string;
}

export interface ProviderContext {
  app: TextualFramework;
}

export abstract class Provider {
  context: ProviderContext | null = null;

  startup(): Promise<void> | void {
    return undefined;
  }

  shutdown(): Promise<void> | void {
    return undefined;
  }

  abstract search(query: string): AsyncIterable<CommandHit> | CommandHit[];

  discover(): AsyncIterable<DiscoveryHit> | DiscoveryHit[] {
    return [];
  }
}
