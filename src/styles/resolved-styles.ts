import { makeAutoObservable, observable } from "mobx";
import type { BoxProps, TextProps } from "ink";
import type { Color } from "./color.js";

export interface BorderValue {
  style: string;
  color?: string | Color;
}

export interface ResolvedRuleMap {
  [name: string]: unknown;
}

export interface ResolvedInkStyles {
  box: Partial<BoxProps>;
  text: Partial<TextProps>;
  style: Record<string, unknown>;
  components: Record<string, ResolvedRuleMap>;
  rules: ResolvedRuleMap;
  customProperties: Record<string, string>;
}

export class ResolvedStyles {
  box: Partial<BoxProps> = {};
  text: Partial<TextProps> = {};
  style: Record<string, unknown> = {};
  components = observable.map<string, ResolvedRuleMap>();
  readonly rules = observable.map<string, unknown>();
  readonly customProperties = observable.map<string, string>();
  version = 0;
  private readonly listeners = new Set<() => void>();

  constructor() {
    makeAutoObservable(
      this,
      {
        rules: false,
        components: false,
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
    this.style = nextStyles.style;
    this.components.replace(Object.entries(nextStyles.components));
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
