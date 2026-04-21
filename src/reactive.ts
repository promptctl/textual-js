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
  layout?: boolean;
  repaint?: boolean;
  bindings?: boolean;
  toggleClass?: string | null;
  recompose?: boolean;
}

export interface ReactiveWatchOptions {
  init?: boolean;
}

export class Initialize<TOwner, TValue> {
  constructor(readonly factory: (owner: TOwner) => TValue) {}
}

type ReactiveDefault<T> = T | (() => T) | Initialize<any, T>;

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
      init: options.init ?? true,
      alwaysUpdate: options.alwaysUpdate ?? false,
      layout: options.layout ?? false,
      repaint: options.repaint ?? true,
      bindings: options.bindings ?? false,
      toggleClass: options.toggleClass ?? null,
      recompose: options.recompose ?? false,
    },
  };
}

export function reactiveVar<T>(defaultValue: ReactiveDefault<T>, options: ReactiveOptions = {}): ReactiveDefinition<T> {
  return reactive(defaultValue, {
    ...options,
    init: options.init ?? true,
    layout: false,
    repaint: false,
  });
}

export { reactiveVar as var };

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

function invokeWatcher<T>(watcher: (...args: unknown[]) => unknown, oldValue: T | undefined, newValue: T): unknown {
  if (watcher.length <= 0) {
    return watcher();
  }

  if (watcher.length === 1) {
    return watcher(newValue);
  }

  return watcher(oldValue, newValue);
}

function isAsyncWatcher(watcher: (...args: unknown[]) => unknown): boolean {
  return watcher.constructor.name === "AsyncFunction";
}

export abstract class ReactiveHost {
  private readonly reactiveBoxes = new Map<string, IObservableValue<unknown>>();
  private readonly computedValues = new Map<string, IComputedValue<unknown>>();
  private readonly externalWatchers = new Map<string, Map<ReactiveWatcher<unknown>, ReactiveHost>>();
  private readonly reactiveDefinitions = new Map<string, ReactiveDefinition<unknown>>();
  private reactiveBindingParent: ReactiveHost | null = null;
  private readonly bindingCleanups = new Set<() => void>();
  private readonly silentReactiveNames = new Set<string>();
  private silentMutationDepth = 0;
  private initialized = false;

  constructor() {
    this.installPreInitializationGuards(this.collectReactiveDefinitions({}));
  }

  protected initializeReactiveState(definitions: ReactiveDefinitions): void {
    if (this.initialized) {
      return;
    }

    const pendingInitNotifications: Array<{ name: string; value: unknown }> = [];

    for (const [name, definition] of this.collectReactiveDefinitions(definitions).entries()) {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(this, name);

      if (propertyDescriptor !== undefined && propertyDescriptor.set === undefined) {
        throw new ReactiveError(`Reactive "${name}" was assigned before reactive initialization completed`);
      }

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

        this.runReactiveSideEffects(name, change.oldValue, change.newValue);
      });

      if (definition.options.init) {
        pendingInitNotifications.push({ name, value: box.get() });
      }
    }

    this.initializeComputedState();
    this.initialized = true;

    for (const notification of pendingInitNotifications) {
      this.runReactiveSideEffects(notification.name, notification.value, notification.value);
    }
  }

  setReactiveBindingParent(parent: ReactiveHost | null): void {
    this.reactiveBindingParent = parent;
  }

  disposeReactiveBindings(): void {
    for (const cleanup of this.bindingCleanups) {
      cleanup();
    }

    this.bindingCleanups.clear();
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

    return target.addExternalWatcher(name, callback, watchOptions, this);
  }

  dataBind(...sources: ReactiveBindingSource<unknown>[]): () => void;
  dataBind(bindings: Record<string, ReactiveBindingSource<unknown> | unknown>): () => void;
  dataBind(
    bindingsOrSource: Record<string, ReactiveBindingSource<unknown> | unknown> | ReactiveBindingSource<unknown>,
    ...additionalSources: ReactiveBindingSource<unknown>[]
  ): () => void {
    const unsubscribeCallbacks: Array<() => void> = [];
    const bindingEntries = isReactiveBindingSource(bindingsOrSource)
      ? [bindingsOrSource, ...additionalSources].map((source) => [source.name, source] as const)
      : Object.entries(bindingsOrSource);

    for (const [targetName, source] of bindingEntries) {
      this.assertWritableReactive(targetName);

      if (isReactiveBindingSource(source)) {
        source.host.assertReadableReactive(source.name);
        this.assertBindingSourceAllowed(source);

        // [LAW:one-source-of-truth] Cross-host bindings subscribe to the source
        // host's reactive stream directly, so synchronization derives from the
        // canonical source value instead of a mirrored observer path.
        unsubscribeCallbacks.push(source.host.watch(source.name, (_oldValue, newValue) => {
          this.applyBoundValue(targetName, newValue);
        }, { init: true }));
        continue;
      }

      this.scheduleReactiveDelivery(() => {
        this.applyBoundValue(targetName, source);
      });
    }

    const cleanup = () => {
      for (const unsubscribe of unsubscribeCallbacks) {
        unsubscribe();
      }
      this.bindingCleanups.delete(cleanup);
    };

    this.bindingCleanups.add(cleanup);
    return cleanup;
  }

  private addExternalWatcher<T>(
    name: string,
    callback: ReactiveWatcher<T>,
    options: ReactiveWatchOptions = {},
    owner: ReactiveHost = this,
  ): () => void {
    this.assertReadableReactive(name);
    const watchers = this.externalWatchers.get(name) ?? new Map<ReactiveWatcher<unknown>, ReactiveHost>();
    const sizeBefore = watchers.size;

    watchers.set(callback as ReactiveWatcher<unknown>, owner);
    this.externalWatchers.set(name, watchers);

    if (options.init && watchers.size > sizeBefore) {
      this.dispatchWatcher(callback as (...args: unknown[]) => unknown, this.readReactiveValue(name) as T, this.readReactiveValue(name) as T);
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
    this.runReactiveSideEffects(name, currentValue, currentValue);
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

          this.runReactiveSideEffects(name, previousValue, nextValue);
        },
      );
    }
  }

  private collectReactiveDefinitions(definitions: ReactiveDefinitions): Map<string, ReactiveDefinition<unknown>> {
    const merged = new Map<string, ReactiveDefinition<unknown>>();
    const constructors: Array<{ definitions?: ReactiveDefinitions }> = [];
    let current = this.constructor as { definitions?: ReactiveDefinitions };

    // [LAW:one-source-of-truth] Reactive metadata is derived once from the
    // constructor chain so inherited definitions and overrides share one map.
    while (current !== ReactiveHost) {
      constructors.unshift(current);
      current = Object.getPrototypeOf(current) as { definitions?: ReactiveDefinitions };
    }

    for (const constructor of constructors) {
      for (const [name, definition] of Object.entries(constructor.definitions ?? {})) {
        merged.set(name, definition);
      }
    }

    for (const [name, definition] of Object.entries(definitions)) {
      if (!merged.has(name)) {
        merged.set(name, definition);
      }
    }

    return merged;
  }

  private collectComputeMethods(): Map<string, () => unknown> {
    const computeMethods = new Map<string, { publicMethod?: () => unknown; privateMethod?: () => unknown }>();
    let prototype = Object.getPrototypeOf(this);

    while (prototype !== null && prototype !== ReactiveHost.prototype) {
      for (const propertyName of Object.getOwnPropertyNames(prototype)) {
        if (propertyName === "constructor") {
          continue;
        }

        const publicMatch = propertyName.match(/^compute_(.+)$/);
        const privateMatch = propertyName.match(/^_compute_(.+)$/);
        const reactiveName = publicMatch?.[1] ?? privateMatch?.[1];

        if (reactiveName === undefined) {
          continue;
        }

        const record = computeMethods.get(reactiveName) ?? {};

        if (publicMatch !== null && record.publicMethod === undefined) {
          record.publicMethod = findNamedMethod(this, [`compute_${reactiveName}`]) as (() => unknown) | undefined;
        }

        if (privateMatch !== null && record.privateMethod === undefined) {
          record.privateMethod = findNamedMethod(this, [`_compute_${reactiveName}`]) as (() => unknown) | undefined;
        }

        computeMethods.set(reactiveName, record);
      }

      prototype = Object.getPrototypeOf(prototype);
    }

    return new Map(
      Array.from(computeMethods.entries()).map(([name, record]) => {
        if (record.publicMethod !== undefined && record.privateMethod !== undefined) {
          throw new Error(`Too many compute methods for "${name}"`);
        }

        return [name, (record.privateMethod ?? record.publicMethod)!];
      }),
    );
  }

  private resolveDefaultValue<T>(defaultValue: ReactiveDefault<T>): T {
    if (defaultValue instanceof Initialize) {
      return defaultValue.factory(this) as T;
    }

    return typeof defaultValue === "function" ? (defaultValue as () => T)() : defaultValue;
  }

  private applyValidators(name: string, value: unknown): unknown {
    const privateValidator = findNamedMethod(this, candidateMethodNames("_validate", name));
    const publicValidator = findNamedMethod(this, candidateMethodNames("validate", name));
    const validatedPrivate = privateValidator === undefined ? value : privateValidator(value);
    return publicValidator === undefined ? validatedPrivate : publicValidator(validatedPrivate);
  }

  private runReactiveSideEffects(name: string, oldValue: unknown, newValue: unknown): void {
    const definition = this.reactiveDefinitions.get(name);

    this.notifyWatchers(name, oldValue, newValue);

    if (definition !== undefined) {
      this.applyReactiveOptions(name, definition.options, newValue);
    }
  }

  private notifyWatchers(name: string, oldValue: unknown, newValue: unknown): void {
    const privateWatcher = findNamedMethod(this, candidateMethodNames("_watch", name));
    const publicWatcher = findNamedMethod(this, candidateMethodNames("watch", name));
    const externalWatchers = this.externalWatchers.get(name) ?? new Map<ReactiveWatcher<unknown>, ReactiveHost>();

    // [LAW:single-enforcer] MobX observation is the single boundary that invokes
    // watchers, so ordering stays centralized and doesn't drift across callsites.
    for (const watcher of [privateWatcher, publicWatcher]) {
      if (watcher !== undefined) {
        this.dispatchWatcher(watcher, oldValue, newValue);
      }
    }

    for (const [watcher, owner] of externalWatchers) {
      if (!owner.isReactiveOwnerMounted()) {
        externalWatchers.delete(watcher);
        continue;
      }

      this.dispatchWatcher(watcher as (...args: unknown[]) => unknown, oldValue, newValue);
    }
  }

  private applyReactiveOptions(name: string, options: Required<ReactiveOptions>, newValue: unknown): void {
    if (options.toggleClass !== null) {
      this.toggleReactiveClass(options.toggleClass, Boolean(newValue));
    }

    if (options.repaint || options.layout || options.recompose) {
      this.refreshReactive(options.repaint, options.layout, options.recompose);
    }

    if (options.bindings) {
      this.refreshReactiveBindings();
    }

    if (options.recompose) {
      this.recomposeReactiveChildren(name);
    }
  }

  protected refreshReactive(repaint: boolean, layout: boolean, recompose: boolean): void {
    const refresh = (this as { refresh?: (repaint?: boolean, layout?: boolean, recompose?: boolean) => void }).refresh;
    refresh?.call(this, repaint, layout, recompose);
  }

  protected refreshReactiveBindings(): void {
    const framework = (this as { framework?: { notifyBindingsUpdated?: () => void } }).framework;
    framework?.notifyBindingsUpdated?.();
  }

  protected toggleReactiveClass(className: string, enabled: boolean): void {
    const toggleClass = (this as { toggleClass?: (className: string, enabled: boolean) => void }).toggleClass;
    toggleClass?.call(this, className, enabled);
  }

  protected recomposeReactiveChildren(name: string): void {
    const recompose = (this as { recompose?: (name: string) => void }).recompose;
    recompose?.call(this, name);
  }

  protected isReactiveOwnerMounted(): boolean {
    const mounted = (this as { isMounted?: boolean }).isMounted;

    if (typeof mounted === "boolean") {
      return mounted;
    }

    const maybeWidget = this as {
      framework?: { isNodeMounted?: (node: unknown) => boolean };
      nodeId?: string;
    };

    if (maybeWidget.framework?.isNodeMounted !== undefined && typeof maybeWidget.nodeId === "string") {
      return maybeWidget.framework.isNodeMounted(this);
    }

    return true;
  }

  private scheduleReactiveDelivery(callback: () => void): void {
    const framework = (this as { framework?: { callLater?: (callback: () => void) => void } }).framework;

    if (framework?.callLater !== undefined) {
      framework.callLater(callback);
      return;
    }

    queueMicrotask(callback);
  }

  private assertBindingSourceAllowed(source: ReactiveBindingSource<unknown>): void {
    const ancestors = this.getReactiveAncestorHosts();

    if (ancestors.length === 0) {
      return;
    }

    if (source.host === this || source.host.constructor === this.constructor || !ancestors.includes(source.host)) {
      throw new ReactiveError(`Reactive binding source "${source.name}" must come from an ancestor`);
    }
  }

  private getReactiveAncestorHosts(): ReactiveHost[] {
    const ancestors: ReactiveHost[] = [];
    let current = this.reactiveBindingParent;

    while (current !== null) {
      ancestors.push(current);
      current = current.reactiveBindingParent;
    }

    return ancestors;
  }

  private installPreInitializationGuards(definitions: Map<string, ReactiveDefinition<unknown>>): void {
    for (const name of definitions.keys()) {
      if (Object.prototype.hasOwnProperty.call(this, name)) {
        continue;
      }

      Object.defineProperty(this, name, {
        configurable: true,
        enumerable: true,
        get: () => {
          throw new ReactiveError(`Reactive "${name}" was read before reactive initialization completed`);
        },
        set: () => {
          throw new ReactiveError(`Reactive "${name}" was assigned before reactive initialization completed`);
        },
      });
    }
  }

  private dispatchWatcher(
    watcher: (...args: unknown[]) => unknown,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    const invoke = (): void => {
      const result = invokeWatcher(watcher, oldValue, newValue);

      if (result instanceof Promise) {
        void result;
      }
    };

    if (isAsyncWatcher(watcher)) {
      queueMicrotask(invoke);
      return;
    }

    invoke();
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
