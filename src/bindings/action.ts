export class ActionError extends Error {}

export class SkipAction extends Error {
  constructor() {
    super("Action skipped");
    this.name = "SkipAction";
  }
}

export type ActionNamespace = "" | "app" | "screen" | "focused";

export interface ParsedAction {
  namespace: ActionNamespace;
  actionName: string;
  params: unknown[];
}

const ALLOWED_NAMESPACES = new Set<ActionNamespace>(["", "app", "screen", "focused"]);

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

  if (!ALLOWED_NAMESPACES.has(namespace)) {
    throw new ActionError(`Unknown action namespace "${namespace}" in "${source}"`);
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

  const body = argsRaw.slice(1, -1).trim();

  if (body.length === 0) {
    return [];
  }

  const parts = splitParams(body, source);

  return parts.map((part) => parseLiteral(part.trim(), source));
}

function splitParams(body: string, source: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inString: string | null = null;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];

    if (inString !== null) {
      current += character;
      if (character === inString && body[index - 1] !== "\\") {
        inString = null;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      current += character;
      inString = character;
      continue;
    }

    if (character === "(" || character === "[") {
      depth += 1;
      current += character;
      continue;
    }

    if (character === ")" || character === "]") {
      depth -= 1;
      current += character;
      continue;
    }

    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  if (depth !== 0 || inString !== null) {
    throw new ActionError(`Malformed argument list in "${source}"`);
  }

  parts.push(current);
  return parts;
}

function parseLiteral(part: string, source: string): unknown {
  if (part === "true") return true;
  if (part === "false") return false;
  if (part === "null") return null;
  if (part === "undefined") return undefined;

  if (/^-?\d+(\.\d+)?$/.test(part)) {
    return Number(part);
  }

  if (
    (part.startsWith("'") && part.endsWith("'")) ||
    (part.startsWith('"') && part.endsWith('"'))
  ) {
    return part.slice(1, -1);
  }

  throw new ActionError(`Unsupported literal "${part}" in "${source}"`);
}
