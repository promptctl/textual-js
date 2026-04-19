import { computed, type IComputedValue } from "mobx";

import { parseTcss } from "../styles/stylesheet.js";
import { parseSelectorList, type ParsedSelector } from "../styles/selectors.js";
import type { TextualFramework } from "./app-framework.js";
import type { WidgetNode } from "./widget-node.js";

export class NoMatches extends Error {}

export class TooManyMatches extends Error {}

export class WrongType extends Error {}

export class DeclarationError extends Error {}

export type QueryTypeConstraint = string | (abstract new (...args: never[]) => unknown);

export function matchesQueryTypeConstraint(widget: WidgetNode, typeConstraint: QueryTypeConstraint | undefined): boolean {
  if (typeConstraint === undefined) {
    return true;
  }

  return typeof typeConstraint === "string" ? widget.matchesType(typeConstraint) : widget instanceof typeConstraint;
}

export function ensureQueryType(widget: WidgetNode, typeConstraint: QueryTypeConstraint | undefined): WidgetNode {
  if (!matchesQueryTypeConstraint(widget, typeConstraint)) {
    throw new WrongType(`Query matched "${widget.typeName}", not the requested type`);
  }

  return widget;
}

export class DOMQuery implements Iterable<WidgetNode> {
  private readonly selectorFilters: ParsedSelector[][];
  private readonly selectorExcludes: ParsedSelector[][];
  private readonly resultsComputed: IComputedValue<WidgetNode[]>;

  constructor(
    private readonly framework: TextualFramework,
    private readonly root: WidgetNode,
    private readonly mode: "descendants" | "children",
    filters: ParsedSelector[][] = [],
    excludes: ParsedSelector[][] = [],
  ) {
    this.selectorFilters = filters;
    this.selectorExcludes = excludes;
    this.resultsComputed = computed(() => this.computeResults());
  }

  [Symbol.iterator](): Iterator<WidgetNode> {
    return this.results()[Symbol.iterator]();
  }

  get length(): number {
    return this.results().length;
  }

  get isEmpty(): boolean {
    return this.length === 0;
  }

  at(index: number): WidgetNode | undefined {
    return this.results()[index];
  }

  slice(start?: number, end?: number): WidgetNode[] {
    return this.results().slice(start, end);
  }

  reversed(): WidgetNode[] {
    return [...this.results()].reverse();
  }

  first(typeConstraint?: QueryTypeConstraint): WidgetNode {
    const [first] = this.results();

    if (first === undefined) {
      throw new NoMatches("Query returned no matches");
    }

    return ensureQueryType(first, typeConstraint);
  }

  last(typeConstraint?: QueryTypeConstraint): WidgetNode {
    const matches = this.results();
    const last = matches[matches.length - 1];

    if (last === undefined) {
      throw new NoMatches("Query returned no matches");
    }

    return ensureQueryType(last, typeConstraint);
  }

  onlyOne(typeConstraint?: QueryTypeConstraint): WidgetNode {
    const matches = this.results();

    if (matches.length === 0) {
      throw new NoMatches("Query returned no matches");
    }

    if (matches.length > 1) {
      throw new TooManyMatches("Query returned more than one match");
    }

    return ensureQueryType(matches[0]!, typeConstraint);
  }

  filter(selectorText: string): DOMQuery {
    return new DOMQuery(this.framework, this.root, this.mode, [...this.selectorFilters, parseSelectorList(selectorText)], this.selectorExcludes);
  }

  exclude(selectorText: string): DOMQuery {
    return new DOMQuery(this.framework, this.root, this.mode, this.selectorFilters, [...this.selectorExcludes, parseSelectorList(selectorText)]);
  }

  results(typeConstraint?: QueryTypeConstraint): WidgetNode[] {
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
    this.framework.refreshStyles(true);
    return this;
  }

  focus(): WidgetNode | null {
    const focusable = this.results().find((widget) => widget.focusable);
    this.framework.focusWidget(focusable?.nodeId ?? null);
    return focusable ?? null;
  }

  blur(): this {
    const matchedNodeIds = new Set(this.results().map((widget) => widget.nodeId));

    if (this.framework.focusedNodeId !== null && matchedNodeIds.has(this.framework.focusedNodeId)) {
      this.framework.focusWidget(null);
    }

    return this;
  }

  private computeResults(): WidgetNode[] {
    // [LAW:one-source-of-truth] DOMQuery invalidates from the registry version,
    // the same mutation signal used by mount, unmount, and identity updates.
    void this.framework.registry.version;
    const candidates =
      this.mode === "children" ? this.framework.registry.getChildren(this.root.nodeId) : this.framework.registry.getDescendants(this.root.nodeId);

    return candidates.filter((candidate) => {
      const passesFilters = this.selectorFilters.every((selectorGroup) =>
        selectorGroup.some((selector) => this.framework.matchesSelector(candidate, selector)),
      );
      const excluded = this.selectorExcludes.some((selectorGroup) =>
        selectorGroup.some((selector) => this.framework.matchesSelector(candidate, selector)),
      );
      return passesFilters && !excluded;
    });
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
