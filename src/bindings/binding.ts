import { normalizeKeyName } from "../framework/_app-runtime.js";

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

export class NoBinding extends Error {}

export class BindingError extends Error {}

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

export class BindingsMap {
  readonly keyToBindings = new Map<string, Binding[]>();

  constructor(declarations: Iterable<BindingDeclaration> = []) {
    this.bindMany(declarations);
  }

  bindMany(declarations: Iterable<BindingDeclaration>): void {
    for (const binding of makeBindings(declarations)) {
      this.addBinding(binding);
    }
  }

  bind(
    keys: string,
    action: string,
    description?: string,
    options: Omit<Binding, "key" | "action" | "description"> = {},
  ): void {
    this.bindMany([
      description === undefined
        ? { ...options, key: keys, action }
        : { ...options, key: keys, action, description },
    ]);
  }

  addBinding(binding: Binding): void {
    if (binding.key.trim().length === 0) {
      throw new BindingError("Binding key may not be empty");
    }

    const normalizedBindings = makeBindings([binding]);

    // [LAW:one-source-of-truth] Per-key binding membership is owned by
    // keyToBindings; shownKeys and dispatch consumers derive from this map.
    for (const normalized of normalizedBindings) {
      const bucket = this.keyToBindings.get(normalized.key) ?? [];
      bucket.push(normalized);
      this.keyToBindings.set(normalized.key, bucket);
    }
  }

  getBindingsForKey(key: string): Binding[] {
    const normalizedKey = normalizeBindingKey(key);
    const bindings = this.keyToBindings.get(normalizedKey);

    if (bindings === undefined || bindings.length === 0) {
      throw new NoBinding(`No binding for key "${normalizedKey}"`);
    }

    return bindings.slice();
  }

  get shownKeys(): Binding[] {
    return Array.from(this.keyToBindings.values())
      .flat()
      .filter((binding) => binding.show !== false && binding.description !== undefined && binding.description.length > 0);
  }

  static merge(maps: Iterable<BindingsMap>): BindingsMap {
    const merged = new BindingsMap();

    // [LAW:dataflow-not-control-flow] Merge always walks every map and every
    // bucket in order; empty maps encode "nothing to add" as data.
    for (const map of maps) {
      for (const bindings of map.keyToBindings.values()) {
        for (const binding of bindings) {
          merged.addBinding(binding);
        }
      }
    }

    return merged;
  }
}
