// [LAW:one-type-per-behavior] All command providers share one base class.
// The palette calls the same search/discover interface on every provider.

import type { App } from "../app/app.js";
import type { VisualInput } from "../content/index.js";
import type { Screen, SimpleCommand, SystemCommand } from "../framework/_app-runtime.js";
import type { Widget } from "../framework/widget.js";

export interface CommandHitInit {
  score: number;
  matchDisplay: VisualInput;
  text?: string;
  command: () => void;
  helpText?: string;
}

export class Hit {
  readonly score: number;
  readonly matchDisplay: VisualInput;
  readonly text: string | undefined;
  readonly command: () => void;
  readonly helpText: string | undefined;

  constructor(score: number, matchDisplay: VisualInput, command: () => void, text?: string, helpText?: string);
  constructor(init: CommandHitInit);
  constructor(
    scoreOrInit: number | CommandHitInit,
    matchDisplay?: VisualInput,
    command?: () => void,
    text?: string,
    helpText?: string,
  ) {
    const init =
      typeof scoreOrInit === "number"
        ? {
            score: scoreOrInit,
            matchDisplay: matchDisplay as VisualInput,
            command: command as () => void,
            text,
            helpText,
          }
        : scoreOrInit;

    this.score = init.score;
    this.matchDisplay = init.matchDisplay;
    this.command = init.command;
    this.text = init.text;
    this.helpText = init.helpText;
  }
}

export type CommandHit = Hit | CommandHitInit;

export interface DiscoveryHitInit {
  display: VisualInput;
  text?: string;
  command: () => void;
  helpText?: string;
}

export class DiscoveryHit {
  readonly display: VisualInput;
  readonly text: string | undefined;
  readonly command: () => void;
  readonly helpText: string | undefined;

  constructor(display: VisualInput, command: () => void, text?: string, helpText?: string);
  constructor(init: DiscoveryHitInit);
  constructor(
    displayOrInit: VisualInput | DiscoveryHitInit,
    command?: () => void,
    text?: string,
    helpText?: string,
  ) {
    const init =
      typeof displayOrInit === "object" && displayOrInit !== null && "display" in displayOrInit && "command" in displayOrInit
        ? displayOrInit
        : {
            display: displayOrInit as VisualInput,
            command: command as () => void,
            text,
            helpText,
          };

    this.display = init.display;
    this.command = init.command;
    this.text = init.text;
    this.helpText = init.helpText;
  }
}

export type DiscoveryHitLike = DiscoveryHit | DiscoveryHitInit;

// [LAW:one-type-per-behavior] Every field names exactly one type. Providers
// always receive the public `App` — the only runtime authority.
export interface ProviderContext {
  app: App;
  screen: Screen | null;
  focused: Widget | null;
}

export abstract class Provider {
  context: ProviderContext | null = null;

  get app(): ProviderContext["app"] {
    return this.requireContext().app;
  }

  get screen(): Screen | null {
    return this.requireContext().screen;
  }

  get focused(): Widget | null {
    return this.requireContext().focused;
  }

  startup(): Promise<void> | void {
    return undefined;
  }

  shutdown(): Promise<void> | void {
    return undefined;
  }

  abstract search(query: string): AsyncIterable<CommandHit> | CommandHit[];

  discover(): AsyncIterable<DiscoveryHitLike> | DiscoveryHitLike[] {
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

  discover(): DiscoveryHitLike[] {
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

  discover(): DiscoveryHitLike[] {
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
    // [LAW:single-enforcer] System command discovery resolves through the
    // framework's systemCommandResolver, which App wires to its own
    // getSystemCommands override. One authoritative list reaches the palette.
    return Array.from(this.app.getSystemCommandsForScreen(this.screen));
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
