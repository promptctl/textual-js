import { observable } from "mobx";
import { autoObservable } from "../framework/auto-observable.js";
import type { BoxProps, TextProps } from "ink";
import { Color } from "./color.js";
import { HexColorParseError, isHexColor } from "./disabled-dim.js";

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

const TRANSPARENT_RGBA = "rgba(0,0,0,0)";

// Mirrors stylesheet.colorToInkValue without taking a dependency on it
// (stylesheet.ts already imports ResolvedStyles, so importing the helper
// here would create a cycle).
function ruleToInkColor(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value instanceof Color) {
    return value.alpha === 1 ? value.hex6.toLowerCase() : value.css;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
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
    autoObservable(
      this,
      {
        rules: false,
        components: false,
        customProperties: false,
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

  // [LAW:no-defensive-null-guards] Required color: missing rule or non-hex
  // resolution is a DEFAULT_CSS / cascade bug. Throw so the bug is visible
  // at the framework boundary instead of being swallowed by a `?? "#hex"`.
  getColor(name: string): string {
    if (!this.rules.has(name)) {
      throw new RuleResolutionError(name, "rule not present in cascade");
    }
    const inkValue = ruleToInkColor(this.rules.get(name));
    if (inkValue === undefined || inkValue === TRANSPARENT_RGBA) {
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
    if (inkValue === undefined || inkValue === TRANSPARENT_RGBA) {
      return undefined;
    }
    if (!isHexColor(inkValue)) {
      throw new HexColorParseError(inkValue);
    }
    return inkValue;
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
