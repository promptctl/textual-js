// [LAW:one-type-per-behavior] All command providers share one base class.
// The palette calls the same search/discover interface on every provider.

import type { VisualInput } from "../content/index.js";
import type { ScreenEntry, SimpleCommand, SystemCommand, TextualFramework } from "../framework/app-framework.js";
import type { WidgetNode } from "../framework/widget-node.js";

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
  screen: ScreenEntry | null;
  focused: WidgetNode | null;
}

export abstract class Provider {
  context: ProviderContext | null = null;

  get app(): TextualFramework {
    return this.requireContext().app;
  }

  get screen(): ScreenEntry | null {
    return this.requireContext().screen;
  }

  get focused(): WidgetNode | null {
    return this.requireContext().focused;
  }

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

  private requireContext(): ProviderContext {
    if (this.context === null) {
      throw new Error("Command provider context is not available before palette construction");
    }

    return this.context;
  }
}

export type ProviderConstructor = new () => Provider;

export class SimpleCommandProvider extends Provider {
  private readonly commands: readonly SimpleCommand[];

  constructor(commands: readonly SimpleCommand[]) {
    super();
    this.commands = commands;
  }

  search(query: string): CommandHit[] {
    const normalizedQuery = query.toLowerCase();

    return this.commands
      .map(normalizeSimpleCommand)
      .filter((command) => command.name.toLowerCase().includes(normalizedQuery))
      .map((command) => ({
        score: command.name.toLowerCase().startsWith(normalizedQuery) ? 100 : 50,
        matchDisplay: command.name,
        text: command.name,
        command: command.callback,
        helpText: command.helpText,
      }));
  }

  discover(): DiscoveryHit[] {
    return this.commands.map((command) => {
      const normalizedCommand = normalizeSimpleCommand(command);

      return {
        display: normalizedCommand.name,
        text: normalizedCommand.name,
        command: normalizedCommand.callback,
        helpText: normalizedCommand.helpText,
      };
    });
  }
}

export class SystemCommandsProvider extends Provider {
  search(query: string): CommandHit[] {
    const normalizedQuery = query.toLowerCase();

    return this.readCommands()
      .filter((command) => resolveSystemCommandText(command).toLowerCase().includes(normalizedQuery))
      .map((command) => {
        const text = resolveSystemCommandText(command);

        return {
          score: text.toLowerCase().startsWith(normalizedQuery) ? 100 : 50,
          matchDisplay: command.name,
          text,
          command: command.callback,
          helpText: command.helpText,
        };
      });
  }

  discover(): DiscoveryHit[] {
    return this.readCommands()
      .filter((command) => command.discover)
      .map((command) => ({
        display: command.name,
        text: resolveSystemCommandText(command),
        command: command.callback,
        helpText: command.helpText,
      }));
  }

  private readCommands(): SystemCommand[] {
    // [LAW:single-enforcer] System command discovery is delegated to the app
    // resolver; this provider only adapts that canonical list into palette hits.
    return this.app.getSystemCommands(this.screen);
  }
}

function normalizeSimpleCommand(command: SimpleCommand): { name: string; callback: () => void; helpText?: string } {
  if ("name" in command) {
    return {
      name: command.name,
      callback: command.callback,
      helpText: command.helpText,
    };
  }

  return {
    name: command[0],
    callback: command[1],
    helpText: command[2],
  };
}

function resolveSystemCommandText(command: SystemCommand): string {
  return command.text ?? String(command.name);
}
