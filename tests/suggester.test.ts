import { describe, expect, it } from "vitest";
import React from "react";

import {
  Input,
  InputChanged,
  SuggestFromList,
  SuggestionController,
  SuggestionReady,
  Suggester,
  runTest,
} from "../src/index.js";

class FillSuggester extends Suggester {
  protected getSuggestion(value: string): string | null {
    return value.length <= 10 ? value.padEnd(10, "x") : null;
  }
}

function stripAnsi(value: string | undefined): string {
  return (value ?? "").replace(/\u001B\[[0-9;]*m/g, "");
}

describe("Suggester base", () => {
  it("returns null for empty input without consulting the subclass", async () => {
    const suggester = new FillSuggester();
    expect(await suggester.lookup("")).toBeNull();
  });

  it("caches results by default and skips re-invocation", async () => {
    let callCount = 0;

    class CountingSuggester extends Suggester {
      protected getSuggestion(value: string): string | null {
        callCount += 1;
        return `suggestion-for-${value}`;
      }
    }

    const suggester = new CountingSuggester();

    expect(await suggester.lookup("hello")).toBe("suggestion-for-hello");
    expect(await suggester.lookup("hello")).toBe("suggestion-for-hello");
    expect(callCount).toBe(1);
  });

  it("bypasses cache when useCache is false", async () => {
    let callCount = 0;

    class CountingSuggester extends Suggester {
      protected getSuggestion(value: string): string | null {
        callCount += 1;
        return `suggestion-${callCount}`;
      }
    }

    const suggester = new CountingSuggester({ useCache: false });

    const first = await suggester.lookup("test");
    const second = await suggester.lookup("test");
    expect(first).toBe("suggestion-1");
    expect(second).toBe("suggestion-2");
    expect(callCount).toBe(2);
  });

  it("normalizes cache keys to lowercase when case insensitive", async () => {
    let callCount = 0;

    class CountingSuggester extends Suggester {
      protected getSuggestion(value: string): string | null {
        callCount += 1;
        return `result-${value}`;
      }
    }

    const suggester = new CountingSuggester({ caseSensitive: false });

    expect(await suggester.lookup("Hello")).toBe("result-hello");
    expect(await suggester.lookup("HELLO")).toBe("result-hello");
    expect(await suggester.lookup("hello")).toBe("result-hello");
    expect(callCount).toBe(1);
  });

  it("supports snake_case suggester hooks and option names", async () => {
    class SnakeCaseSuggester extends Suggester {
      protected override get_suggestion(value: string): string | null {
        return `${value}!`;
      }
    }

    const suggester = new SnakeCaseSuggester({ use_cache: true, case_sensitive: false });

    expect(suggester.use_cache).toBe(true);
    expect(suggester.case_sensitive).toBe(false);
    expect(await suggester.lookup("Hello")).toBe("hello!");
  });

  it("posts SuggestionReady on every successful lookup, including cache hits", async () => {
    let callCount = 0;

    class CountingSuggester extends Suggester {
      protected override getSuggestion(value: string): string | null {
        callCount += 1;
        return `suggestion-for-${value}`;
      }
    }

    const controller = new SuggestionController(new CountingSuggester());
    const messages: SuggestionReady[] = [];

    await controller.update("hello", (message) => {
      messages.push(message);
    });
    await controller.update("hello", (message) => {
      messages.push(message);
    });

    expect(callCount).toBe(1);
    expect(messages.map((message) => [message.value, message.suggestion])).toEqual([
      ["hello", "suggestion-for-hello"],
      ["hello", "suggestion-for-hello"],
    ]);
  });
});

describe("SuggestFromList", () => {
  it("returns the first prefix match from the candidate list", async () => {
    const suggester = new SuggestFromList(["dog", "dad", "cat"]);

    expect(await suggester.lookup("d")).toBe("dog");
    expect(await suggester.lookup("da")).toBe("dad");
    expect(await suggester.lookup("c")).toBe("cat");
    expect(await suggester.lookup("z")).toBeNull();
  });

  it("preserves original candidate casing in case-insensitive mode", async () => {
    const suggester = new SuggestFromList(
      ["England", "Portugal", "Scotland"],
      { caseSensitive: false },
    );

    expect(await suggester.lookup("p")).toBe("Portugal");
    expect(await suggester.lookup("P")).toBe("Portugal");
    expect(await suggester.lookup("s")).toBe("Scotland");
    expect(await suggester.lookup("S")).toBe("Scotland");
  });

  it("returns first match when multiple candidates have the same prefix", async () => {
    const suggester = new SuggestFromList(
      ["England", "Portugal", "Scotland", "portugal", "PORTUGAL"],
      { caseSensitive: false },
    );

    expect(await suggester.lookup("p")).toBe("Portugal");
    expect(await suggester.lookup("po")).toBe("Portugal");
  });

  it("never produces a suggestion for empty input", async () => {
    const suggester = new SuggestFromList(["hello", "world"]);
    expect(await suggester.lookup("")).toBeNull();
  });
});

describe("Input suggester integration", () => {
  it("displays suggestions, posts SuggestionReady, and accepts with right arrow", async () => {
    const suggestions: SuggestionReady[] = [];
    const changes: InputChanged[] = [];
    const session = await runTest(
      React.createElement(Input, {
        suggester: new SuggestFromList(["hello", "world"]),
      }),
      {
        // Typing only reaches an Input that holds focus, so the app names it as
        // its auto-focus target the way a Textual app's AUTO_FOCUS selector does.
        appProps: { autoFocus: "Input" },
        messageHook: (message) => {
          if (message instanceof SuggestionReady) {
            suggestions.push(message);
          } else if (message instanceof InputChanged) {
            changes.push(message);
          }
        },
      },
    );

    await session.pilot.type("h");

    expect(stripAnsi(session.lastFrame())).toContain("hello");
    expect(suggestions.at(-1)?.value).toBe("h");
    expect(suggestions.at(-1)?.suggestion).toBe("hello");

    await session.pilot.press("right");

    expect(changes.at(-1)?.value).toBe("hello");

    session.unmount();
  });

  it("clears, restores, and re-evaluates suggestions as the value changes", async () => {
    const session = await runTest(
      React.createElement(Input, {
        suggester: new SuggestFromList(["hello"]),
      }),
      { appProps: { autoFocus: "Input" } },
    );

    await session.pilot.type("help");
    expect(session.lastFrame()).toContain("help");
    expect(session.lastFrame()).not.toContain("hello");

    await session.pilot.press("backspace");
    expect(stripAnsi(session.lastFrame())).toContain("hello");

    await session.pilot.press("left", "backspace");
    expect(session.lastFrame()).not.toContain("hello");

    session.unmount();
  });

  it("does not post SuggestionReady when no suggestion exists", async () => {
    const suggestions: SuggestionReady[] = [];
    const session = await runTest(
      React.createElement(Input, {
        suggester: new SuggestFromList(["hello"]),
      }),
      {
        appProps: { autoFocus: "Input" },
        messageHook: (message) => {
          if (message instanceof SuggestionReady) {
            suggestions.push(message);
          }
        },
      },
    );

    await session.pilot.type("z");

    expect(suggestions).toHaveLength(0);

    session.unmount();
  });

  it("supports special-character prefixes", async () => {
    const suggester = new SuggestFromList(["cafe-con-leche", "café", "hello.world"]);

    expect(await suggester.lookup("cafe-")).toBe("cafe-con-leche");
    expect(await suggester.lookup("café")).toBe("café");
    expect(await suggester.lookup("hello.")).toBe("hello.world");
  });

  it("exposes the current suggestion on the live input widget", async () => {
    const session = await runTest(
      React.createElement(Input, {
        suggester: new SuggestFromList(["hello"]),
      }),
      { appProps: { autoFocus: "Input" } },
    );

    await session.pilot.type("h");

    const input = session.app.findWidgets("Input")[0] as unknown as {
      _suggestion: string;
    };

    expect(input._suggestion).toBe("hello");

    session.unmount();
  });

  it("shows the ghost suffix for case-insensitive suggestions", async () => {
    const session = await runTest(
      React.createElement(Input, {
        suggester: new SuggestFromList(["Scotland"], { case_sensitive: false }),
      }),
      { appProps: { autoFocus: "Input" } },
    );

    await session.pilot.type("s");

    expect(stripAnsi(session.lastFrame())).toContain("cotland");

    session.unmount();
  });
});
