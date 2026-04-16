import { normalizeKeyName } from "../framework/app-framework.js";

export interface Binding {
  key: string;
  action: string;
  description?: string;
  show?: boolean;
  priority?: boolean;
  id?: string;
}

export type BindingDeclaration =
  | Binding
  | [key: string, action: string]
  | [key: string, action: string, description: string];

export class InvalidBinding extends Error {}

// [LAW:single-enforcer] Binding key normalization flows through one function so
// comma-separated lists and single-character shorthands collapse to canonical keys.
export function makeBindings(declarations: Iterable<BindingDeclaration>): Binding[] {
  const result: Binding[] = [];

  for (const declaration of declarations) {
    const binding = toBinding(declaration);
    const keys = binding.key
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0);

    if (keys.length === 0) {
      throw new InvalidBinding(`Empty key list in binding "${binding.key}"`);
    }

    for (const key of keys) {
      result.push({ ...binding, key: normalizeBindingKey(key) });
    }
  }

  return result;
}

function toBinding(declaration: BindingDeclaration): Binding {
  if (Array.isArray(declaration)) {
    if (declaration.length < 2 || declaration.length > 3) {
      throw new InvalidBinding(`Binding tuples must have 2 or 3 entries`);
    }

    const [key, action, description] = declaration;
    return description === undefined ? { key, action } : { key, action, description };
  }

  return declaration;
}

export function normalizeBindingKey(key: string): string {
  const normalized = normalizeKeyName(key);
  return normalized.key;
}

export function matchesBindingKey(binding: Binding, normalizedKey: string): boolean {
  return binding.key === normalizedKey;
}
