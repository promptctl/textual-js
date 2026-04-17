// [LAW:one-type-per-behavior] All suggesters share one base class.
// SuggestFromList is a built-in instance.

export abstract class Suggester {
  private readonly cache: Map<string, string | null> | null;
  readonly caseSensitive: boolean;

  constructor(options: { useCache?: boolean; caseSensitive?: boolean } = {}) {
    this.cache = options.useCache === false ? null : new Map();
    this.caseSensitive = options.caseSensitive ?? true;
  }

  async lookup(value: string): Promise<string | null> {
    // [LAW:dataflow-not-control-flow] Empty input always returns null without
    // consulting the cache or subclass — this is data, not a conditional skip.
    if (value.length === 0) {
      return null;
    }

    const normalizedValue = this.caseSensitive ? value : value.toLowerCase();

    if (this.cache !== null) {
      const cached = this.cache.get(normalizedValue);

      if (cached !== undefined) {
        return cached;
      }
    }

    const suggestion = await this.getSuggestion(normalizedValue);

    if (this.cache !== null) {
      this.cache.set(normalizedValue, suggestion);
    }

    return suggestion;
  }

  protected abstract getSuggestion(value: string): Promise<string | null> | string | null;
}

export class SuggestFromList extends Suggester {
  private readonly items: readonly string[];

  constructor(items: readonly string[], options: { caseSensitive?: boolean; useCache?: boolean } = {}) {
    super({ useCache: options.useCache ?? true, caseSensitive: options.caseSensitive ?? true });
    this.items = items;
  }

  protected getSuggestion(value: string): string | null {
    // [LAW:dataflow-not-control-flow] Matching always iterates the full list;
    // the prefix test is the data that decides which item wins.
    for (const item of this.items) {
      const candidate = this.caseSensitive ? item : item.toLowerCase();

      if (candidate.startsWith(value)) {
        return item;
      }
    }

    return null;
  }
}
