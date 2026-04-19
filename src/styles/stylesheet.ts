import * as csstree from "css-tree";

import { Spacing } from "../geometry/index.js";
import { normalizeColor } from "./color.js";
import { parseScalar, type Scalar, scalarToInkValue, StyleValueError } from "./scalar.js";
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

export class StylesheetParseError extends Error {}

export interface OffsetValue {
  x: Scalar;
  y: Scalar;
}

export interface OverflowValue {
  x: "auto" | "scroll" | "hidden";
  y: "auto" | "scroll" | "hidden";
}

export interface AlignValue {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "middle" | "bottom";
}

export interface TextStyleValue {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  reverse: boolean;
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
const COLOR_PROPERTIES = new Set([
  "background",
  "color",
  "tint",
  "scrollbar-color",
  "scrollbar-color-hover",
  "scrollbar-color-active",
  "scrollbar-background",
  "scrollbar-background-hover",
  "scrollbar-background-active",
  "link-color",
  "link-background",
  "link-color-hover",
  "link-background-hover",
]);
const BORDER_PROPERTIES = new Set([
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "outline",
  "outline-top",
  "outline-right",
  "outline-bottom",
  "outline-left",
]);
const SPACING_PROPERTIES = new Set(["padding", "margin"]);
const SPACING_EDGE_PROPERTIES = new Map<string, "top" | "right" | "bottom" | "left">([
  ["padding-top", "top"],
  ["padding-right", "right"],
  ["padding-bottom", "bottom"],
  ["padding-left", "left"],
  ["margin-top", "top"],
  ["margin-right", "right"],
  ["margin-bottom", "bottom"],
  ["margin-left", "left"],
]);
const SCALAR_LIST_PROPERTIES = new Map<string, "width" | "height">([
  ["grid-columns", "width"],
  ["grid-rows", "height"],
]);
const KNOWN_PROPERTIES = new Set([
  ...DIMENSION_PROPERTIES,
  ...COLOR_PROPERTIES,
  ...BORDER_PROPERTIES,
  ...SPACING_PROPERTIES,
  ...SPACING_EDGE_PROPERTIES.keys(),
  ...SCALAR_LIST_PROPERTIES.keys(),
  "display",
  "visibility",
  "opacity",
  "box-sizing",
  "border-title-align",
  "border-subtitle-align",
  "text-style",
  "text-align",
  "text-wrap",
  "text-overflow",
  "dock",
  "overflow",
  "align",
  "content-align",
  "offset",
  "offset-x",
  "offset-y",
  "layers",
  "layer",
  "grid-size",
  "grid-gutter",
  "grid-gutter-horizontal",
  "grid-gutter-vertical",
  "row-span",
  "column-span",
  "scrollbar-size",
  "link-style",
  "link-style-hover",
  "transition",
  "hatch",
  "overlay",
  "constrain",
  "layout",
  "scrollbar-gutter",
]);

interface CssToken {
  type: string;
  value: string;
  start: number;
  end: number;
}

interface VariableSource {
  name: string;
  value: string;
  start: number;
  end: number;
}

export class UnresolvedVariableError extends Error {}

const tokenizeCss = csstree as typeof csstree & {
  tokenNames: Record<number, string>;
  tokenize: (source: string, callback: (type: number, start: number, end: number) => void) => void;
};

function tokenizeSource(source: string): CssToken[] {
  const tokens: CssToken[] = [];

  tokenizeCss.tokenize(source, (type, start, end) => {
    tokens.push({
      type: tokenizeCss.tokenNames[type] ?? "unknown-token",
      value: source.slice(start, end),
      start,
      end,
    });
  });

  return tokens;
}

function isWhitespaceToken(token: CssToken | undefined): boolean {
  return token?.type === "whitespace-token" || token?.type === "comment-token";
}

function nextNonWhitespaceToken(tokens: CssToken[], index: number): number {
  let nextIndex = index;

  while (nextIndex < tokens.length && isWhitespaceToken(tokens[nextIndex])) {
    nextIndex += 1;
  }

  return nextIndex;
}

function collectVariableSources(source: string, tokens: CssToken[]): VariableSource[] {
  const variables: VariableSource[] = [];
  let blockDepth = 0;
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token === undefined) {
      break;
    }

    blockDepth += token.value === "{" ? 1 : token.value === "}" ? -1 : 0;

    if (blockDepth !== 0 || token.value !== "$") {
      index += 1;
      continue;
    }

    const nameIndex = nextNonWhitespaceToken(tokens, index + 1);
    const colonIndex = nextNonWhitespaceToken(tokens, nameIndex + 1);
    const nameToken = tokens[nameIndex];
    const colonToken = tokens[colonIndex];

    if (nameToken?.type !== "ident-token" || colonToken?.value !== ":") {
      index += 1;
      continue;
    }

    const valueStartIndex = colonIndex + 1;
    let valueEnd = colonToken.end;
    let declarationEnd = colonToken.end;
    let scanIndex = valueStartIndex;

    while (scanIndex < tokens.length) {
      const scanToken = tokens[scanIndex];

      if (scanToken === undefined) {
        break;
      }

      if (scanToken.value === ";") {
        valueEnd = scanToken.start;
        declarationEnd = scanToken.end;
        break;
      }

      if (scanToken.type === "whitespace-token" && scanToken.value.includes("\n")) {
        const newlineOffset = scanToken.value.indexOf("\n");
        valueEnd = scanToken.start + newlineOffset;
        declarationEnd = valueEnd + 1;
        break;
      }

      valueEnd = scanToken.end;
      declarationEnd = scanToken.end;
      scanIndex += 1;
    }

    variables.push({
      name: nameToken.value,
      value: source.slice(tokens[valueStartIndex]?.start ?? colonToken.end, valueEnd).trim(),
      start: token.start,
      end: declarationEnd,
    });
    index = scanIndex + 1;
  }

  return variables;
}

function removeRanges(source: string, ranges: Array<{ start: number; end: number }>): string {
  let output = "";
  let cursor = 0;

  for (const range of ranges) {
    output += source.slice(cursor, range.start);
    cursor = range.end;
  }

  return output + source.slice(cursor);
}

function extractVariables(source: string): { source: string; variables: Map<string, string> } {
  const variableSources = collectVariableSources(source, tokenizeSource(source));
  const variables = new Map<string, string>();

  for (const variable of variableSources) {
    variables.set(variable.name, variable.value);
  }

  return {
    source: removeRanges(source, variableSources),
    variables,
  };
}

function resolveVariables(variables: Map<string, string>): Map<string, string> {
  const resolved = new Map<string, string>();
  const resolving = new Set<string>();

  const resolve = (name: string): string => {
    const cached = resolved.get(name);

    if (cached !== undefined) {
      return cached;
    }

    const value = variables.get(name);

    if (value === undefined) {
      throw new UnresolvedVariableError(`Unknown variable $${name}`);
    }

    if (resolving.has(name)) {
      throw new UnresolvedVariableError(`Circular variable reference $${name}`);
    }

    resolving.add(name);
    const nextValue = substituteVariableReferences(value, variables, resolve);
    resolving.delete(name);
    resolved.set(name, nextValue);
    return nextValue;
  };

  for (const name of variables.keys()) {
    resolve(name);
  }

  return resolved;
}

function substituteVariableReferences(
  source: string,
  variables: Map<string, string>,
  resolve: (name: string) => string,
): string {
  const tokens = tokenizeSource(source);
  let output = "";
  let cursor = 0;
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token === undefined) {
      break;
    }

    const nameIndex = token.value === "$" ? nextNonWhitespaceToken(tokens, index + 1) : -1;
    const nameToken = nameIndex === -1 ? undefined : tokens[nameIndex];

    if (nameToken?.type !== "ident-token") {
      index += 1;
      continue;
    }

    if (!variables.has(nameToken.value)) {
      throw new UnresolvedVariableError(`Unknown variable $${nameToken.value}`);
    }

    output += source.slice(cursor, token.start);
    output += resolve(nameToken.value);
    cursor = nameToken.end;
    index = nameIndex + 1;
  }

  return output + source.slice(cursor);
}

function substituteVariables(source: string): string {
  // [LAW:single-enforcer] TCSS $ variables are resolved once before css-tree
  // builds the canonical stylesheet AST, so later style stages never re-expand them.
  const { source: sourceWithoutVariables, variables } = extractVariables(source);
  const resolvedVariables = resolveVariables(variables);

  return substituteVariableReferences(sourceWithoutVariables, resolvedVariables, (name) => {
    const value = resolvedVariables.get(name);

    if (value === undefined) {
      throw new UnresolvedVariableError(`Unknown variable $${name}`);
    }

    return value;
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

    if (trimmed.startsWith(scopeTypeName)) {
      return trimmed;
    }

    if (trimmed === "*") {
      return scopeTypeName;
    }

    if (trimmed.startsWith(".") || trimmed.startsWith("#") || trimmed.startsWith(":")) {
      return `${scopeTypeName}${trimmed}`;
    }

    if (trimmed.startsWith("*")) {
      return `${scopeTypeName}${trimmed.slice(1)}`;
    }

    return `${scopeTypeName} ${trimmed}`;
  });
}

interface CssTreeRule {
  prelude: csstree.CssNode;
  block: {
    children: Iterable<csstree.CssNode>;
  };
}

interface FlattenedRule {
  selectors: string[];
  declarations: string[];
}

function selectorStrings(prelude: csstree.CssNode): string[] {
  return splitSelectors(csstree.generate(prelude));
}

function ruleDeclarations(rule: CssTreeRule): string[] {
  const declarations: string[] = [];

  for (const child of rule.block.children) {
    if (child.type === "Declaration") {
      declarations.push(csstree.generate(child));
    }
  }

  return declarations;
}

function nestedRules(rule: CssTreeRule): CssTreeRule[] {
  const rules: CssTreeRule[] = [];

  for (const child of rule.block.children) {
    if (child.type === "Rule") {
      rules.push(child as CssTreeRule);
      continue;
    }

    if (child.type !== "Raw") {
      continue;
    }

    const nestedAst = csstree.parse(child.value, { context: "stylesheet" }) as csstree.CssNode & {
      children: Iterable<csstree.CssNode>;
    };

    for (const nestedNode of nestedAst.children) {
      if (nestedNode.type === "Rule") {
        rules.push(nestedNode as CssTreeRule);
      }
    }
  }

  return rules;
}

function flattenRule(rule: CssTreeRule, parentSelectors: string[]): FlattenedRule[] {
  const selectors = combineSelectors(parentSelectors, selectorStrings(rule.prelude));
  const declarations = ruleDeclarations(rule);
  const flattenedRules: FlattenedRule[] = [];

  if (declarations.length > 0) {
    flattenedRules.push({ selectors, declarations });
  }

  for (const childRule of nestedRules(rule)) {
    flattenedRules.push(...flattenRule(childRule, selectors));
  }

  return flattenedRules;
}

function flattenNestedCss(source: string, scopeTypeName?: string): string {
  const ast = csstree.parse(source, { context: "stylesheet" }) as csstree.CssNode & {
    children: Iterable<csstree.CssNode>;
  };
  const rules: FlattenedRule[] = [];

  // [LAW:one-source-of-truth] css-tree owns selector/declaration parsing; this
  // pass only expands TCSS nesting into the canonical flat stylesheet source.
  for (const node of ast.children) {
    if (node.type === "Rule") {
      rules.push(...flattenRule(node as CssTreeRule, []));
    }
  }

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
    .map((part) => {
      const value = Number(part);

      if (!Number.isFinite(value)) {
        throw new StyleValueError(`Invalid spacing "${rawValue}"`);
      }

      return value;
    });

  if (parts.length === 1) {
    return Spacing.all(parts[0]);
  }

  if (parts.length === 2) {
    return Spacing.symmetric(parts[0], parts[1]);
  }

  if (parts.length === 4) {
    return new Spacing(parts[0], parts[1], parts[2], parts[3]);
  }

  throw new StyleValueError(`Invalid spacing "${rawValue}"`);
}

function parseBorder(rawValue: string): BorderValue {
  const [style, color] = rawValue.trim().split(/\s+/, 2);
  const validStyles = new Set(["solid", "double", "round", "heavy", "thick", "dashed", "tall", "wide", "none", "hidden"]);

  if (style === undefined || !validStyles.has(style)) {
    throw new StyleValueError(`Invalid border "${rawValue}"`);
  }

  const normalizedColor =
    color === undefined || color.startsWith("var(") ? color : normalizeColor(color);

  return {
    style,
    color: normalizedColor,
  };
}

function parseFractional(rawValue: string): number {
  const trimmed = rawValue.trim();
  const percentMatch = trimmed.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))%$/);
  const value = percentMatch === null ? Number(trimmed) : Number(percentMatch[1]) / 100;

  if (!Number.isFinite(value)) {
    throw new StyleValueError(`Invalid fractional value "${rawValue}"`);
  }

  return Math.min(1, Math.max(0, value));
}

function parseOffset(rawValue: string): OffsetValue {
  const parts = rawValue.trim().split(/\s+/).filter(Boolean);

  if (parts.length !== 2) {
    throw new StyleValueError(`Invalid offset "${rawValue}"`);
  }

  return {
    x: parseScalar(parts[0]!, "width"),
    y: parseScalar(parts[1]!, "height"),
  };
}

function parseOverflow(rawValue: string): OverflowValue {
  const values = rawValue.trim().split(/\s+/).filter(Boolean);
  const valid = new Set(["auto", "scroll", "hidden"]);
  const x = values[0];
  const y = values[1] ?? x;

  if (values.length < 1 || values.length > 2 || !valid.has(x!) || !valid.has(y!)) {
    throw new StyleValueError(`Invalid overflow "${rawValue}"`);
  }

  return {
    x: x as OverflowValue["x"],
    y: y as OverflowValue["y"],
  };
}

function parseAlign(rawValue: string): AlignValue {
  const [horizontal = "left", vertical = "top", extra] = rawValue.trim().split(/\s+/);
  const horizontalValues = new Set(["left", "center", "right"]);
  const verticalValues = new Set(["top", "middle", "bottom"]);

  if (extra !== undefined || !horizontalValues.has(horizontal) || !verticalValues.has(vertical)) {
    throw new StyleValueError(`Invalid align "${rawValue}"`);
  }

  return {
    horizontal: horizontal as AlignValue["horizontal"],
    vertical: vertical as AlignValue["vertical"],
  };
}

function parseTextStyle(rawValue: string): TextStyleValue {
  const tokens = rawValue.trim().split(/\s+/).filter(Boolean);
  const textStyle: TextStyleValue = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    reverse: false,
  };

  if (tokens.length === 1 && tokens[0] === "none") {
    return textStyle;
  }

  for (const token of tokens) {
    if (!(token in textStyle)) {
      throw new StyleValueError(`Invalid text-style "${token}"`);
    }

    textStyle[token as keyof TextStyleValue] = true;
  }

  return textStyle;
}

function parseScalarList(rawValue: string, axis: "width" | "height"): Scalar[] {
  const parts = rawValue.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    throw new StyleValueError(`Invalid scalar list "${rawValue}"`);
  }

  return parts.map((part) => parseScalar(part, axis));
}

function parseInteger(rawValue: string, property: string): number {
  const value = Number(rawValue.trim());

  if (!Number.isInteger(value)) {
    throw new StyleValueError(`Invalid ${property} "${rawValue}"`);
  }

  return value;
}

function parseGridSize(rawValue: string): [number, number] {
  const parts = rawValue.trim().split(/\s+/).filter(Boolean);

  if (parts.length < 1 || parts.length > 2) {
    throw new StyleValueError(`Invalid grid-size "${rawValue}"`);
  }

  const columns = parseInteger(parts[0]!, "grid-size");
  const rows = parseInteger(parts[1] ?? parts[0]!, "grid-size");
  return [columns, rows];
}

function parseScrollbarSize(rawValue: string): [number, number] {
  const parts = rawValue
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => parseInteger(part, "scrollbar-size"));

  if (parts.length < 1 || parts.length > 2) {
    throw new StyleValueError(`Invalid scrollbar-size "${rawValue}"`);
  }

  return [parts[0]!, parts[1] ?? parts[0]!];
}

function parseStringEnum<TValue extends string>(property: string, rawValue: string, values: readonly TValue[]): TValue {
  const trimmed = rawValue.trim() as TValue;

  if (!values.includes(trimmed)) {
    throw new StyleValueError(`Invalid ${property} "${rawValue}"`);
  }

  return trimmed;
}

function parseValue(property: string, rawValue: string): unknown {
  if (!property.startsWith("--") && !KNOWN_PROPERTIES.has(property)) {
    throw new StylesheetParseError(`Invalid CSS property "${property}"`);
  }

  if (DIMENSION_PROPERTIES.has(property)) {
    const axis = WIDTH_AXIS_PROPERTIES.has(property) ? "width" : "height";
    return parseScalar(rawValue, axis);
  }

  if (SPACING_PROPERTIES.has(property)) {
    return parseSpacing(rawValue);
  }

  if (SPACING_EDGE_PROPERTIES.has(property)) {
    return parseInteger(rawValue, property);
  }

  if (BORDER_PROPERTIES.has(property)) {
    return parseBorder(rawValue);
  }

  if (COLOR_PROPERTIES.has(property)) {
    const trimmed = rawValue.trim();
    return trimmed.startsWith("var(") ? trimmed : normalizeColor(trimmed);
  }

  if (property === "display") {
    return parseStringEnum(property, rawValue, ["block", "none"] as const);
  }

  if (property === "visibility") {
    return parseStringEnum(property, rawValue, ["visible", "hidden"] as const);
  }

  if (property === "opacity") {
    return parseFractional(rawValue);
  }

  if (property === "text-align") {
    return parseStringEnum(property, rawValue, ["left", "start", "center", "right", "end", "justify"] as const);
  }

  if (property === "text-style" || property === "link-style" || property === "link-style-hover") {
    return parseTextStyle(rawValue);
  }

  if (property === "text-wrap") {
    return parseStringEnum(property, rawValue, ["wrap", "nowrap", "ellipsis"] as const);
  }

  if (property === "text-overflow") {
    return parseStringEnum(property, rawValue, ["ellipsis", "fold"] as const);
  }

  if (property === "dock") {
    return parseStringEnum(property, rawValue, ["top", "bottom", "left", "right"] as const);
  }

  if (property === "overflow") {
    return parseOverflow(rawValue);
  }

  if (property === "align" || property === "content-align") {
    return parseAlign(rawValue);
  }

  if (property === "offset") {
    return parseOffset(rawValue);
  }

  if (property === "offset-x") {
    return parseScalar(rawValue, "width");
  }

  if (property === "offset-y") {
    return parseScalar(rawValue, "height");
  }

  if (property === "grid-size") {
    return parseGridSize(rawValue);
  }

  if (property === "grid-gutter") {
    return parseOffset(rawValue);
  }

  if (property === "grid-gutter-horizontal") {
    return parseScalar(rawValue, "width");
  }

  if (property === "grid-gutter-vertical") {
    return parseScalar(rawValue, "height");
  }

  if (property === "row-span" || property === "column-span") {
    return parseInteger(rawValue, property);
  }

  const scalarListAxis = SCALAR_LIST_PROPERTIES.get(property);

  if (scalarListAxis !== undefined) {
    return parseScalarList(rawValue, scalarListAxis);
  }

  if (property === "scrollbar-size") {
    return parseScrollbarSize(rawValue);
  }

  if (property === "box-sizing") {
    return parseStringEnum(property, rawValue, ["border-box", "content-box"] as const);
  }

  if (property === "border-title-align" || property === "border-subtitle-align") {
    return parseStringEnum(property, rawValue, ["left", "center", "right"] as const);
  }

  if (property === "overlay") {
    return parseStringEnum(property, rawValue, ["screen"] as const);
  }

  if (property === "constrain") {
    return parseStringEnum(property, rawValue, ["x", "y", "both", "none"] as const);
  }

  if (property === "layout") {
    return parseStringEnum(property, rawValue, ["vertical", "horizontal", "grid", "stream"] as const);
  }

  if (property.startsWith("--")) {
    return rawValue.trim();
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
      let value: unknown;

      try {
        value = parseValue(declarationNode.property, rawValue);
      } catch (error) {
        const cause = error as Error;
        throw new StylesheetParseError(`Invalid value for "${declarationNode.property}": ${cause.message}`, {
          cause,
        });
      }

      declarations.push({
        property: declarationNode.property,
        important: declarationNode.important === true,
        rawValue,
        value,
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

function applyBoxEdgeSpacing(
  box: Record<string, unknown>,
  property: string,
  value: number,
): void {
  const [prefix, edge] = property.split("-");
  const key = `${prefix}${edge![0]!.toUpperCase()}${edge!.slice(1)}`;
  box[key] = value;
}

function mapHorizontalAlign(value: AlignValue["horizontal"]): "flex-start" | "center" | "flex-end" {
  return value === "center" ? "center" : value === "right" ? "flex-end" : "flex-start";
}

function mapVerticalAlign(value: AlignValue["vertical"]): "flex-start" | "center" | "flex-end" {
  return value === "middle" ? "center" : value === "bottom" ? "flex-end" : "flex-start";
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

    if (SPACING_EDGE_PROPERTIES.has(property)) {
      applyBoxEdgeSpacing(box, property, value as number);
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
      text.backgroundColor = value;
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

    if (property === "opacity") {
      text.dimColor = (value as number) < 1;
      continue;
    }

    if (property === "text-style" || property === "link-style" || property === "link-style-hover") {
      const textStyle = value as TextStyleValue;
      text.bold = textStyle.bold;
      text.italic = textStyle.italic;
      text.underline = textStyle.underline;
      text.strikethrough = textStyle.strike;
      text.inverse = textStyle.reverse;
      continue;
    }

    if (property === "text-wrap") {
      text.wrap = value === "wrap" ? "wrap" : "truncate-end";
      continue;
    }

    if (property === "text-align") {
      text.textAlign = value;
      continue;
    }

    if (property === "align") {
      const align = value as AlignValue;
      box.justifyContent = mapHorizontalAlign(align.horizontal);
      box.alignItems = mapVerticalAlign(align.vertical);
      continue;
    }

    if (property === "content-align") {
      const align = value as AlignValue;
      box.alignSelf = mapVerticalAlign(align.vertical);
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
  const stylesheets = framework.getActiveStylesheetsFor(widget.typeName);

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
