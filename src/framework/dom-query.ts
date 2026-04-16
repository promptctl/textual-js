import { computed, type IComputedValue } from "mobx";

import { parseSelectorList, type ParsedSelector } from "../styles/selectors.js";
import type { TextualFramework } from "./app-framework.js";
import type { WidgetNode } from "./widget-node.js";

export class NoMatches extends Error {}

export class TooManyMatches extends Error {}

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

  first(): WidgetNode {
    const [first] = this.results();

    if (first === undefined) {
      throw new NoMatches("Query returned no matches");
    }

    return first;
  }

  last(): WidgetNode {
    const matches = this.results();
    const last = matches[matches.length - 1];

    if (last === undefined) {
      throw new NoMatches("Query returned no matches");
    }

    return last;
  }

  filter(selectorText: string): DOMQuery {
    return new DOMQuery(this.framework, this.root, this.mode, [...this.selectorFilters, parseSelectorList(selectorText)], this.selectorExcludes);
  }

  exclude(selectorText: string): DOMQuery {
    return new DOMQuery(this.framework, this.root, this.mode, this.selectorFilters, [...this.selectorExcludes, parseSelectorList(selectorText)]);
  }

  results(): WidgetNode[] {
    return this.resultsComputed.get();
  }

  private computeResults(): WidgetNode[] {
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
