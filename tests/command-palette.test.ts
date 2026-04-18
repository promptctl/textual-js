import React from "react";
import { describe, expect, it } from "vitest";

import {
  CommandPalette,
  Provider,
  TextualFramework,
  type CommandHit,
  type DiscoveryHit,
} from "../src/index.js";

class TestProvider extends Provider {
  private readonly commands: Array<{ name: string; helpText?: string }>;
  readonly startupCalls: number[] = [];
  readonly shutdownCalls: number[] = [];

  constructor(commands: Array<{ name: string; helpText?: string }>) {
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
      .filter((command) => command.name.toLowerCase().includes(lowerQuery))
      .map((command) => ({
        score: command.name.toLowerCase().startsWith(lowerQuery) ? 100 : 50,
        matchDisplay: command.name,
        command: () => undefined,
        helpText: command.helpText,
      }));
  }
}

class DiscoveryProvider extends Provider {
  private readonly discoveryItems: Array<{ name: string; helpText?: string }>;
  private readonly searchItems: Array<{ name: string }>;

  constructor(
    discoveryItems: Array<{ name: string; helpText?: string }>,
    searchItems: Array<{ name: string }> = [],
  ) {
    super();
    this.discoveryItems = discoveryItems;
    this.searchItems = searchItems;
  }

  search(query: string): CommandHit[] {
    const lowerQuery = query.toLowerCase();

    return this.searchItems
      .filter((item) => item.name.toLowerCase().includes(lowerQuery))
      .map((item) => ({
        score: 50,
        matchDisplay: item.name,
        command: () => undefined,
      }));
  }

  discover(): DiscoveryHit[] {
    return this.discoveryItems.map((item) => ({
      display: item.name,
      command: () => undefined,
      helpText: item.helpText,
    }));
  }
}

function createPalette(
  providers: Provider[],
  options?: { runOnSelect?: boolean },
): CommandPalette {
  const framework = new TextualFramework();
  return new CommandPalette(providers, { app: framework }, options);
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
    expect(provider.context?.app).toBeInstanceOf(TextualFramework);
  });

  it("creates a palette with empty providers when no commands are declared", async () => {
    const palette = createPalette([]);

    await palette.startup();
    const results = await palette.search("anything");

    expect(results).toEqual([]);

    await palette.shutdown();
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
    expect(results.map((result) => result.display)).toContain("Save File");
    expect(results.map((result) => result.display)).toContain("Save As");
    expect(results.every((result) => result.display.toLowerCase().includes("save"))).toBe(true);

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
    expect(results.map((result) => result.display)).toContain("Recent: Open file.txt");

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
    expect(emptyQueryResults.map((result) => result.display)).toContain("Discover Me");
    expect(emptyQueryResults.map((result) => result.display)).not.toContain("Search Only");

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

  it("accepts runOnSelect false for two-step execution", () => {
    const palette = createPalette([], { runOnSelect: false });
    expect(palette.runOnSelect).toBe(false);
  });

  it("configures noMatchesTimeout with a default of 250ms", () => {
    const palette = createPalette([]);
    expect(palette.noMatchesTimeout).toBe(250);
  });

  it("reports open state from the active screen name", () => {
    const framework = new TextualFramework();

    expect(CommandPalette.isOpen(framework)).toBe(false);

    framework.pushScreen(React.createElement(React.Fragment), { name: CommandPalette.SCREEN_NAME });
    expect(CommandPalette.isOpen(framework)).toBe(true);

    framework.popScreen();
    expect(CommandPalette.isOpen(framework)).toBe(false);
  });

  it("ignores non-palette screens when checking open state", () => {
    const framework = new TextualFramework();

    framework.pushScreen(React.createElement(React.Fragment), { name: "dialog" });
    expect(CommandPalette.isOpen(framework)).toBe(false);
  });
});
