import * as csstree from "css-tree";

import { Spacing } from "../geometry/index.js";
import { parseScalar, type Scalar, scalarToInkValue } from "./scalar.js";
import type { BorderValue, ResolvedInkStyles, ResolvedRuleMap } from "./resolved-styles.js";
import { compareSelectorSpecificity, matchesSelector, parseSelectorList, type ParsedSelector } from "./selectors.js";
import type { TextualFramework } from "../framework/app-framework.js";
import type { WidgetNode } from "../framework/widget-node.js";

export type StylesheetOrigin = "default" | "user";

export interface ParsedDeclaration {
  property: string;
  important: boolean;
  rawValue: string;
  value: unknown;
}

export interface ParsedRule {
  selectors: ParsedSelector[];
  declarations: ParsedDeclaration[];
  order: number;
  origin: StylesheetOrigin;
}

export interface ParsedStylesheet {
  ast: csstree.CssNode;
  source: string;
  flatSource: string;
  rules: ParsedRule[];
  origin: StylesheetOrigin;
}

export interface ParseStylesheetOptions {
  origin: StylesheetOrigin;
  scopeTypeName?: string;
}

export interface CascadeValue {
  property: string;
  value: unknown;
  rawValue: string;
  important: boolean;
  order: number;
  originWeight: number;
  specificity: { ids: number; classes: number; types: number };
}

const DIMENSION_PROPERTIES = new Set([
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
]);

const WIDTH_AXIS_PROPERTIES = new Set(["width", "min-width", "max-width"]);
const HEIGHT_AXIS_PROPERTIES = new Set(["height", "min-height", "max-height"]);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractVariables(source: string): { source: string; variables: Map<string, string> } {
  const variables = new Map<string, string>();
  const strippedSource = source.replace(
    /(^|\n)\s*\$([A-Za-z0-9_-]+)\s*:\s*([^;\n{}]*?)\s*(?:;(?=\s*(?:\n|$))|\n|$)/g,
    (_match, prefix, name, value) => {
      variables.set(name, value.trim());
      return prefix;
    },
  );

  return { source: strippedSource, variables };
}

function resolveVariables(variables: Map<string, string>): Map<string, string> {
  const resolved = new Map<string, string>();

  const resolve = (name: string): string => {
    const cached = resolved.get(name);

    if (cached !== undefined) {
      return cached;
    }

    const value = variables.get(name);

    if (value === undefined) {
      throw new Error(`Unknown variable $${name}`);
    }

    const nextValue = value.replace(/\$([A-Za-z0-9_-]+)/g, (_match, referenceName: string) => resolve(referenceName));
    resolved.set(name, nextValue);
    return nextValue;
  };

  for (const name of variables.keys()) {
    resolve(name);
  }

  return resolved;
}

function substituteVariables(source: string): string {
  const { source: sourceWithoutVariables, variables } = extractVariables(stripComments(source));
  const resolvedVariables = resolveVariables(variables);

  return sourceWithoutVariables.replace(/\$([A-Za-z0-9_-]+)/g, (_match, name: string) => {
    const resolved = resolvedVariables.get(name);

    if (resolved === undefined) {
      throw new Error(`Unknown variable $${name}`);
    }

    return resolved;
  });
}

function splitSelectors(selectorText: string): string[] {
  return selectorText
    .split(",")
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0);
}

function combineSelectors(parentSelectors: string[], childSelectors: string[]): string[] {
  if (parentSelectors.length === 0) {
    return childSelectors;
  }

  const combinations: string[] = [];

  for (const parentSelector of parentSelectors) {
    for (const childSelector of childSelectors) {
      combinations.push(
        childSelector.includes("&") ? childSelector.replaceAll("&", parentSelector) : `${parentSelector} ${childSelector}`,
      );
    }
  }

  return combinations;
}

function scopeSelectors(selectors: string[], scopeTypeName?: string): string[] {
  if (scopeTypeName === undefined) {
    return selectors;
  }

  return selectors.map((selector) => {
    const trimmed = selector.trim();
    return trimmed.startsWith(scopeTypeName) ? trimmed : `${scopeTypeName} ${trimmed}`;
  });
}

interface FlattenedRule {
  selectors: string[];
  declarations: string[];
}

function parseNestedBlock(source: string, startIndex = 0): { rules: FlattenedRule[]; nextIndex: number } {
  const rules: FlattenedRule[] = [];
  let index = startIndex;
  let tokenStart = startIndex;

  while (index < source.length) {
    const character = source[index];

    if (character === "}") {
      return { rules, nextIndex: index + 1 };
    }

    if (character === "{") {
      const selectorText = source.slice(tokenStart, index).trim();
      const { rules: nestedRules, nextIndex } = parseRuleBlock(source, selectorText, index + 1);
      rules.push(...nestedRules);
      index = nextIndex;
      tokenStart = nextIndex;
      continue;
    }

    index += 1;
  }

  return { rules, nextIndex: index };
}

function parseRuleBlock(source: string, selectorText: string, blockStart: number): { rules: FlattenedRule[]; nextIndex: number } {
  const selectors = splitSelectors(selectorText);
  const declarations: string[] = [];
  const rules: FlattenedRule[] = [];
  let index = blockStart;
  let tokenStart = blockStart;

  while (index < source.length) {
    const character = source[index];

    if (character === "{") {
      const nestedSelector = source.slice(tokenStart, index).trim();
      const { rules: childRules, nextIndex } = parseRuleBlock(source, nestedSelector, index + 1);
      const combinedSelectors = combineSelectors(selectors, childRules.flatMap((rule) => rule.selectors));

      if (childRules.length === 0) {
        const inner = parseNestedBlock(source, index + 1);
        for (const rule of inner.rules) {
          rules.push({
            selectors: combineSelectors(selectors, rule.selectors),
            declarations: rule.declarations,
          });
        }
        index = inner.nextIndex;
        tokenStart = inner.nextIndex;
        continue;
      }

      let childIndex = 0;
      for (const childRule of childRules) {
        rules.push({
          selectors: combineSelectors(selectors, childRule.selectors),
          declarations: childRule.declarations,
        });
        childIndex += 1;
      }

      index = nextIndex;
      tokenStart = nextIndex;
      void combinedSelectors;
      void childIndex;
      continue;
    }

    if (character === ";") {
      const declaration = source.slice(tokenStart, index).trim();

      if (declaration.length > 0) {
        declarations.push(declaration);
      }

      index += 1;
      tokenStart = index;
      continue;
    }

    if (character === "}") {
      const trailing = source.slice(tokenStart, index).trim();

      if (trailing.length > 0) {
        declarations.push(trailing);
      }

      if (declarations.length > 0) {
        rules.unshift({ selectors, declarations });
      }

      return { rules, nextIndex: index + 1 };
    }

    index += 1;
  }

  if (declarations.length > 0) {
    rules.unshift({ selectors, declarations });
  }

  return { rules, nextIndex: index };
}

function flattenNestedCss(source: string, scopeTypeName?: string): string {
  const { rules } = parseNestedBlock(source);

  return rules
    .map((rule) => {
      const selectors = scopeSelectors(rule.selectors, scopeTypeName);
      return `${selectors.join(", ")} { ${rule.declarations.join("; ")}; }`;
    })
    .join("\n");
}

function parseSpacing(rawValue: string): Spacing {
  const parts = rawValue
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => Number(part));

  if (parts.length === 1) {
    return Spacing.all(parts[0]);
  }

  if (parts.length === 2) {
    return Spacing.symmetric(parts[0], parts[1]);
  }

  if (parts.length === 4) {
    return new Spacing(parts[0], parts[1], parts[2], parts[3]);
  }

  throw new Error(`Invalid spacing "${rawValue}"`);
}

function parseBorder(rawValue: string): BorderValue {
  const [style, color] = rawValue.trim().split(/\s+/, 2);

  return {
    style,
    color,
  };
}

function parseValue(property: string, rawValue: string): unknown {
  if (DIMENSION_PROPERTIES.has(property)) {
    const axis = WIDTH_AXIS_PROPERTIES.has(property) ? "width" : "height";
    return parseScalar(rawValue, axis);
  }

  if (property === "padding" || property === "margin") {
    return parseSpacing(rawValue);
  }

  if (property === "border") {
    return parseBorder(rawValue);
  }

  if (property === "display" || property === "visibility" || property === "text-align") {
    return rawValue.trim();
  }

  if (property === "scrollbar-size") {
    const parts = rawValue
      .trim()
      .split(/\s+/)
      .map((part) => Number(part));

    return parts.length === 2 ? parts : [parts[0], parts[0]];
  }

  return rawValue.trim();
}

export function parseTcss(source: string, options: ParseStylesheetOptions): ParsedStylesheet {
  const substitutedSource = substituteVariables(source);
  const flatSource = flattenNestedCss(substitutedSource, options.scopeTypeName);
  const ast = csstree.parse(flatSource, { context: "stylesheet" }) as csstree.CssNode & {
    children: Iterable<csstree.CssNode>;
  };
  const rules: ParsedRule[] = [];
  let order = 0;

  for (const ruleNode of ast.children) {
    if (ruleNode.type !== "Rule") {
      continue;
    }

    const selectors = parseSelectorList(csstree.generate(ruleNode.prelude));
    const declarations: ParsedDeclaration[] = [];

    for (const declarationNode of ruleNode.block.children as Iterable<csstree.CssNode>) {
      if (declarationNode.type !== "Declaration") {
        continue;
      }

      const rawValue = csstree.generate(declarationNode.value);
      declarations.push({
        property: declarationNode.property,
        important: declarationNode.important === true,
        rawValue,
        value: parseValue(declarationNode.property, rawValue),
      });
    }

    rules.push({
      selectors,
      declarations,
      order,
      origin: options.origin,
    });
    order += 1;
  }

  return {
    ast,
    source,
    flatSource,
    rules,
    origin: options.origin,
  };
}

export function generateTcss(ast: csstree.CssNode): string {
  return csstree.generate(ast);
}

function compareCascade(left: CascadeValue, right: CascadeValue): number {
  return (
    Number(left.important) - Number(right.important) ||
    left.originWeight - right.originWeight ||
    compareSelectorSpecificity(left.specificity, right.specificity) ||
    left.order - right.order
  );
}

function resolveValueReferences(rawValue: string, customProperties: Record<string, string>): string {
  return rawValue.replace(/var\((--[A-Za-z0-9_-]+)\)/g, (_match, variableName: string) => customProperties[variableName] ?? "");
}

function applyBoxSpacing(box: Record<string, unknown>, prefix: "padding" | "margin", spacing: Spacing): void {
  box[`${prefix}Top`] = spacing.top;
  box[`${prefix}Right`] = spacing.right;
  box[`${prefix}Bottom`] = spacing.bottom;
  box[`${prefix}Left`] = spacing.left;
}

function rulesToInk(
  rules: ResolvedRuleMap,
  viewport: {
    width: number;
    height: number;
  },
): Pick<ResolvedInkStyles, "box" | "text"> {
  const box: Record<string, unknown> = {};
  const text: Record<string, unknown> = {};

  for (const [property, value] of Object.entries(rules)) {
    if (property === "width" || property === "height" || property === "min-width" || property === "max-width" || property === "min-height" || property === "max-height") {
      const key = property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
      box[key] = scalarToInkValue(value as Scalar, viewport);
      continue;
    }

    if (property === "padding") {
      applyBoxSpacing(box, "padding", value as Spacing);
      continue;
    }

    if (property === "margin") {
      applyBoxSpacing(box, "margin", value as Spacing);
      continue;
    }

    if (property === "border") {
      const border = value as BorderValue;
      box.borderStyle = border.style === "none" ? undefined : border.style;

      if (border.color !== undefined) {
        box.borderColor = border.color;
      }
      continue;
    }

    if (property === "background") {
      box.backgroundColor = value;
      continue;
    }

    if (property === "color") {
      text.color = value;
      continue;
    }

    if (property === "display" && value === "none") {
      box.display = "none";
      continue;
    }

    if (property === "text-align") {
      text.textAlign = value;
    }
  }

  return {
    box,
    text,
  };
}

export function resolveStylesForWidget(
  framework: TextualFramework,
  widget: WidgetNode,
  parentCustomProperties: Record<string, string>,
): ResolvedInkStyles {
  const resolvedProperties = new Map<string, CascadeValue>();
  const customProperties = { ...parentCustomProperties };
  const stylesheets = framework.getActiveStylesheetsFor(widget.typeName, widget.defaultCss);

  // [LAW:single-enforcer] Style resolution always flows through the same cascade
  // pipeline so DEFAULT_CSS, user CSS, and inline styles cannot drift apart.
  for (const stylesheet of stylesheets) {
    for (const rule of stylesheet.rules) {
      const matchingSelectors = rule.selectors.filter((selector) => matchesSelector(framework, widget, selector));

      for (const selector of matchingSelectors) {
        for (const declaration of rule.declarations) {
          const nextValue: CascadeValue = {
            property: declaration.property,
            value: declaration.value,
            rawValue: declaration.rawValue,
            important: declaration.important,
            order: rule.order,
            originWeight: stylesheet.origin === "default" ? 0 : 1,
            specificity: selector.specificity,
          };
          const currentValue = resolvedProperties.get(declaration.property);

          if (currentValue === undefined || compareCascade(currentValue, nextValue) <= 0) {
            resolvedProperties.set(declaration.property, nextValue);
          }
        }
      }
    }
  }

  for (const [property, rawValue] of widget.inlineStyles.entries()) {
    resolvedProperties.set(property, {
      property,
      value: parseValue(property, rawValue),
      rawValue,
      important: true,
      order: Number.MAX_SAFE_INTEGER,
      originWeight: 2,
      specificity: { ids: Number.MAX_SAFE_INTEGER, classes: 0, types: 0 },
    });
  }

  for (const [property, entry] of resolvedProperties.entries()) {
    if (property.startsWith("--")) {
      customProperties[property] = resolveValueReferences(entry.rawValue, customProperties);
    }
  }

  const rules: ResolvedRuleMap = {};

  for (const [property, entry] of resolvedProperties.entries()) {
    if (property.startsWith("--")) {
      continue;
    }

    const resolvedRawValue = resolveValueReferences(entry.rawValue, customProperties);
    rules[property] = parseValue(property, resolvedRawValue);
  }

  return {
    ...rulesToInk(rules, framework.terminalSize),
    rules,
    customProperties,
  };
}
