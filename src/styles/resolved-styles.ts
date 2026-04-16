import { makeAutoObservable, observable } from "mobx";
import type { BoxProps, TextProps } from "ink";

export interface BorderValue {
  style: string;
  color?: string;
}

export interface ResolvedRuleMap {
  [name: string]: unknown;
}

export interface ResolvedInkStyles {
  box: Partial<BoxProps>;
  text: Partial<TextProps>;
  rules: ResolvedRuleMap;
  customProperties: Record<string, string>;
}

export class ResolvedStyles {
  box: Partial<BoxProps> = {};
  text: Partial<TextProps> = {};
  readonly rules = observable.map<string, unknown>();
  readonly customProperties = observable.map<string, string>();
  version = 0;
  private readonly listeners = new Set<() => void>();

  constructor() {
    makeAutoObservable(
      this,
      {
        rules: false,
        customProperties: false,
        hasRule: false,
        getRule: false,
        listeners: false,
        subscribe: false,
      } as never,
      { autoBind: true },
    );
  }

  update(nextStyles: ResolvedInkStyles): void {
    this.box = nextStyles.box;
    this.text = nextStyles.text;
    this.rules.replace(Object.entries(nextStyles.rules));
    this.customProperties.replace(Object.entries(nextStyles.customProperties));
    this.version += 1;

    for (const listener of this.listeners) {
      listener();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  hasRule(name: string): boolean {
    return this.rules.has(name);
  }

  getRule<TValue>(name: string): TValue | undefined {
    return this.rules.get(name) as TValue | undefined;
  }
}
