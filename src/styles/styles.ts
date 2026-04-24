import { makeAutoObservable, observable } from "mobx";

import { normalizeStyleAssignment, parseTcss, type StyleAssignmentValue } from "./stylesheet.js";

export class Styles {
  private readonly rules = observable.map<string, string>();

  constructor(
    private readonly onChange?: () => void,
    initialRules?: Record<string, string>,
  ) {
    makeAutoObservable(
      this,
      {
        rules: false,
        onChange: false,
      } as never,
      { autoBind: true },
    );

    if (initialRules !== undefined) {
      this.rules.replace(Object.entries(initialRules));
    }
  }

  hasRule(name: string): boolean {
    return this.rules.has(name);
  }

  has_rule(name: string): boolean {
    return this.hasRule(name);
  }

  clearRule(name: string): void {
    this.rules.delete(name);
    this.onChange?.();
  }

  clear_rule(name: string): void {
    this.clearRule(name);
  }

  getRule(name: string): string | undefined {
    return this.rules.get(name);
  }

  getRules(): Record<string, string> {
    return Object.fromEntries(this.rules.entries());
  }

  get_rules(): Record<string, string> {
    return this.getRules();
  }

  setRule(name: string, value: StyleAssignmentValue | null | undefined): void {
    if (value === null || value === undefined) {
      this.clearRule(name);
      return;
    }

    this.rules.set(name, normalizeStyleAssignment(name, value));
    this.onChange?.();
  }

  set_rule(name: string, value: StyleAssignmentValue | null | undefined): void {
    this.setRule(name, value);
  }

  reset(): void {
    this.rules.clear();
    this.onChange?.();
  }

  merge(other: Styles): void {
    this.mergeRules(other.getRules());
  }

  mergeRules(rules: Record<string, StyleAssignmentValue | null | undefined>): void {
    for (const [name, value] of Object.entries(rules)) {
      this.setRule(name, value);
    }
  }

  merge_rules(rules: Record<string, StyleAssignmentValue | null | undefined>): void {
    this.mergeRules(rules);
  }

  parse(css: string, readFrom = "<inline>"): this {
    const trimmedCss = css.trim();

    if (trimmedCss.length === 0) {
      return this;
    }

    const stylesheet = parseTcss(`* { ${trimmedCss} }`, { origin: "user" });

    for (const declaration of stylesheet.rules[0]?.declarations ?? []) {
      this.setRule(declaration.property, declaration.rawValue);
    }

    // [LAW:one-source-of-truth] Inline style parsing reuses the stylesheet
    // parser, so property normalization stays identical across CSS boundaries.
    void readFrom;
    return this;
  }

  get css(): string {
    return Object.entries(this.getRules())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}: ${value};`)
      .join(" ");
  }

  entries(): IterableIterator<[string, string]> {
    return this.rules.entries();
  }
}

export function createStylesProxy<TStyles extends Styles>(styles: TStyles): TStyles {
  return new Proxy(styles, {
    get(target, property, receiver) {
      if (typeof property === "string" && !(property in target)) {
        const styleName = property.replace(/_/g, "-").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        return target.getRule(styleName);
      }

      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (typeof property === "string" && !(property in target)) {
        const styleName = property.replace(/_/g, "-").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
        target.setRule(styleName, value as StyleAssignmentValue | null | undefined);
        return true;
      }

      return Reflect.set(target, property, value, receiver);
    },
  });
}

