import * as csstree from "css-tree";
import { readFileSync } from "node:fs";

import { Spacing } from "../geometry/index.js";
import { Color } from "./color.js";
import { PSEUDO_CLASS_NAMES } from "./pseudo-classes.js";
import { axisToPercentUnit, normalizeScalar, parseScalar, Scalar, type ScalarAxis, scalarToInkValue, scalarToRawValue, StyleValueError, Unit } from "./scalar.js";
import type { BorderValue, ResolvedInkStyles, ResolvedRuleMap } from "./resolved-styles.js";
import {
  compareSelectorSpecificity,
  matchesSelector,
  parseSelectorList,
  type ParsedSelector,
  type SelectorMatchHost,
} from "./selectors.js";
import type { WidgetTypeMetadata } from "../framework/app-framework.js";
import type { Widget } from "../framework/widget.js";
import type { Size } from "../geometry/size.js";

// [LAW:one-way-deps] Narrow capability interface the cascade resolver requires
// from its host (typically TextualFramework). The resolver never imports the
// host class. Extends SelectorMatchHost because resolveStylesForWidget forwards
// through matchesSelector(host, …) and must therefore satisfy its needs.
export interface StyleResolutionHost extends SelectorMatchHost {
  getActiveStylesheetsFor(typeName: string): ParsedStylesheet[];
  getWidgetTypeMetadata(typeName: string): WidgetTypeMetadata;
  readonly terminalSize: Size;
}

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

// SPACING_EDGE_PROPERTIES is the only set kept at the top of the file: it
// pairs each edge longhand with its directional component, used by both the
// PROPERTIES table builder (for SPACING_EDGE_SPECS) and the box-edge value
// applier downstream.
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

// [LAW:one-source-of-truth] PROPERTIES is the canonical per-property
// dispatch table. parseValue and normalizeStyleAssignment read from one
// spec; future fields (longhands, expand, assemble, initial) will absorb
// the remaining sites that currently re-key on property name.
export type StyleAssignmentValue = string | number | Scalar | Color | readonly Scalar[];

interface PropertySpec {
  parse(rawValue: string): unknown;
  // Returns a normalized raw-value string when the spec handles the given
  // value shape; returns undefined to fall through to the generic
  // string/number stringify in normalizeStyleAssignment.
  normalize?(value: StyleAssignmentValue): string | undefined;
  // Shorthand topology: the longhand property names this shorthand expands
  // into. expand() and assemble() apply only to shorthands.
  longhands?: readonly string[];
  expand?(declaration: ParsedDeclaration): ParsedDeclaration[];
  // Inverse of expand: assemble the shorthand value from resolved longhand
  // values in the cascade map. Returns undefined when the longhands aren't
  // all present / well-typed.
  assemble?(rules: ResolvedRuleMap): unknown;
  // Built-in initial raw value, surfaced through builtInInitialRawValue.
  initialRawValue?: string;
}

function parseColorValue(rawValue: string): unknown {
  const trimmed = rawValue.trim();
  return trimmed.startsWith("var(") ? trimmed : Color.parse(trimmed);
}

function colorNormalize(value: StyleAssignmentValue): string | undefined {
  return value instanceof Color ? value.css : undefined;
}

function makeScalarNormalize(axis: ScalarAxis): PropertySpec["normalize"] {
  return (value) => scalarToRawValue(normalizeScalar(value as string | number | Scalar, axis));
}

function makeScalarListNormalize(axis: ScalarAxis): PropertySpec["normalize"] {
  return (value) => {
    const values = Array.isArray(value)
      ? value
      : String(value).trim().split(/\s+/).map((part) => parseScalar(part, axis));
    return values
      .map((part) => {
        const scalar = normalizeScalar(part, axis);
        return scalarToRawValue(
          scalar.unit === Unit.FRACTION
            ? scalar.copyWith({ percentUnit: axisToPercentUnit(axis) })
            : scalar,
        );
      })
      .join(" ");
  };
}

function makeEnumSpec<T extends string>(name: string, values: readonly T[]): PropertySpec {
  return { parse: (raw) => parseStringEnum(name, raw, values) };
}

function makeIntegerSpec(name: string): PropertySpec {
  return { parse: (raw) => parseInteger(raw, name) };
}

function makeScalarSpec(axis: ScalarAxis): PropertySpec {
  return {
    parse: (raw) => parseScalar(raw, axis),
    normalize: makeScalarNormalize(axis),
  };
}

function makeScalarListSpec(axis: ScalarAxis): PropertySpec {
  return {
    parse: (raw) => parseScalarList(raw, axis),
    normalize: makeScalarListNormalize(axis),
  };
}

const COLOR_SPEC: PropertySpec = { parse: parseColorValue, normalize: colorNormalize };

function colorSpecWithInitial(initialRawValue: string): PropertySpec {
  return { ...COLOR_SPEC, initialRawValue };
}

function withInitial(spec: PropertySpec, initialRawValue: string): PropertySpec {
  return { ...spec, initialRawValue };
}

const BORDER_LONGHAND_SPEC: PropertySpec = { parse: parseBorder, initialRawValue: "none" };
const TEXT_STYLE_SPEC: PropertySpec = { parse: parseTextStyle, initialRawValue: "none" };
const SPACING_EDGE_SPECS = Object.fromEntries(
  [...SPACING_EDGE_PROPERTIES.keys()].map((name) => [name, { ...makeIntegerSpec(name), initialRawValue: "0" }]),
);

const EDGES = ["top", "right", "bottom", "left"] as const;

function makeBorderShorthandSpec(prefix: "border" | "outline"): PropertySpec {
  const longhands = EDGES.map((edge) => `${prefix}-${edge}`);
  return {
    parse: parseBorder,
    longhands,
    expand: (declaration) => longhands.map((property) => ({ ...declaration, property })),
    assemble: (rules) => borderFromEdges(rules, prefix),
  };
}

function makeSpacingShorthandSpec(prefix: "padding" | "margin"): PropertySpec {
  const longhands = EDGES.map((edge) => `${prefix}-${edge}`);
  return {
    parse: parseSpacing,
    longhands,
    expand: (declaration) => {
      const spacing = declaration.value as Spacing;
      return EDGES.map((edge) => ({
        ...declaration,
        property: `${prefix}-${edge}`,
        rawValue: String(spacing[edge]),
        value: spacing[edge],
      }));
    },
    assemble: (rules) => spacingFromEdges(rules, prefix),
  };
}

function makeAlignShorthandSpec(prefix: "align" | "content-align"): PropertySpec {
  const longhands = [`${prefix}-horizontal`, `${prefix}-vertical`];
  return {
    parse: parseAlign,
    longhands,
    expand: (declaration) => {
      const align = declaration.value as AlignValue;
      return [
        {
          ...declaration,
          property: `${prefix}-horizontal`,
          rawValue: align.horizontal,
          value: align.horizontal,
        },
        {
          ...declaration,
          property: `${prefix}-vertical`,
          rawValue: align.vertical,
          value: align.vertical,
        },
      ];
    },
    assemble: (rules) => alignFromLonghands(rules, prefix),
  };
}

const OFFSET_SHORTHAND_SPEC: PropertySpec = {
  parse: parseOffset,
  longhands: ["offset-x", "offset-y"],
  expand: (declaration) => {
    const offset = declaration.value as OffsetValue;
    return [
      { ...declaration, property: "offset-x", rawValue: scalarToRawValue(offset.x), value: offset.x },
      { ...declaration, property: "offset-y", rawValue: scalarToRawValue(offset.y), value: offset.y },
    ];
  },
  assemble: offsetFromLonghands,
};

const OVERFLOW_SHORTHAND_SPEC: PropertySpec = {
  parse: parseOverflow,
  longhands: ["overflow-x", "overflow-y"],
  expand: (declaration) => {
    const overflow = declaration.value as OverflowValue;
    return [
      { ...declaration, property: "overflow-x", rawValue: overflow.x, value: overflow.x },
      { ...declaration, property: "overflow-y", rawValue: overflow.y, value: overflow.y },
    ];
  },
  assemble: overflowFromLonghands,
};

const SCROLLBAR_SIZE_SHORTHAND_SPEC: PropertySpec = {
  parse: parseScrollbarSize,
  longhands: ["scrollbar-size-horizontal", "scrollbar-size-vertical"],
  expand: (declaration) => {
    const [horizontal, vertical] = declaration.value as [number, number];
    return [
      { ...declaration, property: "scrollbar-size-horizontal", rawValue: String(horizontal), value: horizontal },
      { ...declaration, property: "scrollbar-size-vertical", rawValue: String(vertical), value: vertical },
    ];
  },
  assemble: (rules) => pairFromLonghands(rules, "scrollbar-size-horizontal", "scrollbar-size-vertical"),
};

const GRID_SIZE_SHORTHAND_SPEC: PropertySpec = {
  parse: parseGridSize,
  longhands: ["grid-size-columns", "grid-size-rows"],
  expand: (declaration) => {
    const [columns, rows] = declaration.value as [number, number];
    return [
      { ...declaration, property: "grid-size-columns", rawValue: String(columns), value: columns },
      { ...declaration, property: "grid-size-rows", rawValue: String(rows), value: rows },
    ];
  },
  assemble: (rules) => pairFromLonghands(rules, "grid-size-columns", "grid-size-rows"),
};

const GRID_GUTTER_SHORTHAND_SPEC: PropertySpec = {
  parse: parseOffset,
  longhands: ["grid-gutter-horizontal", "grid-gutter-vertical"],
  expand: (declaration) => {
    const gutter = declaration.value as OffsetValue;
    return [
      { ...declaration, property: "grid-gutter-horizontal", rawValue: scalarToRawValue(gutter.x), value: gutter.x },
      { ...declaration, property: "grid-gutter-vertical", rawValue: scalarToRawValue(gutter.y), value: gutter.y },
    ];
  },
  assemble: gridGutterFromLonghands,
};

const PROPERTIES: Readonly<Record<string, PropertySpec>> = {
  // Dimension scalars.
  width: makeScalarSpec("width"),
  "min-width": makeScalarSpec("width"),
  "max-width": makeScalarSpec("width"),
  height: makeScalarSpec("height"),
  "min-height": makeScalarSpec("height"),
  "max-height": makeScalarSpec("height"),

  // Spacing.
  padding: makeSpacingShorthandSpec("padding"),
  margin: makeSpacingShorthandSpec("margin"),
  ...SPACING_EDGE_SPECS,

  // Borders / outlines.
  border: makeBorderShorthandSpec("border"),
  "border-top": BORDER_LONGHAND_SPEC,
  "border-right": BORDER_LONGHAND_SPEC,
  "border-bottom": BORDER_LONGHAND_SPEC,
  "border-left": BORDER_LONGHAND_SPEC,
  outline: makeBorderShorthandSpec("outline"),
  "outline-top": BORDER_LONGHAND_SPEC,
  "outline-right": BORDER_LONGHAND_SPEC,
  "outline-bottom": BORDER_LONGHAND_SPEC,
  "outline-left": BORDER_LONGHAND_SPEC,

  // Colors.
  background: colorSpecWithInitial("rgba(0,0,0,0)"),
  color: colorSpecWithInitial("white"),
  tint: COLOR_SPEC,
  "scrollbar-color": COLOR_SPEC,
  "scrollbar-color-hover": COLOR_SPEC,
  "scrollbar-color-active": COLOR_SPEC,
  "scrollbar-background": COLOR_SPEC,
  "scrollbar-background-hover": COLOR_SPEC,
  "scrollbar-background-active": COLOR_SPEC,
  "link-color": COLOR_SPEC,
  "link-background": COLOR_SPEC,
  "link-color-hover": COLOR_SPEC,
  "link-background-hover": COLOR_SPEC,

  // Display / visibility / opacity.
  display: withInitial(makeEnumSpec("display", ["block", "none"]), "block"),
  visibility: withInitial(makeEnumSpec("visibility", ["visible", "hidden"]), "visible"),
  opacity: { parse: parseFractional, initialRawValue: "1" },

  // Text.
  "text-align": withInitial(
    makeEnumSpec("text-align", ["left", "start", "center", "right", "end", "justify"]),
    "left",
  ),
  "text-style": TEXT_STYLE_SPEC,
  "link-style": TEXT_STYLE_SPEC,
  "link-style-hover": TEXT_STYLE_SPEC,
  "text-wrap": withInitial(makeEnumSpec("text-wrap", ["wrap", "nowrap", "ellipsis"]), "wrap"),
  "text-overflow": makeEnumSpec("text-overflow", ["ellipsis", "fold"]),

  // Pointer / dock.
  pointer: { parse: (raw) => parseStringEnum("pointer", raw, POINTER_VALUES), initialRawValue: "default" },
  dock: makeEnumSpec("dock", ["top", "bottom", "left", "right"]),

  // Overflow.
  overflow: OVERFLOW_SHORTHAND_SPEC,
  "overflow-x": withInitial(makeEnumSpec("overflow-x", ["auto", "scroll", "hidden"]), "auto"),
  "overflow-y": withInitial(makeEnumSpec("overflow-y", ["auto", "scroll", "hidden"]), "auto"),

  // Align / content-align.
  align: makeAlignShorthandSpec("align"),
  "content-align": makeAlignShorthandSpec("content-align"),
  "align-horizontal": withInitial(makeEnumSpec("align-horizontal", ["left", "center", "right"]), "left"),
  "content-align-horizontal": withInitial(
    makeEnumSpec("content-align-horizontal", ["left", "center", "right"]),
    "left",
  ),
  "align-vertical": withInitial(makeEnumSpec("align-vertical", ["top", "middle", "bottom"]), "top"),
  "content-align-vertical": withInitial(
    makeEnumSpec("content-align-vertical", ["top", "middle", "bottom"]),
    "top",
  ),

  // Offset.
  offset: OFFSET_SHORTHAND_SPEC,
  "offset-x": withInitial(makeScalarSpec("width"), "0"),
  "offset-y": withInitial(makeScalarSpec("height"), "0"),

  // Grid.
  "grid-size": GRID_SIZE_SHORTHAND_SPEC,
  "grid-size-columns": withInitial(makeIntegerSpec("grid-size-columns"), "1"),
  "grid-size-rows": withInitial(makeIntegerSpec("grid-size-rows"), "1"),
  "grid-gutter": GRID_GUTTER_SHORTHAND_SPEC,
  "grid-gutter-horizontal": withInitial(makeScalarSpec("width"), "0"),
  "grid-gutter-vertical": withInitial(makeScalarSpec("height"), "0"),
  "grid-columns": makeScalarListSpec("width"),
  "grid-rows": makeScalarListSpec("height"),
  "row-span": makeIntegerSpec("row-span"),
  "column-span": makeIntegerSpec("column-span"),

  // Scrollbar.
  "scrollbar-size": SCROLLBAR_SIZE_SHORTHAND_SPEC,
  "scrollbar-size-horizontal": withInitial(makeIntegerSpec("scrollbar-size-horizontal"), "1"),
  "scrollbar-size-vertical": withInitial(makeIntegerSpec("scrollbar-size-vertical"), "1"),
  // [LAW:single-enforcer] Scrollbar gutter grammar is enforced at the TCSS
  // value boundary so layout infrastructure consumes one canonical enum.
  "scrollbar-gutter": withInitial(makeEnumSpec("scrollbar-gutter", ["auto", "stable"]), "auto"),

  // Box / border title alignment.
  "box-sizing": makeEnumSpec("box-sizing", ["border-box", "content-box"]),
  "border-title-align": makeEnumSpec("border-title-align", ["left", "center", "right"]),
  "border-subtitle-align": makeEnumSpec("border-subtitle-align", ["left", "center", "right"]),

  // Overlay / constrain / layout.
  overlay: makeEnumSpec("overlay", ["screen"]),
  constrain: makeEnumSpec("constrain", ["x", "y", "both", "none"]),
  layout: makeEnumSpec("layout", ["vertical", "horizontal", "grid", "stream"]),

  // Transition.
  transition: { parse: parseTransition },

  // Generic-string properties: known but parsed as raw trimmed text.
  layers: { parse: (raw) => raw.trim() },
  layer: { parse: (raw) => raw.trim() },
  hatch: { parse: (raw) => raw.trim() },
};

// [LAW:one-source-of-truth] KNOWN_PROPERTIES is derived from the canonical
// PROPERTIES table. Adding a property to PROPERTIES makes it valid; there is
// no parallel hand-maintained list to keep in sync.
const KNOWN_PROPERTIES: ReadonlySet<string> = new Set(Object.keys(PROPERTIES));

function parseValue(property: string, rawValue: string): unknown {
  if (!property.startsWith("--") && !KNOWN_PROPERTIES.has(property)) {
    throw new StylesheetParseError(propertySuggestionMessage(property));
  }

  if (rawValue.trim() === "initial") {
    return "initial";
  }

  // [LAW:dataflow-not-control-flow] Property dispatch is one table lookup;
  // unknown properties (incl. custom --*) fall through to a trim() default.
  return PROPERTIES[property]?.parse(rawValue) ?? rawValue.trim();
}

export function normalizeStyleAssignment(property: string, value: StyleAssignmentValue): string {
  // [LAW:dataflow-not-control-flow] Per-property normalization is one table
  // lookup; the spec.normalize hook decides whether the value shape is
  // handled, falling through to the generic stringify when it returns
  // undefined.
  const normalized = PROPERTIES[property]?.normalize?.(value);

  if (normalized !== undefined) {
    return normalized;
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
  const spec = PROPERTIES[declaration.property];

  // [LAW:dataflow-not-control-flow] Non-shorthands pass through unchanged;
  // shorthands with longhands defer to spec.expand. The "initial" case is
  // derived from spec.longhands — no per-shorthand initial code path.
  if (spec?.longhands === undefined || spec.expand === undefined) {
    return [declaration];
  }

  if (declaration.value === "initial") {
    return spec.longhands.map((property) => ({
      ...declaration,
      property,
      rawValue: "initial",
      value: "initial",
    }));
  }

  return spec.expand(declaration);
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

function builtInInitialRawValue(property: string): string | undefined {
  if (property.startsWith("--")) {
    return undefined;
  }

  // [LAW:one-source-of-truth] Initial values live on each PropertySpec; the
  // map of "what's the default raw value for X" is derived, not maintained.
  return PROPERTIES[property]?.initialRawValue;
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
  host: StyleResolutionHost,
  widget: Widget,
  parentCustomProperties: Record<string, string>,
  inheritedTextStyle?: unknown,
): ResolvedInkStyles {
  const candidatesByProperty = new Map<string, CascadeValue[]>();
  const customProperties = { ...parentCustomProperties };
  const stylesheets = host.getActiveStylesheetsFor(widget.typeName);
  const defaultStylesheets = host.getWidgetTypeMetadata(widget.typeName).defaultStylesheets;
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
      const matchingSelectors = rule.selectors.filter((selector) => matchesSelector(host, widget, selector));

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
          rule.selectors.some((selector) => matchesSelector(host, widget, selector))
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
    ...rulesToInk(rules, host.terminalSize, host.getWidgetTypeMetadata(widget.typeName).componentClasses),
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
  // [LAW:one-source-of-truth] Compound rules exposed to consumers are derived
  // from the canonical longhand cascade result via spec.assemble; the
  // dispatcher iterates the PROPERTIES table and never names individual
  // shorthands.
  for (const [property, spec] of Object.entries(PROPERTIES)) {
    if (spec.assemble === undefined) {
      continue;
    }

    const value = spec.assemble(rules);

    if (value !== undefined) {
      rules[property] = value;
    }
  }
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
