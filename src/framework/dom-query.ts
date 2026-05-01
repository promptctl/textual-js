import { computed, type IComputedValue } from "mobx";

import { parseTcss } from "../styles/stylesheet.js";
import { parseSelectorList, type ParsedSelector } from "../styles/selectors.js";
import type { App } from "../app/app.js";
import type { Widget } from "./widget.js";

export class NoMatches extends Error {}

export class TooManyMatches extends Error {}

export class WrongType extends Error {}

export class DeclarationError extends Error {}

export type QueryTypeConstraint = string | (abstract new (...args: never[]) => unknown);

export function matchesQueryTypeConstraint(widget: Widget, typeConstraint: QueryTypeConstraint | undefined): boolean {
  if (typeConstraint === undefined) {
    return true;
  }

  const resolvedTypeName = widget.app.resolveWidgetTypeName(typeConstraint as string | Function);
  return widget.matchesType(resolvedTypeName);
}

export function ensureQueryType(widget: Widget, typeConstraint: QueryTypeConstraint | undefined): Widget {
  if (!matchesQueryTypeConstraint(widget, typeConstraint)) {
    throw new WrongType(`Query matched "${widget.typeName}", not the requested type`);
  }

  return widget;
}

export class DOMQuery implements Iterable<Widget> {
  private static readonly simpleCache = new Map<string, ParsedSelector[][]>();
  private readonly selectorFilters: ParsedSelector[][];
  private readonly selectorExcludes: ParsedSelector[][];
  private readonly resultsComputed: IComputedValue<Widget[]>;

  constructor(
    private readonly app: App,
    private readonly root: Widget,
    private readonly mode: "descendants" | "children",
    filters: ParsedSelector[][] = [],
    excludes: ParsedSelector[][] = [],
  ) {
    this.selectorFilters = filters;
    this.selectorExcludes = excludes;
    this.resultsComputed = computed(() => this.computeResults());
  }

  [Symbol.iterator](): Iterator<Widget> {
    return this.results()[Symbol.iterator]();
  }

  get length(): number {
    return this.results().length;
  }

  get isEmpty(): boolean {
    return this.length === 0;
  }

  at(index: number): Widget | undefined {
    return this.results()[index];
  }

  slice(start?: number, end?: number): Widget[] {
    return this.results().slice(start, end);
  }

  reversed(): Widget[] {
    return [...this.results()].reverse();
  }

  first(typeConstraint?: QueryTypeConstraint): Widget {
    const [first] = this.results();

    if (first === undefined) {
      throw new NoMatches("Query returned no matches");
    }

    return ensureQueryType(first, typeConstraint);
  }

  last(typeConstraint?: QueryTypeConstraint): Widget {
    const matches = this.results();
    const last = matches[matches.length - 1];

    if (last === undefined) {
      throw new NoMatches("Query returned no matches");
    }

    return ensureQueryType(last, typeConstraint);
  }

  onlyOne(typeConstraint?: QueryTypeConstraint): Widget {
    const matches = this.results(typeConstraint);

    if (matches.length === 0) {
      throw new NoMatches("Query returned no matches");
    }

    if (matches.length > 1) {
      throw new TooManyMatches("Query returned more than one match");
    }

    return matches[0]!;
  }

  filter(selectorText: string): DOMQuery {
    return new DOMQuery(this.app, this.root, this.mode, [...this.selectorFilters, DOMQuery.parseSelectors(selectorText)], this.selectorExcludes);
  }

  exclude(selectorText: string): DOMQuery {
    return new DOMQuery(this.app, this.root, this.mode, this.selectorFilters, [...this.selectorExcludes, DOMQuery.parseSelectors(selectorText)]);
  }

  results(typeConstraint?: QueryTypeConstraint): Widget[] {
    const matches = this.resultsComputed.get();

    return typeConstraint === undefined
      ? matches
      : matches.filter((widget) => matchesQueryTypeConstraint(widget, typeConstraint));
  }

  addClass(...classNames: string[]): this {
    for (const widget of this.results()) {
      widget.addClass(...classNames);
    }

    return this;
  }

  removeClass(...classNames: string[]): this {
    for (const widget of this.results()) {
      widget.removeClass(...classNames);
    }

    return this;
  }

  toggleClass(className: string, force?: boolean): this {
    for (const widget of this.results()) {
      widget.toggleClass(className, force);
    }

    return this;
  }

  setClass(add: boolean, className: string): this {
    for (const widget of this.results()) {
      widget.toggleClass(className, add);
    }

    return this;
  }

  setClasses(classes: string | string[]): this {
    for (const widget of this.results()) {
      widget.setClasses(classes);
    }

    return this;
  }

  setStyles(css = "", updates: Record<string, string | number | null | undefined> = {}): this {
    const parsedUpdates = parseInlineStyleDeclarations(css);

    for (const widget of this.results()) {
      widget.setInlineStyles({ ...parsedUpdates, ...updates });
    }

    return this;
  }

  refresh(): this {
    this.app.refreshStyles(true);
    return this;
  }

  focus(): Widget | null {
    const focusable = this.results().find((widget) => widget.focusable);
    this.app.focusWidget(focusable?.nodeId ?? null);
    return focusable ?? null;
  }

  blur(): this {
    const matchedNodeIds = new Set(this.results().map((widget) => widget.nodeId));

    if (this.app.focusedNodeId !== null && matchedNodeIds.has(this.app.focusedNodeId)) {
      this.app.focusWidget(null);
    }

    return this;
  }

  private computeResults(): Widget[] {
    // [LAW:one-source-of-truth] DOMQuery invalidates from the registry version,
    // the same mutation signal used by mount, unmount, and identity updates.
    void this.app.registry.version;
    const candidates =
      this.mode === "children" ? this.app.registry.getChildren(this.root.nodeId) : this.app.registry.getDescendants(this.root.nodeId);

    return candidates.filter((candidate) => {
      const passesFilters = this.selectorFilters.every((selectorGroup) =>
        selectorGroup.some((selector) => this.app.matchesSelector(candidate, selector)),
      );
      const excluded = this.selectorExcludes.some((selectorGroup) =>
        selectorGroup.some((selector) => this.app.matchesSelector(candidate, selector)),
      );
      return passesFilters && !excluded;
    });
  }

  private static parseSelectors(selectorText: string): ParsedSelector[] {
    const trimmed = selectorText.trim();
    const cached = DOMQuery.simpleCache.get(trimmed);

    if (cached !== undefined) {
      return cached[0] ?? [];
    }

    const parsed = parseSelectorList(trimmed);

    if (!/[ >+~,:]/.test(trimmed)) {
      DOMQuery.simpleCache.set(trimmed, [parsed]);
    }

    return parsed;
  }
}

function parseInlineStyleDeclarations(css: string): Record<string, string> {
  const trimmedCss = css.trim();

  if (trimmedCss.length === 0) {
    return {};
  }

  try {
    const stylesheet = parseTcss(`* { ${trimmedCss} }`, { origin: "user" });
    const declarations: Record<string, string> = {};

    for (const declaration of stylesheet.rules[0]?.declarations ?? []) {
      declarations[declaration.property] = declaration.rawValue;
    }

    if (Object.keys(declarations).length === 0) {
      throw new Error(`Invalid inline CSS "${css}"`);
    }

    return declarations;
  } catch (error) {
    throw new DeclarationError(`Invalid inline CSS "${css}"`, { cause: error });
  }
}
