export class ActionError extends Error {}

export class SkipAction extends Error {
  constructor() {
    super("Action skipped");
    this.name = "SkipAction";
  }
}

export type ActionNamespace = string;

export interface ParsedAction {
  namespace: ActionNamespace;
  actionName: string;
  params: unknown[];
}

export function parseAction(source: string): ParsedAction {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    throw new ActionError(`Empty action string`);
  }

  const parenStart = findTopLevelParen(trimmed);
  const head = parenStart === -1 ? trimmed : trimmed.slice(0, parenStart);
  const argsRaw = parenStart === -1 ? "" : trimmed.slice(parenStart);
  const dot = head.lastIndexOf(".");
  const namespace = (dot >= 0 ? head.slice(0, dot) : "") as ActionNamespace;
  const actionName = dot >= 0 ? head.slice(dot + 1) : head;

  if (namespace.length > 0 && !/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(namespace)) {
    throw new ActionError(`Invalid action namespace "${namespace}" in "${source}"`);
  }

  if (actionName.length === 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(actionName)) {
    throw new ActionError(`Invalid action name in "${source}"`);
  }

  const params = argsRaw.length === 0 ? [] : parseArgList(argsRaw, source);

  return { namespace, actionName, params };
}

function findTopLevelParen(source: string): number {
  let depth = 0;
  let inString: string | null = null;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inString !== null) {
      if (character === inString && source[index - 1] !== "\\") {
        inString = null;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      inString = character;
      continue;
    }

    if (character === "(") {
      if (depth === 0) {
        return index;
      }
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
    }
  }

  return -1;
}

function parseArgList(argsRaw: string, source: string): unknown[] {
  if (!argsRaw.startsWith("(") || !argsRaw.endsWith(")")) {
    throw new ActionError(`Unbalanced parentheses in "${source}"`);
  }

  const state: ParserState = {
    input: argsRaw.slice(1, -1),
    source,
    index: 0,
  };

  skipWhitespace(state);

  if (state.index >= state.input.length) {
    return [];
  }

  const params: unknown[] = [];

  while (state.index < state.input.length) {
    params.push(parseLiteral(state));
    skipWhitespace(state);

    if (state.index >= state.input.length) {
      return params;
    }

    if (state.input[state.index] !== ",") {
      throw new ActionError(`Malformed argument list in "${source}"`);
    }

    state.index += 1;
    skipWhitespace(state);

    if (state.index >= state.input.length) {
      throw new ActionError(`Malformed argument list in "${source}"`);
    }
  }

  return params;
}

interface ParserState {
  input: string;
  source: string;
  index: number;
}

function skipWhitespace(state: ParserState): void {
  while (state.index < state.input.length && /\s/.test(state.input[state.index])) {
    state.index += 1;
  }
}

function parseLiteral(state: ParserState): unknown {
  skipWhitespace(state);

  if (state.index >= state.input.length) {
    throw new ActionError(`Malformed argument list in "${state.source}"`);
  }

  const character = state.input[state.index];

  if (character === "'" || character === '"') {
    return parseString(state);
  }

  if (character === "[") {
    return parseSequence(state, "[", "]");
  }

  if (character === "(") {
    return parseSequence(state, "(", ")");
  }

  if (character === "-" || /\d/.test(character)) {
    return parseNumber(state);
  }

  if (/[A-Za-z_]/.test(character)) {
    return parseIdentifier(state);
  }

  throw new ActionError(`Unsupported literal "${character}" in "${state.source}"`);
}

function parseString(state: ParserState): string {
  const quote = state.input[state.index];
  let value = "";

  state.index += 1;

  while (state.index < state.input.length) {
    const character = state.input[state.index];

    if (character === "\\") {
      state.index += 1;

      if (state.index >= state.input.length) {
        throw new ActionError(`Malformed argument list in "${state.source}"`);
      }

      value += state.input[state.index];
      state.index += 1;
      continue;
    }

    if (character === quote) {
      state.index += 1;
      return value;
    }

    value += character;
    state.index += 1;
  }

  throw new ActionError(`Malformed argument list in "${state.source}"`);
}

function parseSequence(state: ParserState, open: string, close: string): unknown[] {
  const values: unknown[] = [];

  state.index += 1;
  skipWhitespace(state);

  if (state.input[state.index] === close) {
    state.index += 1;
    return values;
  }

  while (state.index < state.input.length) {
    values.push(parseLiteral(state));
    skipWhitespace(state);

    if (state.index >= state.input.length) {
      break;
    }

    const character = state.input[state.index];

    if (character === close) {
      state.index += 1;
      return values;
    }

    if (character !== ",") {
      throw new ActionError(`Malformed argument list in "${state.source}"`);
    }

    state.index += 1;
    skipWhitespace(state);

    if (state.index >= state.input.length || state.input[state.index] === close) {
      throw new ActionError(`Malformed argument list in "${state.source}"`);
    }
  }

  throw new ActionError(`Malformed argument list in "${state.source}"`);
}

function parseNumber(state: ParserState): number {
  const fragment = state.input.slice(state.index);
  const match = /^-?\d+(\.\d+)?/.exec(fragment);

  if (match === null) {
    throw new ActionError(`Unsupported literal "${fragment}" in "${state.source}"`);
  }

  state.index += match[0].length;
  return Number(match[0]);
}

function parseIdentifier(state: ParserState): unknown {
  const fragment = state.input.slice(state.index);
  const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(fragment);

  if (match === null) {
    throw new ActionError(`Malformed argument list in "${state.source}"`);
  }

  state.index += match[0].length;

  if (match[0] === "true" || match[0] === "True") return true;
  if (match[0] === "false" || match[0] === "False") return false;
  if (match[0] === "null" || match[0] === "None") return null;
  if (match[0] === "undefined") return undefined;

  throw new ActionError(`Unsupported literal "${match[0]}" in "${state.source}"`);
}
