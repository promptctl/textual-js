import * as csstree from "css-tree";

import type { TextualFramework } from "../framework/app-framework.js";
import type { Widget } from "../framework/widget.js";
import { PSEUDO_CLASS_NAMES } from "./pseudo-classes.js";

export interface SelectorSpecificity {
  ids: number;
  classes: number;
  types: number;
}

export interface ParsedSelectorSegment {
  selectors: Array<
    | { type: "type"; name: string }
    | { type: "class"; name: string }
    | { type: "id"; name: string }
    | { type: "pseudo"; name: string }
    | { type: "universal" }
  >;
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
      children: Iterable<{ children: Iterable<unknown> }>;
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
            currentSegment.selectors.push({ type: "universal" });
            continue;
          }

          validateTypeName(child.name ?? "", selectorText);
          specificity.types += 1;
          currentSegment.selectors.push({ type: "type", name: child.name ?? "" });
          continue;
        }

        if (child.type === "ClassSelector") {
          validateIdentifier(child.name ?? "", selectorText);
          specificity.classes += 1;
          currentSegment.selectors.push({ type: "class", name: child.name ?? "" });
          continue;
        }

        if (child.type === "IdSelector") {
          validateIdentifier(child.name ?? "", selectorText);
          specificity.ids += 1;
          currentSegment.selectors.push({ type: "id", name: child.name ?? "" });
          continue;
        }

        if (child.type === "PseudoClassSelector") {
          validatePseudoClass(child.name ?? "");
          specificity.classes += 1;
          currentSegment.selectors.push({ type: "pseudo", name: child.name ?? "" });
          continue;
        }

        if (child.type === "UniversalSelector") {
          currentSegment.selectors.push({ type: "universal" });
        }
      }

      segments.push(currentSegment);

      selectors.push({
        raw: csstree.generate(selectorNode as never),
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

function matchesSegment(segment: ParsedSelectorSegment, widget: Widget): boolean {
  return segment.selectors.every((selector) => {
    if (selector.type === "universal") {
      return true;
    }

    if (selector.type === "type") {
      return widget.matchesType(selector.name);
    }

    if (selector.type === "class") {
      return widget.hasClass(selector.name);
    }

    if (selector.type === "id") {
      return widget.id === selector.name;
    }

    return widget.hasPseudoClass(selector.name);
  });
}

function matchSelectorFrom(
  framework: TextualFramework,
  widget: Widget,
  selector: ParsedSelector,
  segmentIndex: number,
): boolean {
  if (!matchesSegment(selector.segments[segmentIndex], widget)) {
    return false;
  }

  if (segmentIndex === 0) {
    return true;
  }

  const combinator = selector.combinators[segmentIndex - 1];

  if (combinator === ">") {
    const parent = widget.parent;
    return parent === undefined ? false : matchSelectorFrom(framework, parent, selector, segmentIndex - 1);
  }

  if (combinator === "+") {
    const sibling = framework.registry.getPreviousSibling(widget.nodeId);
    return sibling === undefined ? false : matchSelectorFrom(framework, sibling, selector, segmentIndex - 1);
  }

  if (combinator === "~") {
    return framework.registry
      .getPreviousSiblings(widget.nodeId)
      .some((sibling) => matchSelectorFrom(framework, sibling, selector, segmentIndex - 1));
  }

  let currentParent = widget.parent;

  while (currentParent !== undefined) {
    if (matchSelectorFrom(framework, currentParent, selector, segmentIndex - 1)) {
      return true;
    }

    currentParent = currentParent.parent;
  }

  return false;
}

export function matchesSelector(framework: TextualFramework, widget: Widget, selector: ParsedSelector): boolean {
  return matchSelectorFrom(framework, widget, selector, selector.segments.length - 1);
}
