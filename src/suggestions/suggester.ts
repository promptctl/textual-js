// [LAW:one-type-per-behavior] All suggesters share one base class.
// SuggestFromList is a built-in instance.

import { Message, type MessageInit } from "../events/message.js";

export class SuggestionReady extends Message {
  constructor(
    readonly value: string,
    readonly suggestion: string,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export abstract class Suggester {
  private readonly cache: Map<string, string | null> | null;
  readonly caseSensitive: boolean;

  constructor(options: { useCache?: boolean; use_cache?: boolean; caseSensitive?: boolean; case_sensitive?: boolean } = {}) {
    this.cache = options.useCache === false || options.use_cache === false ? null : new Map();
    this.caseSensitive = options.caseSensitive ?? options.case_sensitive ?? true;
  }

  get use_cache(): boolean {
    return this.cache !== null;
  }

  get case_sensitive(): boolean {
    return this.caseSensitive;
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

  protected getSuggestion(value: string): Promise<string | null> | string | null {
    return this.get_suggestion(value);
  }

  protected get_suggestion(_value: string): Promise<string | null> | string | null {
    throw new Error("Suggester subclasses must implement getSuggestion() or get_suggestion()");
  }
}

export class SuggestionController {
  private generation = 0;
  suggestion = "";

  constructor(private readonly suggester: Suggester | null) {}

  async update(
    value: string,
    postSuggestion: (message: SuggestionReady) => void,
  ): Promise<string> {
    const generation = this.generation + 1;
    this.generation = generation;
    const suggestion = await this.lookup(value);

    if (generation !== this.generation) {
      return this.suggestion;
    }

    this.suggestion = suggestion ?? "";

    if (suggestion !== null) {
      postSuggestion(new SuggestionReady(value, suggestion));
    }

    return this.suggestion;
  }

  private async lookup(value: string): Promise<string | null> {
    if (this.suggester === null || value.length === 0) {
      return null;
    }

    // [LAW:single-enforcer] Suggestion lookup, empty-value suppression, and
    // message eligibility live here so Input does not duplicate suggester rules.
    return this.suggester.lookup(value);
  }
}

export class SuggestFromList extends Suggester {
  private readonly items: readonly string[];

  constructor(
    items: readonly string[],
    options: { caseSensitive?: boolean; case_sensitive?: boolean; useCache?: boolean; use_cache?: boolean } = {},
  ) {
    super({
      useCache: options.useCache ?? options.use_cache ?? true,
      caseSensitive: options.caseSensitive ?? options.case_sensitive ?? true,
    });
    this.items = items;
  }

  protected get_suggestion(value: string): string | null {
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
