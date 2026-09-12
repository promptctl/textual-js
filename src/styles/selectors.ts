import * as csstree from "css-tree";

import type { Widget } from "../framework/widget.js";
import { PSEUDO_CLASS_NAMES } from "./pseudo-classes.js";

// [LAW:one-way-deps] Narrow capability interface the matcher requires from its
// host (typically AppRuntime). The matcher never imports the host class.
// Host implements this structurally; selectors.ts depends only on this shape.
export interface SelectorMatchHost {
  getPreviousSibling(nodeId: string): Widget | undefined;
  getPreviousSiblings(nodeId: string): Widget[];
}

// [LAW:one-type-per-behavior] Everything a selector can interrogate about the
// thing it is matching. A Widget is one such node; a component-class scope
// (`.toggle--button` hanging off its owner) is another, and the two differ only
// in the answers they give — never in the matching, which is why this interface
// exists and the matcher below names it instead of Widget. Widget satisfies it
// structurally, so nothing at the call sites changed.
export interface StyleNode {
  readonly id?: string;
  readonly nodeId: string;
  readonly parent: StyleNode | undefined;
  matchesType(typeName: string): boolean;
  hasClass(className: string): boolean;
  hasPseudoClass(name: string): boolean;
}

export interface SelectorSpecificity {
  ids: number;
  classes: number;
  types: number;
}

// [LAW:dataflow-not-control-flow] Each SegmentSelector carries its own match
// closure (built at parse time). The matcher iterates and calls — it does not
// branch on .type. The .type tag remains for introspection by consumers like
// the DEFAULT_CSS scoper that need to identify selector kind without matching.
type SegmentSelectorData =
  | { type: "type"; name: string }
  | { type: "class"; name: string }
  | { type: "id"; name: string }
  | { type: "pseudo"; name: string }
  | { type: "universal" };

export type SegmentSelector = SegmentSelectorData & { match(node: StyleNode): boolean };

export interface ParsedSelectorSegment {
  selectors: SegmentSelector[];
}

export interface ParsedSelector {
  raw: string;
  segments: ParsedSelectorSegment[];
  combinators: string[];
  specificity: SelectorSpecificity;
}

export class InvalidQueryFormat extends Error {}

const TEXTUAL_IDENTIFIER = /^-*[A-Za-z_][A-Za-z0-9_-]*$/;
const TEXTUAL_TYPE_NAME = /^[A-Z][A-Za-z0-9-]*$/;

function validateIdentifier(name: string, selectorText: string): void {
  if (!TEXTUAL_IDENTIFIER.test(name)) {
    throw new InvalidQueryFormat(`Invalid selector "${selectorText}"`);
  }
}

function validateTypeName(name: string, selectorText: string): void {
  if (!TEXTUAL_TYPE_NAME.test(name)) {
    throw new InvalidQueryFormat(`Invalid selector "${selectorText}"`);
  }
}

function closestPseudoClass(name: string): string | undefined {
  const distance = (left: string, right: string): number => {
    const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);

    for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
      const current = [leftIndex + 1];

      for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
        const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
        current.push(
          Math.min(
            current[rightIndex]! + 1,
            previous[rightIndex + 1]! + 1,
            previous[rightIndex]! + substitutionCost,
          ),
        );
      }

      previous.splice(0, previous.length, ...current);
    }

    return previous[right.length]!;
  };
  const scored = [...PSEUDO_CLASS_NAMES]
    .map((candidate) => ({ candidate, score: distance(name, candidate) }))
    .sort((left, right) => left.score - right.score || left.candidate.localeCompare(right.candidate));
  const best = scored[0];
  return best !== undefined && best.score <= Math.max(2, Math.floor(name.length / 3)) ? best.candidate : undefined;
}

function validatePseudoClass(name: string): void {
  if (PSEUDO_CLASS_NAMES.has(name)) {
    return;
  }

  const suggestion = closestPseudoClass(name);
  const suffix = suggestion === undefined ? "" : `; did you mean "${suggestion}"?`;
  throw new InvalidQueryFormat(`unknown pseudo-class '${name}'${suffix}`);
}

function compareSpecificity(left: SelectorSpecificity, right: SelectorSpecificity): number {
  return left.ids - right.ids || left.classes - right.classes || left.types - right.types;
}

export function compareSelectorSpecificity(left: SelectorSpecificity, right: SelectorSpecificity): number {
  return compareSpecificity(left, right);
}

export function isIdSelector(selectorText: string): boolean {
  return /^#[A-Za-z_][A-Za-z0-9_-]*$/.test(selectorText.trim());
}

export const is_id_selector = isIdSelector;

export function parseSelectorList(selectorText: string): ParsedSelector[] {
  try {
    if (selectorText.includes("&")) {
      throw new Error("Parent selectors are only valid before nested CSS flattening");
    }

    const selectorList = csstree.parse(selectorText, { context: "selectorList" }) as {
      children: Iterable<csstree.CssNode & { children: Iterable<unknown> }>;
    };
    const selectors: ParsedSelector[] = [];

    for (const selectorNode of selectorList.children) {
      const segments: ParsedSelectorSegment[] = [];
      const combinators: string[] = [];
      let currentSegment: ParsedSelectorSegment = { selectors: [] };
      const specificity: SelectorSpecificity = { ids: 0, classes: 0, types: 0 };

      for (const child of selectorNode.children as Iterable<{ type: string; name?: string }>) {
        if (child.type === "Combinator") {
          segments.push(currentSegment);
          combinators.push(child.name === " " ? " " : (child.name ?? " "));
          currentSegment = { selectors: [] };
          continue;
        }

        if (child.type === "TypeSelector") {
          if (child.name === "*") {
            currentSegment.selectors.push(makeUniversal());
            continue;
          }

          const name = child.name ?? "";
          validateTypeName(name, selectorText);
          specificity.types += 1;
          currentSegment.selectors.push(makeType(name));
          continue;
        }

        if (child.type === "ClassSelector") {
          const name = child.name ?? "";
          validateIdentifier(name, selectorText);
          specificity.classes += 1;
          currentSegment.selectors.push(makeClass(name));
          continue;
        }

        if (child.type === "IdSelector") {
          const name = child.name ?? "";
          validateIdentifier(name, selectorText);
          specificity.ids += 1;
          currentSegment.selectors.push(makeId(name));
          continue;
        }

        if (child.type === "PseudoClassSelector") {
          const name = child.name ?? "";
          validatePseudoClass(name);
          specificity.classes += 1;
          currentSegment.selectors.push(makePseudo(name));
          continue;
        }

        if (child.type === "UniversalSelector") {
          currentSegment.selectors.push(makeUniversal());
        }
      }

      segments.push(currentSegment);

      selectors.push({
        raw: csstree.generate(selectorNode),
        segments,
        combinators,
        specificity,
      });
    }

    return selectors;
  } catch (error) {
    if (error instanceof InvalidQueryFormat) {
      throw error;
    }

    throw new InvalidQueryFormat(`Invalid selector "${selectorText}"`, { cause: error });
  }
}

function makeUniversal(): SegmentSelector {
  return { type: "universal", match: () => true };
}

function makeType(name: string): SegmentSelector {
  return { type: "type", name, match: (node) => node.matchesType(name) };
}

function makeClass(name: string): SegmentSelector {
  return { type: "class", name, match: (node) => node.hasClass(name) };
}

function makeId(name: string): SegmentSelector {
  return { type: "id", name, match: (node) => node.id === name };
}

function makePseudo(name: string): SegmentSelector {
  return { type: "pseudo", name, match: (node) => node.hasPseudoClass(name) };
}

// [LAW:one-source-of-truth] COMBINATOR_CANDIDATES is the canonical mapping
// from combinator symbol to the set of widgets that the previous selector
// segment may bind to. The matcher iterates this set unconditionally; it does
// not branch on combinator symbol.
type CombinatorCandidates = (host: SelectorMatchHost, node: StyleNode) => Iterable<StyleNode>;

function* walkAncestors(node: StyleNode): Iterable<StyleNode> {
  let current = node.parent;
  while (current !== undefined) {
    yield current;
    current = current.parent;
  }
}

const COMBINATOR_CANDIDATES: Readonly<Record<string, CombinatorCandidates>> = {
  ">": (_host, node) => (node.parent === undefined ? [] : [node.parent]),
  "+": (host, node) => {
    const sibling = host.getPreviousSibling(node.nodeId);
    return sibling === undefined ? [] : [sibling];
  },
  "~": (host, node) => host.getPreviousSiblings(node.nodeId),
  " ": (_host, node) => walkAncestors(node),
};

function matchSelectorFrom(
  host: SelectorMatchHost,
  node: StyleNode,
  selector: ParsedSelector,
  segmentIndex: number,
): boolean {
  if (!selector.segments[segmentIndex].selectors.every((part) => part.match(node))) {
    return false;
  }

  if (segmentIndex === 0) {
    return true;
  }

  const combinator = selector.combinators[segmentIndex - 1];

  for (const candidate of COMBINATOR_CANDIDATES[combinator](host, node)) {
    if (matchSelectorFrom(host, candidate, selector, segmentIndex - 1)) {
      return true;
    }
  }

  return false;
}

export function matchesSelector(host: SelectorMatchHost, node: StyleNode, selector: ParsedSelector): boolean {
  return matchSelectorFrom(host, node, selector, selector.segments.length - 1);
}
