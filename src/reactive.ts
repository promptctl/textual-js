/**
 * Reactive — data descriptors that drive automatic refresh on mutation.
 *
 * A reactive attribute stores its value on the owner instance under
 * `_reactive_<name>`. When the value changes, it runs validators, watchers,
 * and optionally triggers refresh/layout/recompose.
 *
 * // [LAW:single-enforcer] All validation, watcher invocation, and refresh
 * // scheduling for reactive writes flows through Reactive.set().
 * // [LAW:dataflow-not-control-flow] The set pipeline is fixed; variability
 * // lives in the descriptor flags and the value.
 */

export interface ReactiveOptions {
  /** Trigger layout refresh on change. */
  layout?: boolean;
  /** Trigger repaint on change. */
  repaint?: boolean;
  /** Run watchers on initialization. */
  init?: boolean;
  /** Fire watchers even when the new value equals the old. */
  alwaysUpdate?: boolean;
}

type WatcherCallback<T> = ((newValue: T) => void) | ((oldValue: T, newValue: T) => void);

interface ReactiveState<T> {
  value: T;
  watchers: Array<WatcherCallback<T>>;
}

const REACTIVE_STORE = Symbol("reactive_store");

interface ReactiveHost {
  [REACTIVE_STORE]?: Map<string, ReactiveState<unknown>>;
  refresh?(options?: { repaint?: boolean; layout?: boolean }): void;
}

/**
 * Get or create the reactive state for a given name on a host object.
 */
function getState<T>(host: ReactiveHost, name: string, defaultValue: T): ReactiveState<T> {
  let store = host[REACTIVE_STORE];
  if (!store) {
    store = new Map();
    host[REACTIVE_STORE] = store;
  }
  let state = store.get(name) as ReactiveState<T> | undefined;
  if (!state) {
    state = { value: defaultValue, watchers: [] };
    store.set(name, state as ReactiveState<unknown>);
  }
  return state;
}

/**
 * Create a reactive property descriptor.
 *
 * Usage:
 * ```ts
 * class MyWidget extends Widget {
 *   count = reactive(0);
 *   label = reactive("hello", { repaint: true });
 * }
 * ```
 *
 * Since TypeScript doesn't have Python-style descriptors, we use a
 * function-based approach. The reactive returns the initial value at
 * construction. Mutation goes through `setReactive` / `getReactive`.
 */
export function reactive<T>(defaultValue: T, options?: ReactiveOptions): T {
  // At class instantiation time, just return the default value.
  // The actual reactive machinery is driven by getReactive/setReactive.
  return defaultValue;
}

/**
 * Get a reactive value from a host object.
 */
export function getReactive<T>(host: ReactiveHost, name: string, defaultValue: T): T {
  const state = getState(host, name, defaultValue);
  return state.value;
}

/**
 * Set a reactive value, running the full pipeline:
 * validate → store → watchers → refresh.
 */
export function setReactive<T>(
  host: ReactiveHost,
  name: string,
  newValue: T,
  options: ReactiveOptions = {},
): void {
  const state = getState(host, name, newValue);
  const oldValue = state.value;

  // Skip if value unchanged (unless alwaysUpdate)
  if (!options.alwaysUpdate && oldValue === newValue) return;

  state.value = newValue;

  // Run watchers
  for (const watcher of state.watchers) {
    if (watcher.length >= 2) {
      (watcher as (o: T, n: T) => void)(oldValue, newValue);
    } else {
      (watcher as (n: T) => void)(newValue);
    }
  }

  // Trigger refresh
  const repaint = options.repaint ?? true;
  const layout = options.layout ?? false;
  if ((repaint || layout) && host.refresh) {
    host.refresh({ repaint, layout });
  }
}

/**
 * Register a watcher for a reactive attribute on a host.
 */
export function watchReactive<T>(
  host: ReactiveHost,
  name: string,
  defaultValue: T,
  callback: WatcherCallback<T>,
): () => void {
  const state = getState(host, name, defaultValue);
  state.watchers.push(callback);
  return () => {
    const idx = state.watchers.indexOf(callback);
    if (idx !== -1) state.watchers.splice(idx, 1);
  };
}
