import * as csstree from "css-tree";
import { readFileSync } from "node:fs";

import { Spacing } from "../geometry/index.js";
import { Color } from "./color.js";
import { PSEUDO_CLASS_NAMES } from "./pseudo-classes.js";
import { axisToPercentUnit, normalizeScalar, parseScalar, Scalar, scalarToInkValue, scalarToRawValue, StyleValueError, Unit } from "./scalar.js";
import type { BorderValue, ResolvedInkStyles, ResolvedRuleMap } from "./resolved-styles.js";
import { compareSelectorSpecificity, matchesSelector, parseSelectorList, type ParsedSelector } from "./selectors.js";
import type { TextualFramework } from "../framework/app-framework.js";
import type { Widget } from "../framework/widget.js";

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
  scopeMode?: "self" | "descendant";
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
export class UnexpectedEnd extends StylesheetParseError {}

export interface SourceLocation {
  row: number;
  column: number;
}

export interface ReferencedBy {
  name: string;
  location: SourceLocation;
  length: number;
  code: string;
}

export class Token {
  readonly read_from: readonly [string, string];
  readonly referenced_by?: ReferencedBy;

  constructor(
    readonly name: string,
    readonly value: string,
    readFrom: readonly [string, string],
    readonly code: string,
    readonly location: SourceLocation,
    referencedBy?: ReferencedBy,
  ) {
    this.read_from = readFrom;
    this.referenced_by = referencedBy;
  }

  get readFrom(): readonly [string, string] {
    return this.read_from;
  }

  withReference(reference: ReferencedBy): Token {
    return new Token(this.name, this.value, this.read_from, this.code, this.location, reference);
  }
}

export class TokenError extends Error {
  constructor(
    message: string,
    readonly start?: SourceLocation,
  ) {
    super(message);
  }
}

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

export type ScrollbarGutterValue = "auto" | "stable";

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
  "overflow-x",
  "overflow-y",
  "align",
  "align-horizontal",
  "align-vertical",
  "content-align",
  "content-align-horizontal",
  "content-align-vertical",
  "offset",
  "offset-x",
  "offset-y",
  "layers",
  "layer",
  "grid-size",
  "grid-size-columns",
  "grid-size-rows",
  "grid-gutter",
  "grid-gutter-horizontal",
  "grid-gutter-vertical",
  "row-span",
  "column-span",
  "scrollbar-size",
  "scrollbar-size-horizontal",
  "scrollbar-size-vertical",
  "link-style",
  "link-style-hover",
  "pointer",
  "transition",
  "hatch",
  "overlay",
  "constrain",
  "layout",
  "scrollbar-gutter",
]);

const POINTER_VALUES = [
  "default",
  "pointer",
  "text",
  "crosshair",
  "help",
  "wait",
  "progress",
  "move",
  "grab",
  "grabbing",
  "cell",
  "vertical-text",
  "alias",
  "copy",
  "no-drop",
  "not-allowed",
  "n-resize",
  "s-resize",
  "e-resize",
  "w-resize",
  "ne-resize",
  "nw-resize",
  "se-resize",
  "sw-resize",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "zoom-in",
  "zoom-out",
] as const;

function bestSuggestion(input: string, candidates: Iterable<string>): string | undefined {
  const normalized = input.trim().toLowerCase().replaceAll("_", "-");
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
  const scored = [...candidates]
    .map((candidate) => ({ candidate, score: distance(normalized, candidate) }))
    .sort((left, right) => left.score - right.score || left.candidate.localeCompare(right.candidate));
  const best = scored[0];

  return best !== undefined && normalized.length > 2 && best.score <= Math.max(2, Math.floor(normalized.length / 3))
    ? best.candidate
    : undefined;
}

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

function indexToLocation(source: string, index: number): SourceLocation {
  const prefix = source.slice(0, index);
  const lines = prefix.split("\n");
  return {
    row: lines.length,
    column: lines[lines.length - 1]!.length + 1,
  };
}

function pushToken(
  tokens: Token[],
  source: string,
  readFrom: readonly [string, string],
  name: string,
  start: number,
  end: number,
): void {
  tokens.push(new Token(name, source.slice(start, end), readFrom, source, indexToLocation(source, start)));
}

function tokenNameForBareValue(value: string): string {
  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:fr|vh|vw|h|w|%)$/.test(value)) {
    return "scalar";
  }

  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s)$/.test(value)) {
    return "duration";
  }

  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    return "number";
  }

  return "token";
}

export function tokenizeTcss(source: string, readFrom: readonly [string, string] = ["<string>", ""]): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  let inDeclarationBlock = false;

  while (index < source.length) {
    const character = source[index]!;
    const next = source[index + 1];

    if (character === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close === -1 ? source.length : close + 2;
      continue;
    }

    if (character === "#" && (index === 0 || /\s/.test(source[index - 1]!))) {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd === -1 ? source.length : lineEnd;
      continue;
    }

    if (/\s/.test(character)) {
      const start = index;
      index += 1;
      while (index < source.length && /\s/.test(source[index]!)) {
        index += 1;
      }
      pushToken(tokens, source, readFrom, "whitespace", start, index);
      continue;
    }

    if (character === "$") {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_-]/.test(source[index]!)) {
        index += 1;
      }
      const nameEnd = index;
      const afterName = source[index];

      if (afterName === ":") {
        index += 1;
        pushToken(tokens, source, readFrom, "variable_name", start, index);
        continue;
      }

      if (nameEnd > start + 1) {
        pushToken(tokens, source, readFrom, "variable_ref", start, nameEnd);
        continue;
      }

      throw new TokenError("invalid variable reference", indexToLocation(source, start));
    }

    if (character === ".") {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_-]/.test(source[index]!)) {
        index += 1;
      }
      pushToken(tokens, source, readFrom, "selector_start_class", start, index);
      continue;
    }

    if (character === "#") {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_-]/.test(source[index]!)) {
        index += 1;
      }
      pushToken(tokens, source, readFrom, "selector_start_id", start, index);
      continue;
    }

    if (character === "*") {
      pushToken(tokens, source, readFrom, "selector_start_universal", index, index + 1);
      index += 1;
      continue;
    }

    if (character === "{") {
      inDeclarationBlock = true;
      pushToken(tokens, source, readFrom, "declaration_set_start", index, index + 1);
      index += 1;
      continue;
    }

    if (character === "}") {
      inDeclarationBlock = false;
      pushToken(tokens, source, readFrom, "declaration_set_end", index, index + 1);
      index += 1;
      continue;
    }

    if (character === ";") {
      pushToken(tokens, source, readFrom, inDeclarationBlock ? "declaration_end" : "variable_value_end", index, index + 1);
      index += 1;
      continue;
    }

    if (character === ":" && !inDeclarationBlock) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_-]/.test(source[index]!)) {
        index += 1;
      }
      const pseudoName = source.slice(start + 1, index);

      if (!PSEUDO_CLASS_NAMES.has(pseudoName)) {
        const suggestion = bestSuggestion(pseudoName, PSEUDO_CLASS_NAMES);
        const suffix = suggestion === undefined ? "" : `; did you mean "${suggestion}"?`;
        throw new TokenError(`unknown pseudo-class '${pseudoName}'${suffix}`, indexToLocation(source, start));
      }

      pushToken(tokens, source, readFrom, "token", start, index);
      continue;
    }

    if (/[A-Za-z0-9_-]/.test(character)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_.%-]/.test(source[index]!)) {
        index += 1;
      }
      const value = source.slice(start, index);
      const nextNonWhitespace = source.slice(index).match(/^\s*:/);
      const name = nextNonWhitespace !== null && inDeclarationBlock ? "declaration_name" : tokenNameForBareValue(value);
      const end = name === "declaration_name" ? index + nextNonWhitespace![0].length : index;

      if (name === "declaration_name") {
        index = end;
      }

      pushToken(tokens, source, readFrom, name, start, index);
      continue;
    }

    if (character === "@" && tokens.some((token) => token.name === "variable_name")) {
      throw new TokenError("invalid variable value", indexToLocation(source, index));
    }

    pushToken(tokens, source, readFrom, "token", index, index + 1);
    index += 1;
  }

  return tokens;
}

export const tokenize_tcss = tokenizeTcss;

export function substituteReferences(tokens: readonly Token[]): Token[] {
  const definitions = new Map<string, Token[]>();
  const output: Token[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index]!;

    if (token.name !== "variable_name") {
      output.push(token);
      index += 1;
      continue;
    }

    const variableName = token.value.slice(1, -1);
    const valueTokens: Token[] = [];
    index += 1;

    while (index < tokens.length) {
      const valueToken = tokens[index]!;

      if (valueToken.name === "variable_value_end" || valueToken.name === "declaration_set_start") {
        index += valueToken.name === "variable_value_end" ? 1 : 0;
        break;
      }

      valueTokens.push(valueToken);
      index += 1;
    }

    definitions.set(
      variableName,
      valueTokens.filter((valueToken, valueIndex) => valueIndex > 0 || valueToken.name !== "whitespace"),
    );
  }

  const expand = (token: Token, reference: ReferencedBy, seen: ReadonlySet<string>): Token[] => {
    const variableName = token.value.slice(1);
    const definition = definitions.get(variableName);

    if (definition === undefined) {
      throw new UnresolvedVariableError(`Unknown variable $${variableName}`);
    }

    if (seen.has(variableName)) {
      throw new UnresolvedVariableError(`Circular variable reference $${variableName}`);
    }

    const nextSeen = new Set(seen).add(variableName);
    return definition.flatMap((definedToken) =>
      definedToken.name === "variable_ref"
        ? expand(definedToken, reference, nextSeen)
        : [definedToken.withReference(reference)],
    );
  };

  return output.flatMap((token) => {
    if (token.name !== "variable_ref") {
      return [token];
    }

    const reference: ReferencedBy = {
      name: token.value,
      location: token.location,
      length: token.value.length,
      code: token.code,
    };
    return expand(token, reference, new Set());
  });
}

export const substitute_references = substituteReferences;

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

function sourceLocationFromIndex(source: string, index: number): SourceLocation {
  const prefix = source.slice(0, index);
  const lines = prefix.split("\n");
  return {
    row: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
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

function scopeSelectors(
  selectors: string[],
  scopeTypeName?: string,
  scopeMode: "self" | "descendant" = "self",
): string[] {
  if (scopeTypeName === undefined) {
    return selectors;
  }

  return selectors.map((selector) => {
    const trimmed = selector.trim();
    const firstSelector = parseSelectorList(trimmed)[0]?.segments[0]?.selectors.find(
      (candidate) => candidate.type !== "universal" && candidate.type !== "pseudo",
    );

    if (firstSelector?.type === "type" && firstSelector.name === scopeTypeName) {
      return trimmed;
    }

    if (scopeMode === "descendant") {
      return `${scopeTypeName} ${trimmed}`.trim();
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

interface FlattenedRule {
  selectors: string[];
  declarations: string[];
}

interface SourceRule {
  selectorText: string;
  body: string;
}

function flattenNestedCss(
  source: string,
  scopeTypeName?: string,
  scopeMode: "self" | "descendant" = "self",
): string {
  const balance = [...source].reduce((depth, character) => depth + (character === "{" ? 1 : character === "}" ? -1 : 0), 0);

  if (balance !== 0) {
    throw new StylesheetParseError("Unclosed CSS block");
  }

  const rules = flattenSourceRules(source, []);

  // [LAW:one-source-of-truth] This pass owns TCSS nesting expansion once; the
  // resulting flat source is the only stylesheet shape the cascade consumes.
  return rules
    .map((rule) => {
      const selectors = scopeSelectors(rule.selectors, scopeTypeName, scopeMode).map(normalizeSelectorText);
      return `${selectors.join(", ")} { ${rule.declarations.join("; ")}; }`;
    })
    .join("\n");
}

function flattenSourceRules(source: string, parentSelectors: string[]): FlattenedRule[] {
  const flattenedRules: FlattenedRule[] = [];

  for (const rule of readSourceRules(source)) {
    const selectors = combineSelectors(parentSelectors, splitSelectors(rule.selectorText));
    const declarations = readTopLevelDeclarations(rule.body);

    if (declarations.length > 0) {
      flattenedRules.push({ selectors, declarations });
    }

    flattenedRules.push(...flattenSourceRules(rule.body, selectors));
  }

  return flattenedRules;
}

function readSourceRules(source: string): SourceRule[] {
  const rules: SourceRule[] = [];
  let index = 0;

  while (index < source.length) {
    const openBrace = findNextTopLevelBrace(source, index);

    if (openBrace === -1) {
      break;
    }

    const selectorStart = findSelectorStart(source, openBrace);
    const selectorText = source.slice(selectorStart, openBrace).trim();
    const closeBrace = findMatchingBrace(source, openBrace);

    if (selectorText === "&" || selectorText === ">" || selectorText === "{") {
      throw new TokenError(`Invalid nested selector "${selectorText}"`, sourceLocationFromIndex(source, selectorStart));
    }

    if (selectorText.length > 0) {
      rules.push({
        selectorText,
        body: source.slice(openBrace + 1, closeBrace),
      });
    }

    index = closeBrace + 1;
  }

  return rules;
}

function readTopLevelDeclarations(body: string): string[] {
  const declarations: string[] = [];
  let cursor = 0;
  let index = 0;

  while (index < body.length) {
    const character = body[index];

    if (character === "{") {
      cursor = findMatchingBrace(body, index) + 1;
      index = cursor;
      continue;
    }

    if (character === ";") {
      const declaration = body.slice(cursor, index).trim();

      if (isDeclarationText(declaration)) {
        declarations.push(normalizeDeclarationText(declaration));
      }

      cursor = index + 1;
    }

    index += 1;
  }

  const trailingDeclaration = body.slice(cursor).trim();

  if (isDeclarationText(trailingDeclaration)) {
    declarations.push(normalizeDeclarationText(trailingDeclaration));
  }

  return declarations;
}

function normalizeDeclarationText(declaration: string): string {
  return csstree.generate(csstree.parse(declaration, { context: "declaration" }));
}

function normalizeSelectorText(selector: string): string {
  return csstree.generate(csstree.parse(selector, { context: "selector" }));
}

function isDeclarationText(text: string): boolean {
  const colonIndex = text.indexOf(":");

  return colonIndex > 0 && !text.slice(0, colonIndex).includes("{") && !text.slice(0, colonIndex).includes("}");
}

function skipWhitespace(source: string, index: number): number {
  let nextIndex = index;

  while (nextIndex < source.length && /\s/.test(source[nextIndex]!)) {
    nextIndex += 1;
  }

  return nextIndex;
}

function findNextTopLevelBrace(source: string, start: number): number {
  let index = start;

  while (index < source.length) {
    if (source[index] === "{") {
      return index;
    }

    index += 1;
  }

  return -1;
}

function findSelectorStart(source: string, openBrace: number): number {
  let index = openBrace - 1;

  while (index >= 0) {
    const character = source[index];

    if (character === ";" || character === "}") {
      return skipWhitespace(source, index + 1);
    }

    index -= 1;
  }

  return skipWhitespace(source, 0);
}

function findMatchingBrace(source: string, openBrace: number): number {
  let depth = 0;
  let index = openBrace;

  while (index < source.length) {
    const character = source[index];
    depth += character === "{" ? 1 : character === "}" ? -1 : 0;

    if (depth === 0) {
      return index;
    }

    index += 1;
  }

  throw new UnexpectedEnd("Unclosed CSS block");
}

export function spacing_invalid_value_help_text(property = "padding"): string {
  return `Expected ${property} values like "1", "1 2", "1 2 3", or "1 2 3 4".`;
}

export function scalar_help_text(property = "width"): string {
  return `Expected ${property} to be a scalar such as 10, 50%, or 1fr.`;
}

export function color_property_help_text(property = "color"): string {
  return `Expected ${property} to be a named color, hex color, rgb()/rgba(), or auto.`;
}

export function align_help_text(property = "align"): string {
  return `Expected ${property} values like "left top", "center middle", or "right bottom".`;
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
    color === undefined || color.startsWith("var(") ? color : Color.parse(color);

  return {
    style: style === "none" || style === "hidden" ? "" : style,
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

  if (tokens.includes("none")) {
    throw new StyleValueError(`Invalid text-style "${rawValue}"`);
  }

  let negating = false;

  for (const token of tokens) {
    if (token === "not") {
      negating = true;
      continue;
    }

    if (!(token in textStyle)) {
      throw new StyleValueError(`Invalid text-style "${token}"`);
    }

    textStyle[token as keyof TextStyleValue] = !negating;
    negating = false;
  }

  if (negating) {
    throw new StyleValueError(`Invalid text-style "${rawValue}"`);
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

export interface TransitionValue {
  property: string;
  duration: number;
  easing: string;
  delay: number;
}

const EASING_NAMES = new Set([
  "linear",
  "in_sine",
  "out_sine",
  "in_out_sine",
  "in_quad",
  "out_quad",
  "in_out_quad",
  "in_cubic",
  "out_cubic",
  "in_out_cubic",
  "in_out_cubic",
  "in_quart",
  "out_quart",
  "in_out_quart",
  "in_quint",
  "out_quint",
  "in_out_quint",
  "in_expo",
  "out_expo",
  "in_out_expo",
  "in_circ",
  "out_circ",
  "in_out_circ",
  "in_back",
  "out_back",
  "in_out_back",
  "in_bounce",
  "out_bounce",
  "in_out_bounce",
  "in_elastic",
  "out_elastic",
  "in_out_elastic",
]);

function parseDurationSeconds(rawValue: string): number {
  const trimmed = rawValue.trim();
  const match = trimmed.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(ms|s)?$/);

  if (match === null) {
    throw new StyleValueError(`Invalid duration "${rawValue}"`);
  }

  const value = Number(match[1]);
  return match[2] === "ms" ? value / 1000 : value;
}

function parseTransition(rawValue: string): TransitionValue[] {
  const parts = rawValue.trim().split(/\s*,\s*/).filter(Boolean);

  if (parts.length === 0) {
    throw new StyleValueError(`Invalid transition "${rawValue}"`);
  }

  return parts.map((part) => {
    const [property, duration, easing = "linear", delay = "0", extra] = part.split(/\s+/);

    if (property === undefined || duration === undefined || extra !== undefined) {
      throw new StyleValueError(`Invalid transition "${rawValue}"`);
    }

    if (!EASING_NAMES.has(easing)) {
      throw new StyleValueError(`Invalid transition easing "${easing}"`);
    }

    return {
      property,
      duration: parseDurationSeconds(duration),
      easing,
      delay: parseDurationSeconds(delay),
    };
  });
}

function propertySuggestionMessage(property: string): string {
  const normalized = property.replaceAll("_", "-");
  const suggestion = bestSuggestion(normalized, KNOWN_PROPERTIES);
  const suffix = suggestion === undefined ? "" : `. Did you mean "${suggestion}"?`;
  return `Invalid CSS property "${normalized}"${suffix}`;
}

function parseValue(property: string, rawValue: string): unknown {
  if (!property.startsWith("--") && !KNOWN_PROPERTIES.has(property)) {
    throw new StylesheetParseError(propertySuggestionMessage(property));
  }

  if (rawValue.trim() === "initial") {
    return "initial";
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
    return trimmed.startsWith("var(") ? trimmed : Color.parse(trimmed);
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

  if (property === "pointer") {
    return parseStringEnum(property, rawValue, POINTER_VALUES);
  }

  if (property === "dock") {
    return parseStringEnum(property, rawValue, ["top", "bottom", "left", "right"] as const);
  }

  if (property === "overflow") {
    return parseOverflow(rawValue);
  }

  if (property === "overflow-x" || property === "overflow-y") {
    return parseStringEnum(property, rawValue, ["auto", "scroll", "hidden"] as const);
  }

  if (property === "align" || property === "content-align") {
    return parseAlign(rawValue);
  }

  if (property === "align-horizontal" || property === "content-align-horizontal") {
    return parseStringEnum(property, rawValue, ["left", "center", "right"] as const);
  }

  if (property === "align-vertical" || property === "content-align-vertical") {
    return parseStringEnum(property, rawValue, ["top", "middle", "bottom"] as const);
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

  if (property === "grid-size-columns" || property === "grid-size-rows") {
    return parseInteger(rawValue, property);
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

  if (property === "scrollbar-size-horizontal" || property === "scrollbar-size-vertical") {
    return parseInteger(rawValue, property);
  }

  if (property === "scrollbar-gutter") {
    // [LAW:single-enforcer] Scrollbar gutter grammar is enforced at the TCSS
    // value boundary so layout infrastructure consumes one canonical enum.
    return parseStringEnum(property, rawValue, ["auto", "stable"] as const);
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

  if (property === "transition") {
    return parseTransition(rawValue);
  }

  if (property.startsWith("--")) {
    return rawValue.trim();
  }

  return rawValue.trim();
}

export type StyleAssignmentValue = string | number | Scalar | Color | readonly Scalar[];

export function normalizeStyleAssignment(property: string, value: StyleAssignmentValue): string {
  if (DIMENSION_PROPERTIES.has(property)) {
    const axis = WIDTH_AXIS_PROPERTIES.has(property) ? "width" : "height";
    return scalarToRawValue(normalizeScalar(value as string | number | Scalar, axis));
  }

  if (property === "offset-x" || property === "grid-gutter-horizontal") {
    return scalarToRawValue(normalizeScalar(value as string | number | Scalar, "width"));
  }

  if (property === "offset-y" || property === "grid-gutter-vertical") {
    return scalarToRawValue(normalizeScalar(value as string | number | Scalar, "height"));
  }

  const scalarListAxis = SCALAR_LIST_PROPERTIES.get(property);

  if (scalarListAxis !== undefined) {
    const values = Array.isArray(value) ? value : String(value).trim().split(/\s+/).map((part) => parseScalar(part, scalarListAxis));
    return values
      .map((part) => {
        const scalar = normalizeScalar(part, scalarListAxis);
        return scalarToRawValue(
          scalar.unit === Unit.FRACTION
            ? scalar.copyWith({ percentUnit: axisToPercentUnit(scalarListAxis) })
            : scalar,
        );
      })
      .join(" ");
  }

  if (COLOR_PROPERTIES.has(property) && value instanceof Color) {
    return value.css;
  }

  if (typeof value === "string" || typeof value === "number") {
    return `${value}`;
  }

  throw new StyleValueError(`Invalid style value for "${property}"`);
}

export function parseTcss(source: string, options: ParseStylesheetOptions): ParsedStylesheet {
  const substitutedSource = substituteVariables(source);
  const flatSource = flattenNestedCss(substitutedSource, options.scopeTypeName, options.scopeMode);
  const ast = csstree.parse(flatSource, { context: "stylesheet" }) as csstree.CssNode & {
    children: Iterable<csstree.CssNode>;
  };
  const rules: ParsedRule[] = [];
  let order = 0;

  for (const ruleNode of ast.children) {
    if (ruleNode.type !== "Rule") {
      continue;
    }

    let selectors: ParsedSelector[];

    try {
      selectors = parseSelectorList(csstree.generate(ruleNode.prelude));
    } catch (error) {
      const cause = error as Error;
      throw new StylesheetParseError(`Invalid selector "${csstree.generate(ruleNode.prelude)}": ${cause.message}`, {
        cause: error as Error,
      });
    }
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
        if (cause instanceof StylesheetParseError) {
          throw cause;
        }
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

export interface StylesheetSource {
  path: string | null;
  source: string;
  origin: StylesheetOrigin;
}

export class Stylesheet {
  readonly sources: StylesheetSource[] = [];
  rules: ParsedRule[] = [];
  parsed: ParsedStylesheet[] = [];
  errors: Error[] = [];

  addSource(source: string, options: ParseStylesheetOptions & { path?: string | null }): void {
    this.sources.push({
      path: options.path ?? null,
      source,
      origin: options.origin,
    });
  }

  parse(): void {
    const parsed = this.sources.map((source) =>
      parseTcss(source.source, {
        origin: source.origin,
      }),
    );
    // [LAW:dataflow-not-control-flow] Reparse computes the complete next
    // stylesheet snapshot first; storage is replaced only by that value.
    this.parsed = parsed;
    this.rules = parsed.flatMap((stylesheet) => stylesheet.rules);
    this.errors = [];
  }

  reparse(): boolean {
    try {
      this.parse();
      return true;
    } catch (error) {
      this.errors = [error as Error];
      return false;
    }
  }

  read(path: string, options: ParseStylesheetOptions = { origin: "user" }): void {
    this.addSource(readFileSync(path, "utf8"), { ...options, path });
  }

  static read(path: string, options: ParseStylesheetOptions = { origin: "user" }): Stylesheet {
    const stylesheet = new Stylesheet();
    stylesheet.read(path, options);
    return stylesheet;
  }
}

function expandedDeclarationEntries(declaration: ParsedDeclaration): ParsedDeclaration[] {
  const initialEntry = (property: string): ParsedDeclaration => ({
    ...declaration,
    property,
    rawValue: "initial",
    value: "initial",
  });

  if (declaration.value === "initial") {
    if (declaration.property === "border" || declaration.property === "outline") {
      return ["top", "right", "bottom", "left"].map((edge) => initialEntry(`${declaration.property}-${edge}`));
    }

    if (declaration.property === "padding" || declaration.property === "margin") {
      return ["top", "right", "bottom", "left"].map((edge) => initialEntry(`${declaration.property}-${edge}`));
    }

    if (declaration.property === "align" || declaration.property === "content-align") {
      return [initialEntry(`${declaration.property}-horizontal`), initialEntry(`${declaration.property}-vertical`)];
    }

    if (declaration.property === "offset") {
      return [initialEntry("offset-x"), initialEntry("offset-y")];
    }

    if (declaration.property === "overflow") {
      return [initialEntry("overflow-x"), initialEntry("overflow-y")];
    }

    if (declaration.property === "scrollbar-size") {
      return [initialEntry("scrollbar-size-horizontal"), initialEntry("scrollbar-size-vertical")];
    }

    if (declaration.property === "grid-size") {
      return [initialEntry("grid-size-columns"), initialEntry("grid-size-rows")];
    }

    if (declaration.property === "grid-gutter") {
      return [initialEntry("grid-gutter-horizontal"), initialEntry("grid-gutter-vertical")];
    }
  }

  if (declaration.property === "border" || declaration.property === "outline") {
    return ["top", "right", "bottom", "left"].map((edge) => ({
      ...declaration,
      property: `${declaration.property}-${edge}`,
    }));
  }

  if (declaration.property === "padding" || declaration.property === "margin") {
    const spacing = declaration.value as Spacing;
    const values = {
      top: spacing.top,
      right: spacing.right,
      bottom: spacing.bottom,
      left: spacing.left,
    };

    return Object.entries(values).map(([edge, value]) => ({
      ...declaration,
      property: `${declaration.property}-${edge}`,
      rawValue: String(value),
      value,
    }));
  }

  if (declaration.property === "align" || declaration.property === "content-align") {
    const align = declaration.value as AlignValue;

    return [
      {
        ...declaration,
        property: `${declaration.property}-horizontal`,
        rawValue: align.horizontal,
        value: align.horizontal,
      },
      {
        ...declaration,
        property: `${declaration.property}-vertical`,
        rawValue: align.vertical,
        value: align.vertical,
      },
    ];
  }

  if (declaration.property === "offset") {
    const offset = declaration.value as OffsetValue;

    return [
      {
        ...declaration,
        property: "offset-x",
        rawValue: scalarToRawValue(offset.x),
        value: offset.x,
      },
      {
        ...declaration,
        property: "offset-y",
        rawValue: scalarToRawValue(offset.y),
        value: offset.y,
      },
    ];
  }

  if (declaration.property === "overflow") {
    const overflow = declaration.value as OverflowValue;

    return [
      { ...declaration, property: "overflow-x", rawValue: overflow.x, value: overflow.x },
      { ...declaration, property: "overflow-y", rawValue: overflow.y, value: overflow.y },
    ];
  }

  if (declaration.property === "scrollbar-size") {
    const [horizontal, vertical] = declaration.value as [number, number];

    return [
      { ...declaration, property: "scrollbar-size-horizontal", rawValue: String(horizontal), value: horizontal },
      { ...declaration, property: "scrollbar-size-vertical", rawValue: String(vertical), value: vertical },
    ];
  }

  if (declaration.property === "grid-size") {
    const [columns, rows] = declaration.value as [number, number];

    return [
      { ...declaration, property: "grid-size-columns", rawValue: String(columns), value: columns },
      { ...declaration, property: "grid-size-rows", rawValue: String(rows), value: rows },
    ];
  }

  if (declaration.property === "grid-gutter") {
    const gutter = declaration.value as OffsetValue;

    return [
      { ...declaration, property: "grid-gutter-horizontal", rawValue: scalarToRawValue(gutter.x), value: gutter.x },
      { ...declaration, property: "grid-gutter-vertical", rawValue: scalarToRawValue(gutter.y), value: gutter.y },
    ];
  }

  return [declaration];
}

function compareCascade(left: CascadeValue, right: CascadeValue): number {
  return (
    left.originWeight - right.originWeight ||
    Number(left.important) - Number(right.important) ||
    compareSelectorSpecificity(left.specificity, right.specificity) ||
    left.order - right.order
  );
}

function resolveValueReferences(rawValue: string, customProperties: Record<string, string>): string {
  return rawValue.replace(/var\((--[A-Za-z0-9_-]+)\)/g, (_match, variableName: string) => customProperties[variableName] ?? "");
}

const BUILT_IN_INITIAL_VALUES: Record<string, string> = {
  background: "rgba(0,0,0,0)",
  color: "white",
  display: "block",
  visibility: "visible",
  opacity: "1",
  "text-style": "none",
  "link-style": "none",
  "link-style-hover": "none",
  "text-wrap": "wrap",
  "text-align": "left",
  pointer: "default",
  "overflow-x": "auto",
  "overflow-y": "auto",
  "align-horizontal": "left",
  "align-vertical": "top",
  "content-align-horizontal": "left",
  "content-align-vertical": "top",
  "offset-x": "0",
  "offset-y": "0",
  "scrollbar-size-horizontal": "1",
  "scrollbar-size-vertical": "1",
  "scrollbar-gutter": "auto",
  "grid-size-columns": "1",
  "grid-size-rows": "1",
  "grid-gutter-horizontal": "0",
  "grid-gutter-vertical": "0",
  "border-top": "none",
  "border-right": "none",
  "border-bottom": "none",
  "border-left": "none",
  "outline-top": "none",
  "outline-right": "none",
  "outline-bottom": "none",
  "outline-left": "none",
  "padding-top": "0",
  "padding-right": "0",
  "padding-bottom": "0",
  "padding-left": "0",
  "margin-top": "0",
  "margin-right": "0",
  "margin-bottom": "0",
  "margin-left": "0",
};

function builtInInitialRawValue(property: string): string | undefined {
  if (property.startsWith("--")) {
    return undefined;
  }

  return BUILT_IN_INITIAL_VALUES[property];
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

export function colorToInkValue(value: Color | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Color) {
    return value.alpha === 1 ? value.hex6.toLowerCase() : value.css;
  }

  return value;
}

function rulesToInk(
  rules: ResolvedRuleMap,
  viewport: {
    width: number;
    height: number;
  },
  componentClasses: string[] = [],
): Pick<ResolvedInkStyles, "box" | "text" | "style" | "components"> {
  const box: Record<string, unknown> = {};
  const text: Record<string, unknown> = {};
  const borderTop = rules["border-top"] as BorderValue | undefined;
  const borderRight = rules["border-right"] as BorderValue | undefined;
  const borderBottom = rules["border-bottom"] as BorderValue | undefined;
  const borderLeft = rules["border-left"] as BorderValue | undefined;
  const border = borderTop ?? borderRight ?? borderBottom ?? borderLeft;
  const alignHorizontal = rules["align-horizontal"] as AlignValue["horizontal"] | undefined;
  const alignVertical = rules["align-vertical"] as AlignValue["vertical"] | undefined;
  const contentAlignVertical = rules["content-align-vertical"] as AlignValue["vertical"] | undefined;

  if (border !== undefined) {
    box.borderStyle = border.style === "" ? undefined : border.style;

    if (border.color !== undefined) {
      box.borderColor = colorToInkValue(border.color);
    }
  }

  if (alignHorizontal !== undefined) {
    box.justifyContent = mapHorizontalAlign(alignHorizontal);
  }

  if (alignVertical !== undefined) {
    box.alignItems = mapVerticalAlign(alignVertical);
  }

  if (contentAlignVertical !== undefined) {
    box.alignSelf = mapVerticalAlign(contentAlignVertical);
  }

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

    if (property === "background") {
      const color = colorToInkValue(value as Color | string);
      box.backgroundColor = color;
      text.backgroundColor = color;
      continue;
    }

    if (property === "color") {
      text.color = colorToInkValue(value as Color | string);
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

    if (property === "align" || property === "content-align") {
      continue;
    }
  }

  return {
    box,
    text,
    // [LAW:one-source-of-truth] Rich/content style data is derived from the
    // same resolved rule map that feeds Ink props; no component owns a fork.
    style: { ...text },
    components: Object.fromEntries(componentClasses.map((className) => [className, { ...rules }])),
  };
}

export function resolveStylesForWidget(
  framework: TextualFramework,
  widget: Widget,
  parentCustomProperties: Record<string, string>,
  inheritedTextStyle?: unknown,
): ResolvedInkStyles {
  const candidatesByProperty = new Map<string, CascadeValue[]>();
  const customProperties = { ...parentCustomProperties };
  const stylesheets = framework.getActiveStylesheetsFor(widget.typeName);
  const defaultStylesheets = framework.getWidgetTypeMetadata(widget.typeName).defaultStylesheets;
  let cascadeOrder = 0;

  const addCandidate = (candidate: CascadeValue): void => {
    const candidates = candidatesByProperty.get(candidate.property) ?? [];
    candidates.push(candidate);
    candidatesByProperty.set(candidate.property, candidates);
  };

  // [LAW:single-enforcer] Style resolution always flows through the same cascade
  // pipeline so DEFAULT_CSS, user CSS, and inline styles cannot drift apart.
  for (const stylesheet of stylesheets) {
    for (const rule of stylesheet.rules) {
      const matchingSelectors = rule.selectors.filter((selector) => matchesSelector(framework, widget, selector));

      for (const selector of matchingSelectors) {
        for (const declaration of rule.declarations) {
          for (const expandedDeclaration of expandedDeclarationEntries(declaration)) {
            addCandidate({
              property: expandedDeclaration.property,
              value: expandedDeclaration.value,
              rawValue: expandedDeclaration.rawValue,
              important: expandedDeclaration.important,
              order: cascadeOrder,
              originWeight: stylesheet.origin === "default" ? 0 : 1,
              specificity: selector.specificity,
            });
            cascadeOrder += 1;
          }
        }
      }
    }
  }

  for (const [property, rawValue] of widget.styles.entries()) {
    const inlineDeclaration: ParsedDeclaration = {
      property,
      value: parseValue(property, rawValue),
      rawValue,
      important: true,
    };

    for (const expandedDeclaration of expandedDeclarationEntries(inlineDeclaration)) {
      addCandidate({
        property: expandedDeclaration.property,
        value: expandedDeclaration.value,
        rawValue: expandedDeclaration.rawValue,
        important: true,
        order: Number.MAX_SAFE_INTEGER,
        originWeight: 2,
        specificity: { ids: Number.MAX_SAFE_INTEGER, classes: 0, types: 0 },
      });
    }
  }

  const resolvedProperties = new Map<string, CascadeValue>();

  for (const [property, candidates] of candidatesByProperty.entries()) {
    const sortedCandidates = [...candidates].sort(compareCascade);
    const winner = sortedCandidates[sortedCandidates.length - 1];

    if (winner === undefined) {
      continue;
    }

    if (winner.rawValue.trim() !== "initial") {
      resolvedProperties.set(property, winner);
      continue;
    }

    const defaultFallback = defaultStylesheets
      .flatMap((stylesheet) =>
        stylesheet.rules.flatMap((rule) =>
          rule.selectors.some((selector) => matchesSelector(framework, widget, selector))
            ? rule.declarations
                .flatMap((declaration) => expandedDeclarationEntries(declaration))
                .filter((candidate) => candidate.property === property && candidate.rawValue.trim() !== "initial")
            : [],
        ),
      )
      .at(-1);
    const fallbackRawValue = winner.originWeight > 0 ? defaultFallback?.rawValue : undefined;
    const builtInRawValue = fallbackRawValue ?? builtInInitialRawValue(property);

    if (builtInRawValue !== undefined) {
      resolvedProperties.set(property, {
        ...winner,
        rawValue: builtInRawValue,
        value: parseValue(property, builtInRawValue),
        important: false,
        originWeight: -1,
      });
    }
  }

  const resolvingCustomProperties = new Set<string>();

  const resolveCustomProperty = (property: string): string => {
    const inheritedValue = customProperties[property];
    const entry = resolvedProperties.get(property);

    if (entry === undefined) {
      return inheritedValue ?? "";
    }

    if (resolvingCustomProperties.has(property)) {
      throw new UnresolvedVariableError(`Circular custom property reference ${property}`);
    }

    resolvingCustomProperties.add(property);
    const resolved = entry.rawValue.replace(/var\((--[A-Za-z0-9_-]+)\)/g, (_match, variableName: string) =>
      resolveCustomProperty(variableName),
    );
    resolvingCustomProperties.delete(property);
    customProperties[property] = resolved;
    return resolved;
  };

  for (const property of resolvedProperties.keys()) {
    if (property.startsWith("--")) {
      resolveCustomProperty(property);
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

  resolveAutomaticColorRules(rules);
  deriveCompoundRules(rules);
  if (rules["text-style"] === undefined && inheritedTextStyle !== undefined) {
    rules["text-style"] = inheritedTextStyle;
  }

  return {
    ...rulesToInk(rules, framework.terminalSize, framework.getWidgetTypeMetadata(widget.typeName).componentClasses),
    rules,
    customProperties,
  };
}

function resolveAutomaticColorRules(rules: ResolvedRuleMap): void {
  const background = rules["background"] instanceof Color ? rules["background"] : Color.parse("transparent");

  // [LAW:dataflow-not-control-flow] Color auto-resolution is a deterministic
  // pass over all resolved rules; non-auto colors flow through unchanged.
  for (const [property, value] of Object.entries(rules)) {
    const resolvedValue =
      value instanceof Color && value.isAutomatic && (property === "color" || property === "tint")
        ? background.add(value)
        : value;
    rules[property] = resolvedValue;
  }
}

function deriveCompoundRules(rules: ResolvedRuleMap): void {
  const padding = spacingFromEdges(rules, "padding");
  const margin = spacingFromEdges(rules, "margin");
  const align = alignFromLonghands(rules, "align");
  const contentAlign = alignFromLonghands(rules, "content-align");
  const offset = offsetFromLonghands(rules);
  const overflow = overflowFromLonghands(rules);
  const scrollbarSize = pairFromLonghands(rules, "scrollbar-size-horizontal", "scrollbar-size-vertical");
  const gridSize = pairFromLonghands(rules, "grid-size-columns", "grid-size-rows");
  const gridGutter = gridGutterFromLonghands(rules);
  const border = borderFromEdges(rules, "border");
  const outline = borderFromEdges(rules, "outline");

  // [LAW:one-source-of-truth] Compound rules exposed to consumers are derived
  // from the canonical longhand cascade result, never resolved independently.
  Object.assign(rules, {
    ...(padding === undefined ? {} : { padding }),
    ...(margin === undefined ? {} : { margin }),
    ...(align === undefined ? {} : { align }),
    ...(contentAlign === undefined ? {} : { "content-align": contentAlign }),
    ...(offset === undefined ? {} : { offset }),
    ...(overflow === undefined ? {} : { overflow }),
    ...(scrollbarSize === undefined ? {} : { "scrollbar-size": scrollbarSize }),
    ...(gridSize === undefined ? {} : { "grid-size": gridSize }),
    ...(gridGutter === undefined ? {} : { "grid-gutter": gridGutter }),
    ...(border === undefined ? {} : { border }),
    ...(outline === undefined ? {} : { outline }),
  });
}

function spacingFromEdges(rules: ResolvedRuleMap, prefix: "padding" | "margin"): Spacing | undefined {
  const top = rules[`${prefix}-top`];
  const right = rules[`${prefix}-right`];
  const bottom = rules[`${prefix}-bottom`];
  const left = rules[`${prefix}-left`];

  return [top, right, bottom, left].every((value) => typeof value === "number")
    ? new Spacing(top as number, right as number, bottom as number, left as number)
    : undefined;
}

function alignFromLonghands(rules: ResolvedRuleMap, prefix: "align" | "content-align"): AlignValue | undefined {
  const horizontal = rules[`${prefix}-horizontal`];
  const vertical = rules[`${prefix}-vertical`];

  return typeof horizontal === "string" && typeof vertical === "string"
    ? {
        horizontal: horizontal as AlignValue["horizontal"],
        vertical: vertical as AlignValue["vertical"],
      }
    : undefined;
}

function offsetFromLonghands(rules: ResolvedRuleMap): OffsetValue | undefined {
  const x = rules["offset-x"];
  const y = rules["offset-y"];

  return x instanceof Scalar && y instanceof Scalar ? { x, y } : undefined;
}

function overflowFromLonghands(rules: ResolvedRuleMap): OverflowValue | undefined {
  const x = rules["overflow-x"];
  const y = rules["overflow-y"];

  return typeof x === "string" && typeof y === "string" ? { x: x as OverflowValue["x"], y: y as OverflowValue["y"] } : undefined;
}

function pairFromLonghands(rules: ResolvedRuleMap, leftName: string, rightName: string): [number, number] | undefined {
  const left = rules[leftName];
  const right = rules[rightName];

  return typeof left === "number" && typeof right === "number" ? [left, right] : undefined;
}

function gridGutterFromLonghands(rules: ResolvedRuleMap): OffsetValue | undefined {
  const x = rules["grid-gutter-horizontal"];
  const y = rules["grid-gutter-vertical"];

  return x instanceof Scalar && y instanceof Scalar ? { x, y } : undefined;
}

function borderFromEdges(rules: ResolvedRuleMap, prefix: "border" | "outline"): BorderValue | undefined {
  const top = rules[`${prefix}-top`];
  const right = rules[`${prefix}-right`];
  const bottom = rules[`${prefix}-bottom`];
  const left = rules[`${prefix}-left`];
  const values = [top, right, bottom, left];

  if (values.every((value) => isBorderValue(value))) {
    const [first] = values as BorderValue[];
    const allEqual = (values as BorderValue[]).every((value) => borderValueEquals(value, first));

    return allEqual ? first : undefined;
  }

  return undefined;
}

function borderValueEquals(left: BorderValue, right: BorderValue): boolean {
  const leftColor = colorToInkValue(left.color);
  const rightColor = colorToInkValue(right.color);
  return left.style === right.style && leftColor === rightColor;
}

function isBorderValue(value: unknown): value is BorderValue {
  return typeof value === "object" && value !== null && "style" in value;
}
