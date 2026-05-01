import React from "react";
import { Panel } from "rich-js";
import { describe, expect, it } from "vitest";

import {
  App,
  CommandPalette,
  CommandPaletteClosed,
  CommandPaletteOpened,
  CommandPaletteOptionHighlighted,
  Content,
  DiscoveryHit,
  Hit,
  Provider,
  Static,
  SystemCommandsProvider,
  WidgetHost,
  WorkerCancelled,
  runTest,
  type CommandHit,
  type DiscoveryHit,
} from "../src/index.js";

class TestProvider extends Provider {
  private readonly commands: Array<{ name: string | Content | Panel; text?: string; helpText?: string }>;
  readonly startupCalls: number[] = [];
  readonly shutdownCalls: number[] = [];

  constructor(commands: Array<{ name: string | Content | Panel; text?: string; helpText?: string }>) {
    super();
    this.commands = commands;
  }

  async startup(): Promise<void> {
    this.startupCalls.push(Date.now());
  }

  async shutdown(): Promise<void> {
    this.shutdownCalls.push(Date.now());
  }

  search(query: string): CommandHit[] {
    const lowerQuery = query.toLowerCase();

    return this.commands
      .filter((command) => (command.text ?? command.name.toString()).toLowerCase().includes(lowerQuery))
      .map((command) => ({
        score: (command.text ?? command.name.toString()).toLowerCase().startsWith(lowerQuery) ? 100 : 50,
        matchDisplay: command.name,
        text: command.text,
        command: () => undefined,
        helpText: command.helpText,
      }));
  }
}

class DiscoveryProvider extends Provider {
  private readonly discoveryItems: Array<{ name: string | Content | Panel; text?: string; helpText?: string }>;
  private readonly searchItems: Array<{ name: string | Content | Panel; text?: string }>;

  constructor(
    discoveryItems: Array<{ name: string | Content | Panel; text?: string; helpText?: string }>,
    searchItems: Array<{ name: string | Content | Panel; text?: string }> = [],
  ) {
    super();
    this.discoveryItems = discoveryItems;
    this.searchItems = searchItems;
  }

  search(query: string): CommandHit[] {
    const lowerQuery = query.toLowerCase();

    return this.searchItems
      .filter((item) => (item.text ?? item.name.toString()).toLowerCase().includes(lowerQuery))
      .map((item) => ({
        score: 50,
        matchDisplay: item.name,
        text: item.text,
        command: () => undefined,
      }));
  }

  discover(): DiscoveryHit[] {
    return this.discoveryItems.map((item) => ({
      display: item.name,
      text: item.text,
      command: () => undefined,
      helpText: item.helpText,
    }));
  }
}

function createPalette(
  providers: Provider[],
  options?: { runOnSelect?: boolean; run_on_select?: boolean },
): CommandPalette {
  const app = new App();
  return new CommandPalette(providers, {
    app,
    screen: null,
    focused: null,
  }, options);
}

describe("command palette provider model", () => {
  it("calls startup and shutdown on all providers", async () => {
    const providerA = new TestProvider([{ name: "Alpha" }]);
    const providerB = new TestProvider([{ name: "Beta" }]);
    const palette = createPalette([providerA, providerB]);

    await palette.startup();

    expect(providerA.startupCalls).toHaveLength(1);
    expect(providerB.startupCalls).toHaveLength(1);
    expect(palette.isStarted).toBe(true);

    await palette.shutdown();

    expect(providerA.shutdownCalls).toHaveLength(1);
    expect(providerB.shutdownCalls).toHaveLength(1);
    expect(palette.isStarted).toBe(false);
  });

  it("sets context on all providers at construction time", () => {
    const provider = new TestProvider([{ name: "Test" }]);
    createPalette([provider]);

    expect(provider.context).not.toBeNull();
    expect(provider.context?.app).toBeInstanceOf(App);
    expect(provider.context?.screen).toBeNull();
    expect(provider.context?.focused).toBeNull();
  });

  it("creates a palette with empty providers when no commands are declared", async () => {
    const palette = createPalette([]);

    await palette.startup();
    const results = await palette.search("anything");

    expect(results).toEqual([]);

    await palette.shutdown();
  });

  it("provides runtime Hit and DiscoveryHit classes", () => {
    const hit = new Hit(100, "Open File", () => undefined, "Open File", "Open a file");
    const discovery = new DiscoveryHit("Recent File", () => undefined, "Recent File", "Open recent");

    expect(hit.score).toBe(100);
    expect(hit.matchDisplay).toBe("Open File");
    expect(discovery.display).toBe("Recent File");
    expect(discovery.helpText).toBe("Open recent");
  });
});

describe("command palette provider composition", () => {
  class AppProvider extends Provider {
    search(): CommandHit[] {
      return [];
    }
  }

  class ScreenProvider extends Provider {
    search(): CommandHit[] {
      return [];
    }
  }

  function ScreenWithCommands(): React.JSX.Element {
    return React.createElement(Static, { content: "screen" });
  }
  ScreenWithCommands.COMMANDS = new Set([ScreenProvider]);

  it("uses SystemCommandsProvider by default", async () => {
    const app = new App();
    const framework = app.framework;

    const palette = await app.openCommandPalette();

    expect(palette.providers.some((provider) => provider instanceof SystemCommandsProvider)).toBe(true);
  });

  it("replaces default system providers with app COMMANDS and adds screen COMMANDS", async () => {
    const app = new App();
    const framework = app.framework;
    framework.setAppCommandProviders(new Set([AppProvider]));
    app.pushScreen(ScreenWithCommands);

    const palette = await app.openCommandPalette();

    expect(palette.providers.some((provider) => provider instanceof SystemCommandsProvider)).toBe(false);
    expect(palette.providers.some((provider) => provider instanceof AppProvider)).toBe(true);
    expect(palette.providers.some((provider) => provider instanceof ScreenProvider)).toBe(true);
  });

  it("passes the base screen and prior focused widget to providers", async () => {
    const contexts: Array<NonNullable<Provider["context"]>> = [];

    class ContextProvider extends Provider {
      startup(): void {
        contexts.push(this.context!);
      }

      search(): CommandHit[] {
        return [];
      }
    }

    function FocusedApp(): React.JSX.Element {
      return React.createElement(
        WidgetHost,
        { typeName: "Focused", focusable: true, autoFocus: true },
        React.createElement(Static, { content: "focused" }),
      );
    }

    const session = await runTest(React.createElement(FocusedApp));
    session.framework.setAppCommandProviders(new Set([ContextProvider]));

    await session.app.openCommandPalette();

    expect(contexts[0]?.app).toBe(session.app);
    expect(contexts[0]?.screen).toBe(session.app.getScreenStack()[0]);
    expect(contexts[0]?.focused?.typeName).toBe("Focused");

    session.unmount();
  });

  it("provides the public App wrapper to providers when opened through App", async () => {
    const contexts: Array<NonNullable<Provider["context"]>> = [];

    class ContextProvider extends Provider {
      startup(): void {
        contexts.push(this.context!);
      }

      search(): CommandHit[] {
        return [];
      }
    }

    class PaletteApp extends App {
      static COMMANDS = new Set([ContextProvider]);
    }

    const app = new PaletteApp();
    const session = await app.runTest();

    await app.openCommandPalette();

    expect(contexts[0]?.app).toBe(app);

    session.unmount();
  });
});

describe("command palette search", () => {
  it("searches across all providers and returns matching results", async () => {
    const providerA = new TestProvider([
      { name: "Save File" },
      { name: "Save As" },
    ]);
    const providerB = new TestProvider([
      { name: "Open File" },
      { name: "Close File" },
    ]);
    const palette = createPalette([providerA, providerB]);

    await palette.startup();

    const results = await palette.search("save");
    expect(results.map((result) => result.display.plainText)).toContain("Save File");
    expect(results.map((result) => result.display.plainText)).toContain("Save As");
    expect(results.every((result) => result.text.toLowerCase().includes("save"))).toBe(true);

    await palette.shutdown();
  });

  it("returns empty results when no commands match the query", async () => {
    const provider = new TestProvider([
      { name: "Save" },
      { name: "Open" },
    ]);
    const palette = createPalette([provider]);

    await palette.startup();

    const results = await palette.search("zzzzz");
    expect(results).toHaveLength(0);

    await palette.shutdown();
  });

  it("includes help text from provider results", async () => {
    const provider = new TestProvider([
      { name: "Save", helpText: "Save the current file" },
    ]);
    const palette = createPalette([provider]);

    await palette.startup();

    const results = await palette.search("save");
    expect(results[0]?.helpText).toBe("Save the current file");
    expect(results[0]?.display.plainText).toBe("Save");

    await palette.shutdown();
  });

  it("supports renderable displays when providers supply plain-text search text", async () => {
    const provider = new TestProvider([
      { name: new Panel("Save File"), text: "Save File" },
    ]);
    const palette = createPalette([provider]);

    await palette.startup();

    const results = await palette.search("save");
    expect(results[0]?.text).toBe("Save File");
    expect(results[0]?.display.plainText).toBeNull();

    await palette.shutdown();
  });

  it("rejects non-text displays without search text", async () => {
    class InvalidDisplayProvider extends Provider {
      search(): CommandHit[] {
        return [
          {
            score: 100,
            matchDisplay: new Panel("Save File"),
            command: () => undefined,
          },
        ];
      }
    }

    const provider = new InvalidDisplayProvider();
    const palette = createPalette([provider]);

    await palette.startup();

    await expect(palette.search("save")).rejects.toThrow(/plain-text search text/i);

    await palette.shutdown();
  });
});

describe("command palette discovery", () => {
  it("returns discovery hits when query is empty", async () => {
    const provider = new DiscoveryProvider([
      { name: "Recent: Open file.txt" },
      { name: "Recent: Edit config" },
    ]);
    const palette = createPalette([provider]);

    await palette.startup();

    const results = await palette.discover();
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.display.plainText)).toContain("Recent: Open file.txt");

    await palette.shutdown();
  });

  it("falls back to discovery on empty search query", async () => {
    const provider = new DiscoveryProvider(
      [{ name: "Discover Me" }],
      [{ name: "Search Only" }],
    );
    const palette = createPalette([provider]);

    await palette.startup();

    const emptyQueryResults = await palette.search("");
    expect(emptyQueryResults.map((result) => result.display.plainText)).toContain("Discover Me");
    expect(emptyQueryResults.map((result) => result.display.plainText)).not.toContain("Search Only");

    await palette.shutdown();
  });

  it("combines discovery hits from multiple providers", async () => {
    const providerA = new DiscoveryProvider([{ name: "Alpha Discovery" }]);
    const providerB = new DiscoveryProvider([{ name: "Beta Discovery" }]);
    const palette = createPalette([providerA, providerB]);

    await palette.startup();

    const results = await palette.discover();
    expect(results).toHaveLength(2);

    await palette.shutdown();
  });
});

describe("command palette options", () => {
  it("defaults runOnSelect to true", () => {
    const palette = createPalette([]);
    expect(palette.runOnSelect).toBe(true);
  });

  it("uses the class-level run_on_select default and exposes the snake_case open check", () => {
    const previous = CommandPalette.run_on_select;
    CommandPalette.run_on_select = false;

    const palette = createPalette([]);
    const app = new App();
    const framework = app.framework;
    app.pushScreen(React.createElement(React.Fragment), { name: CommandPalette.SCREEN_NAME });

    expect(palette.runOnSelect).toBe(false);
    expect(CommandPalette.is_open(framework)).toBe(true);

    CommandPalette.run_on_select = previous;
  });

  it("accepts runOnSelect false for two-step execution", () => {
    const palette = createPalette([], { runOnSelect: false });
    expect(palette.runOnSelect).toBe(false);
  });

  it("configures noMatchesTimeout with a default of 250ms", () => {
    const palette = createPalette([]);
    expect(palette.noMatchesTimeout).toBe(250);
  });

  it("reports open state from the active screen name", () => {
    const app = new App();
    const framework = app.framework;

    expect(CommandPalette.isOpen(framework)).toBe(false);

    app.pushScreen(React.createElement(React.Fragment), { name: CommandPalette.SCREEN_NAME });
    expect(CommandPalette.isOpen(framework)).toBe(true);

    app.popScreen();
    expect(CommandPalette.isOpen(framework)).toBe(false);
  });

  it("ignores non-palette screens when checking open state", () => {
    const app = new App();
    const framework = app.framework;

    app.pushScreen(React.createElement(React.Fragment), { name: "dialog" });
    expect(CommandPalette.isOpen(framework)).toBe(false);
  });
});

describe("command palette screen interaction", () => {
  it("shows discovery results immediately and executes selected commands", async () => {
    const events: string[] = [];
    let selected = false;
    const session = await runTest(React.createElement(Static, { content: "app" }), {
      messageHook: (message) => {
        if (message instanceof CommandPaletteOpened) {
          events.push("opened");
        } else if (message instanceof CommandPaletteClosed) {
          events.push(`closed:${message.optionSelected}`);
        }
      },
    });
    session.framework.setSystemCommandResolver(() => [
      {
        name: "Open Settings",
        callback: () => {
          selected = true;
        },
        discover: true,
      },
    ]);

    await session.pilot.press("ctrl+p");

    expect(CommandPalette.isOpen(session.framework)).toBe(true);
    expect(session.lastFrame()).toContain("Open Settings");

    await session.pilot.press("enter");

    expect(selected).toBe(true);
    expect(CommandPalette.isOpen(session.framework)).toBe(false);
    expect(events).toEqual(["opened", "closed:true"]);

    session.unmount();
  });

  it("searches typed input, moves highlight, and reports highlight events", async () => {
    const highlighted: string[] = [];
    const session = await runTest(React.createElement(Static, { content: "app" }), {
      messageHook: (message) => {
        if (message instanceof CommandPaletteOptionHighlighted) {
          highlighted.push(message.option.text);
        }
      },
    });
    session.framework.setSystemCommandResolver(() => [
      { name: "Open File", callback: () => undefined, discover: false },
      { name: "Open Folder", callback: () => undefined, discover: false },
    ]);

    await session.pilot.press("ctrl+p");
    expect(session.lastFrame()).not.toContain("Open File");

    await session.pilot.type("open");
    expect(session.lastFrame()).toContain("Open File");
    expect(session.lastFrame()).toContain("Open Folder");

    await session.pilot.press("down");
    expect(highlighted).toEqual(["Open Folder"]);

    session.unmount();
  });

  it("dismisses with escape and click-away without selecting an option", async () => {
    const closed: boolean[] = [];
    const session = await runTest(React.createElement(Static, { content: "app" }), {
      messageHook: (message) => {
        if (message instanceof CommandPaletteClosed) {
          closed.push(message.optionSelected);
        }
      },
    });
    session.framework.setSystemCommandResolver(() => [
      { name: "Open File", callback: () => undefined, discover: true },
    ]);

    await session.pilot.press("ctrl+p", "escape");
    expect(CommandPalette.isOpen(session.framework)).toBe(false);

    await session.app.openCommandPalette();
    await session.pilot.click({ offset: { x: 79, y: 23 } });

    expect(CommandPalette.isOpen(session.framework)).toBe(false);
    expect(closed).toEqual([false, false]);

    session.unmount();
  });

  it("cancels palette-owned workers without disturbing unrelated app workers", async () => {
    const app = new App();
    const framework = app.framework;
    const unrelated = app.runWorker(async (signal) => {
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new WorkerCancelled("cancelled"));
        });
      });
    }, { name: "unrelated" });
    const palette = await app.openCommandPalette();
    const paletteWorker = palette.runWorker(async (signal) => {
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new WorkerCancelled("cancelled"));
        });
      });
    }, { name: "palette-owned" });

    await framework.closeActiveCommandPalette(false);
    await app.workers.waitForComplete([paletteWorker]);

    expect(paletteWorker.isCancelled).toBe(true);
    expect(unrelated.isRunning).toBe(true);

    unrelated.cancel();
  });

  it("keeps no-match results disabled", async () => {
    let selected = false;
    const provider = new DiscoveryProvider([], [{ name: "Open File" }]);
    const palette = createPalette([provider], { runOnSelect: true });

    await palette.startup();
    await palette.open();
    await palette.updateQuery("zzz");
    await new Promise((resolve) => setTimeout(resolve, palette.noMatchesTimeout + 5));

    selected = palette.selectHighlighted().selected;

    expect(palette.results).toHaveLength(1);
    expect(palette.results[0]?.text).toBe("No matches found");
    expect(palette.results[0]?.disabled).toBe(true);
    expect(selected).toBe(false);

    await palette.shutdown();
  });

  it("requires two enter presses when runOnSelect is false", async () => {
    let calls = 0;
    const palette = createPalette([
      new DiscoveryProvider([{ name: "Preview Command" }]),
    ], { runOnSelect: false });

    await palette.startup();
    await palette.open();

    const first = palette.selectHighlighted();
    const second = palette.selectHighlighted();
    second.command?.();
    calls += second.selected ? 1 : 0;

    expect(first.selected).toBe(false);
    expect(palette.query).toBe("Preview Command");
    expect(calls).toBe(1);

    await palette.shutdown();
  });

  it("accepts the snake_case run_on_select option", () => {
    const palette = createPalette([], { run_on_select: false });

    expect(palette.runOnSelect).toBe(false);
  });
});
