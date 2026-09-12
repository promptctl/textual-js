import { observable } from "mobx";
import { autoObservable } from "../framework/auto-observable.js";
import type { BoxProps, TextProps } from "ink";
import { Color } from "./color.js";
import { HexColorParseError, isHexColor } from "./disabled-dim.js";
import { colorToInkValue } from "./ink-color.js";
import type { EdgeType } from "./edge-types.js";

export interface BorderValue {
  style: EdgeType;
  color: string | Color;
}

export interface ResolvedRuleMap {
  [name: string]: unknown;
}

export interface ResolvedInkStyles {
  box: Partial<BoxProps>;
  // The Ink border that draws the outline. It is not part of `box`, because an
  // outline is drawn on a different box from the border.
  outline: Partial<BoxProps>;
  text: Partial<TextProps>;
  style: Record<string, unknown>;
  components: Record<string, ResolvedRuleMap>;
  rules: ResolvedRuleMap;
  customProperties: Record<string, string>;
}

// [LAW:single-enforcer] Style validation lives at this single boundary so
// widgets read CSS-resolved values without casts and without inline fallbacks.
// A missing rule (or a non-hex resolution) is a framework or DEFAULT_CSS bug
// and is reported here, not silently patched at every consumer.
export class RuleResolutionError extends Error {
  constructor(public readonly ruleName: string, public readonly reason: string) {
    super(`Resolved styles missing required rule "${ruleName}": ${reason}`);
    this.name = "RuleResolutionError";
  }
}

// [LAW:one-source-of-truth] One mapping from a resolved rule to the colour Ink
// and rich-js are handed, shared with `rulesToInk` rather than mirrored here.
// It lives in its own module because `stylesheet.ts` imports this one, so
// importing the helper back from there would cycle.
function ruleToInkColor(value: unknown): string | undefined {
  return value instanceof Color || typeof value === "string" ? colorToInkValue(value) : undefined;
}

// [LAW:single-enforcer] One implementation of "read a resolved rule", shared by
// a widget's own styles and by each of its component-class scopes. A component
// scope is resolved by the same cascade against the same stylesheets, so it
// reads its rules through the same accessors; a second copy of this logic is a
// second place for `color` to mean something slightly different.
export class RuleReader {
  constructor(private readonly rules: ReadonlyMap<string, unknown>) {}

  hasRule(name: string): boolean {
    return this.rules.has(name);
  }

  getRule<TValue>(name: string): TValue | undefined {
    return this.rules.get(name) as TValue | undefined;
  }

  // [LAW:no-defensive-null-guards] Required color: missing rule or non-hex
  // resolution is a DEFAULT_CSS / cascade bug. Throw so the bug is visible
  // at the framework boundary instead of being swallowed by a `?? "#hex"`.
  getColor(name: string): string {
    if (!this.rules.has(name)) {
      throw new RuleResolutionError(name, "rule not present in cascade");
    }
    const inkValue = ruleToInkColor(this.rules.get(name));
    if (inkValue === undefined) {
      throw new RuleResolutionError(name, "rule resolved to transparent or empty value");
    }
    if (!isHexColor(inkValue)) {
      throw new HexColorParseError(inkValue);
    }
    return inkValue;
  }

  // [LAW:dataflow-not-control-flow] Optional color: explicit `undefined`
  // for rules legitimately not always set (e.g. `--switch-border` only
  // under `:focus`). A non-hex resolved value is still a bug — throw.
  tryColor(name: string): string | undefined {
    if (!this.rules.has(name)) {
      return undefined;
    }
    const inkValue = ruleToInkColor(this.rules.get(name));
    if (inkValue === undefined) {
      return undefined;
    }
    if (!isHexColor(inkValue)) {
      throw new HexColorParseError(inkValue);
    }
    return inkValue;
  }

  getEnum<T extends string>(name: string, allowed: readonly T[]): T {
    if (!this.rules.has(name)) {
      throw new RuleResolutionError(name, "rule not present in cascade");
    }
    const value = this.rules.get(name);
    if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
      throw new RuleResolutionError(
        name,
        `expected one of [${allowed.join(", ")}]; got ${JSON.stringify(value)}`,
      );
    }
    return value as T;
  }

  tryEnum<T extends string>(name: string, allowed: readonly T[]): T | undefined {
    if (!this.rules.has(name)) {
      return undefined;
    }
    const value = this.rules.get(name);
    if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
      throw new RuleResolutionError(
        name,
        `expected one of [${allowed.join(", ")}]; got ${JSON.stringify(value)}`,
      );
    }
    return value as T;
  }
}

export class ResolvedStyles {
  box: Partial<BoxProps> = {};
  outline: Partial<BoxProps> = {};
  text: Partial<TextProps> = {};
  style: Record<string, unknown> = {};
  readonly components = observable.map<string, RuleReader>();
  readonly rules = observable.map<string, unknown>();
  readonly customProperties = observable.map<string, string>();
  version = 0;
  private readonly listeners = new Set<() => void>();
  private readonly ownRules = new RuleReader(this.rules);

  constructor() {
    autoObservable(
      this,
      {
        rules: false,
        components: false,
        customProperties: false,
        ownRules: false,
        component: false,
        hasRule: false,
        getRule: false,
        getColor: false,
        tryColor: false,
        getCustomColor: false,
        tryCustomColor: false,
        getEnum: false,
        tryEnum: false,
        listeners: false,
        subscribe: false,
      },
      { autoBind: true },
    );
  }

  update(nextStyles: ResolvedInkStyles): void {
    this.box = nextStyles.box;
    this.outline = nextStyles.outline;
    this.text = nextStyles.text;
    this.style = nextStyles.style;
    this.components.replace(
      Object.entries(nextStyles.components).map(([name, rules]) => [name, new RuleReader(new Map(Object.entries(rules)))]),
    );
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

  // [LAW:no-defensive-null-guards] A component class the widget never declared
  // is a widget bug, not a styling condition to fall back from. The widget
  // type's componentClasses decide which names resolve; asking for any other one
  // is a typo that should surface here rather than paint an unstyled glyph.
  component(name: string): RuleReader {
    const reader = this.components.get(name);
    if (reader === undefined) {
      throw new RuleResolutionError(name, "not a component class of this widget type");
    }
    return reader;
  }

  hasRule(name: string): boolean {
    return this.ownRules.hasRule(name);
  }

  getRule<TValue>(name: string): TValue | undefined {
    return this.ownRules.getRule<TValue>(name);
  }

  getColor(name: string): string {
    return this.ownRules.getColor(name);
  }

  tryColor(name: string): string | undefined {
    return this.ownRules.tryColor(name);
  }

  getEnum<T extends string>(name: string, allowed: readonly T[]): T {
    return this.ownRules.getEnum(name, allowed);
  }

  tryEnum<T extends string>(name: string, allowed: readonly T[]): T | undefined {
    return this.ownRules.tryEnum(name, allowed);
  }

  getCustomColor(name: string): string {
    const value = this.customProperties.get(name);
    if (value === undefined) {
      throw new RuleResolutionError(name, "custom property not set");
    }
    if (!isHexColor(value)) {
      throw new HexColorParseError(value);
    }
    return value;
  }

  tryCustomColor(name: string): string | undefined {
    const value = this.customProperties.get(name);
    if (value === undefined) {
      return undefined;
    }
    if (!isHexColor(value)) {
      throw new HexColorParseError(value);
    }
    return value;
  }

}
