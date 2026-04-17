import {
  computed,
  configure,
  intercept,
  observable,
  observe,
  reaction,
  runInAction,
  comparer,
  type IComputedValue,
  type IObservableValue,
  _getGlobalState,
} from "mobx";

configure({ enforceActions: "always" });

export interface ReactiveOptions {
  init?: boolean;
  alwaysUpdate?: boolean;
}

export interface ReactiveWatchOptions {
  init?: boolean;
}

type ReactiveDefault<T> = T | (() => T);

export interface ReactiveDefinition<T> {
  defaultValue: ReactiveDefault<T>;
  options: Required<ReactiveOptions>;
}

export type ReactiveDefinitions = Record<string, ReactiveDefinition<unknown>>;

export type ReactiveWatcher<T> = (oldValue: T | undefined, newValue: T) => void | Promise<void>;

export class ReactiveError extends Error {}

export interface ReactiveBindingSource<T = unknown> {
  readonly host: ReactiveHost;
  readonly name: string;
}

export function reactive<T>(defaultValue: ReactiveDefault<T>, options: ReactiveOptions = {}): ReactiveDefinition<T> {
  return {
    defaultValue,
    options: {
      init: options.init ?? false,
      alwaysUpdate: options.alwaysUpdate ?? false,
    },
  };
}

export function reactiveSource<T>(host: ReactiveHost, name: string): ReactiveBindingSource<T> {
  return { host, name };
}

function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function candidateMethodNames(prefix: string, name: string): string[] {
  const titleName = name.slice(0, 1).toUpperCase() + name.slice(1);
  const snakeName = toSnakeCase(name);

  return [
    `${prefix}_${snakeName}`,
    `${prefix}${titleName}`,
  ];
}

function findNamedMethod(instance: object, names: string[]): ((...args: unknown[]) => unknown) | undefined {
  for (const name of names) {
    const candidate = Reflect.get(instance, name);

    if (typeof candidate === "function") {
      return candidate.bind(instance) as (...args: unknown[]) => unknown;
    }
  }

  return undefined;
}

function invokeWatcher<T>(watcher: (...args: unknown[]) => unknown, oldValue: T | undefined, newValue: T): void {
  const result = watcher.length <= 1 ? watcher(newValue) : watcher(oldValue, newValue);

  if (result instanceof Promise) {
    void result;
  }
}

export abstract class ReactiveHost {
  private readonly reactiveBoxes = new Map<string, IObservableValue<unknown>>();
  private readonly computedValues = new Map<string, IComputedValue<unknown>>();
  private readonly externalWatchers = new Map<string, Set<ReactiveWatcher<unknown>>>();
  private readonly reactiveDefinitions = new Map<string, ReactiveDefinition<unknown>>();
  private readonly silentReactiveNames = new Set<string>();
  private silentMutationDepth = 0;
  private initialized = false;

  protected initializeReactiveState(definitions: ReactiveDefinitions): void {
    if (this.initialized) {
      return;
    }

    for (const [name, definition] of Object.entries(definitions)) {
      this.reactiveDefinitions.set(name, definition);
      const initialValue = this.applyValidators(name, this.resolveDefaultValue(definition.defaultValue));
      const box = observable.box(initialValue, {
        equals: definition.options.alwaysUpdate ? (() => false) : comparer.default,
      });

      this.reactiveBoxes.set(name, box);

      Object.defineProperty(this, name, {
        configurable: false,
        enumerable: true,
        get: () => box.get(),
        set: (value: unknown) => {
          if (!_getGlobalState().allowStateChanges) {
            throw new Error(`Reactive "${name}" must be mutated inside a MobX action`);
          }

          box.set(value);
        },
      });

      intercept(box, (change) => ({
        ...change,
        newValue: this.silentReactiveNames.has(name) ? change.newValue : this.applyValidators(name, change.newValue),
      }));

      observe(box, (change) => {
        if (this.silentReactiveNames.has(name)) {
          return;
        }

        this.notifyWatchers(name, change.oldValue, change.newValue);
      });

      if (definition.options.init) {
        this.notifyWatchers(name, undefined, box.get());
      }
    }

    this.initializeComputedState();
    this.initialized = true;
  }

  watch<T>(name: string, callback: ReactiveWatcher<T>, options?: ReactiveWatchOptions): () => void;
  watch<T>(target: ReactiveHost, name: string, callback: ReactiveWatcher<T>, options?: ReactiveWatchOptions): () => void;
  watch<T>(
    targetOrName: ReactiveHost | string,
    nameOrCallback: string | ReactiveWatcher<T>,
    callbackOrOptions: ReactiveWatcher<T> | ReactiveWatchOptions = {},
    options: ReactiveWatchOptions = {},
  ): () => void {
    const target = typeof targetOrName === "string" ? this : targetOrName;
    const name = typeof targetOrName === "string" ? targetOrName : nameOrCallback;
    const callback = typeof targetOrName === "string" ? nameOrCallback : callbackOrOptions;
    const watchOptions =
      typeof targetOrName === "string"
        ? (callbackOrOptions as ReactiveWatchOptions | undefined) ?? {}
        : options;

    if (typeof name !== "string" || typeof callback !== "function") {
      throw new ReactiveError("watch requires a reactive name and callback");
    }

    return target.addExternalWatcher(name, callback, watchOptions);
  }

  dataBind(bindings: Record<string, ReactiveBindingSource<unknown> | unknown>): () => void {
    const unsubscribeCallbacks: Array<() => void> = [];

    for (const [targetName, source] of Object.entries(bindings)) {
      this.assertWritableReactive(targetName);

      if (isReactiveBindingSource(source)) {
        source.host.assertReadableReactive(source.name);

        // [LAW:one-source-of-truth] Cross-host bindings subscribe to the source
        // host's reactive stream directly, so synchronization derives from the
        // canonical source value instead of a mirrored observer path.
        unsubscribeCallbacks.push(source.host.watch(source.name, (_oldValue, newValue) => {
          this.applyBoundValue(targetName, newValue);
        }, { init: true }));
        continue;
      }

      this.applyBoundValue(targetName, source);
    }

    return () => {
      for (const unsubscribe of unsubscribeCallbacks) {
        unsubscribe();
      }
    };
  }

  private addExternalWatcher<T>(name: string, callback: ReactiveWatcher<T>, options: ReactiveWatchOptions = {}): () => void {
    this.assertReadableReactive(name);
    const watchers = this.externalWatchers.get(name) ?? new Set<ReactiveWatcher<unknown>>();
    const sizeBefore = watchers.size;

    watchers.add(callback as ReactiveWatcher<unknown>);
    this.externalWatchers.set(name, watchers);

    if (options.init && watchers.size > sizeBefore) {
      invokeWatcher(callback as (...args: unknown[]) => unknown, undefined, this.readReactiveValue(name) as T);
    }

    return () => {
      watchers.delete(callback as ReactiveWatcher<unknown>);
    };
  }

  setReactive(name: string, value: unknown): void {
    const box = this.reactiveBoxes.get(name);

    if (box === undefined) {
      throw new Error(`Unknown reactive "${name}"`);
    }

    // [LAW:single-enforcer] Normal reactive writes flow through intercept/observe.
    // setReactive is the one sanctioned escape hatch for silent internal writes.
    this.silentReactiveNames.add(name);
    this.silentMutationDepth += 1;

    try {
      runInAction(() => {
        box.set(value);
      });
    } finally {
      this.silentMutationDepth -= 1;
      this.silentReactiveNames.delete(name);
    }
  }

  mutateReactive(name: string): void {
    const currentValue = this.readReactiveValue(name);
    this.notifyWatchers(name, currentValue, currentValue);
  }

  private applyBoundValue(name: string, value: unknown): void {
    const previousValue = this.readReactiveValue(name);

    runInAction(() => {
      (this as Record<string, unknown>)[name] = value;
    });

    if (Object.is(previousValue, this.readReactiveValue(name))) {
      this.mutateReactive(name);
    }
  }

  private initializeComputedState(): void {
    const computeMethods = this.collectComputeMethods();

    for (const [name, method] of computeMethods) {
      const value = computed(() => method());
      this.computedValues.set(name, value);

      Object.defineProperty(this, name, {
        configurable: false,
        enumerable: true,
        get: () => value.get(),
        set: () => {
          throw new Error(`Computed reactive "${name}" is read-only`);
        },
      });

      reaction(
        () => value.get(),
        (nextValue, previousValue) => {
          if (this.silentMutationDepth > 0) {
            return;
          }

          this.notifyWatchers(name, previousValue, nextValue);
        },
      );
    }
  }

  private collectComputeMethods(): Map<string, () => unknown> {
    const computeMethods = new Map<string, () => unknown>();
    let prototype = Object.getPrototypeOf(this);

    while (prototype !== null && prototype !== ReactiveHost.prototype) {
      for (const propertyName of Object.getOwnPropertyNames(prototype)) {
        if (propertyName === "constructor") {
          continue;
        }

        const publicMatch = propertyName.match(/^compute_(.+)$/);
        const privateMatch = propertyName.match(/^_compute_(.+)$/);
        const reactiveName = publicMatch?.[1] ?? privateMatch?.[1];

        if (reactiveName === undefined || computeMethods.has(reactiveName)) {
          continue;
        }

        const publicMethod = findNamedMethod(this, [`compute_${reactiveName}`]);
        const privateMethod = findNamedMethod(this, [`_compute_${reactiveName}`]);

        if (publicMethod !== undefined && privateMethod !== undefined) {
          throw new Error(`Too many compute methods for "${reactiveName}"`);
        }

        const selectedMethod = privateMethod ?? publicMethod;

        if (selectedMethod !== undefined) {
          computeMethods.set(reactiveName, selectedMethod as () => unknown);
        }
      }

      prototype = Object.getPrototypeOf(prototype);
    }

    return computeMethods;
  }

  private resolveDefaultValue<T>(defaultValue: ReactiveDefault<T>): T {
    return typeof defaultValue === "function" ? (defaultValue as () => T)() : defaultValue;
  }

  private applyValidators(name: string, value: unknown): unknown {
    const privateValidator = findNamedMethod(this, candidateMethodNames("_validate", name));
    const publicValidator = findNamedMethod(this, candidateMethodNames("validate", name));
    const validatedPrivate = privateValidator === undefined ? value : privateValidator(value);
    return publicValidator === undefined ? validatedPrivate : publicValidator(validatedPrivate);
  }

  private notifyWatchers(name: string, oldValue: unknown, newValue: unknown): void {
    const privateWatcher = findNamedMethod(this, candidateMethodNames("_watch", name));
    const publicWatcher = findNamedMethod(this, candidateMethodNames("watch", name));
    const externalWatchers = this.externalWatchers.get(name) ?? new Set<ReactiveWatcher<unknown>>();

    // [LAW:single-enforcer] MobX observation is the single boundary that invokes
    // watchers, so ordering stays centralized and doesn't drift across callsites.
    for (const watcher of [privateWatcher, publicWatcher]) {
      if (watcher !== undefined) {
        invokeWatcher(watcher, oldValue, newValue);
      }
    }

    for (const watcher of externalWatchers) {
      invokeWatcher(watcher as (...args: unknown[]) => unknown, oldValue, newValue);
    }
  }

  private readReactiveValue(name: string): unknown {
    const box = this.reactiveBoxes.get(name);

    if (box !== undefined) {
      return box.get();
    }

    const computedValue = this.computedValues.get(name);

    if (computedValue !== undefined) {
      return computedValue.get();
    }

    throw new Error(`Unknown reactive "${name}"`);
  }

  private assertWritableReactive(name: string): void {
    if (!this.reactiveBoxes.has(name)) {
      throw new ReactiveError(`Unknown writable reactive "${name}"`);
    }
  }

  private assertReadableReactive(name: string): void {
    if (!this.reactiveBoxes.has(name) && !this.computedValues.has(name)) {
      throw new ReactiveError(`Unknown reactive "${name}"`);
    }
  }
}

function isReactiveBindingSource(value: unknown): value is ReactiveBindingSource<unknown> {
  return typeof value === "object" && value !== null && "host" in value && "name" in value;
}
