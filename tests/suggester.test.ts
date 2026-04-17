import { describe, expect, it } from "vitest";

import { SuggestFromList, Suggester } from "../src/index.js";

class FillSuggester extends Suggester {
  protected getSuggestion(value: string): string | null {
    return value.length <= 10 ? value.padEnd(10, "x") : null;
  }
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
