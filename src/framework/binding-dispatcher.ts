// [LAW:single-enforcer] BindingDispatcher is the sole owner of app-binding /
// keymap / action-dispatch state. Framework methods delegate so the binding
// chain (app → screen → focused-widget ancestry), keymap rewriting, clash
// detection, priority dispatch, screen dispatch, action resolution, and
// active-binding rendering all live in one place.
// [LAW:one-source-of-truth] appBindings / appActions / keymap /
// lastActionDispatchResult / bindingClashSignatures live in exactly one place:
// this service.
// [LAW:one-way-deps] The service depends only on a narrow injected deps
// interface; it does NOT import AppRuntime.

import "./mobx-config.js";

import { autoObservable } from "./auto-observable.js";

import {
  SkipAction,
  makeBindings,
  parseAction,
  type Binding,
  type BindingDeclaration,
} from "../bindings/index.js";
import type { Widget } from "./widget.js";
import type {
  WidgetActionCallback,
  WidgetActions,
  WidgetCheckAction,
} from "./widget-registry.js";
import { normalizeKeyName } from "./_app-runtime.js";
import type {
  ActionTargetDescriptor,
  ActiveBinding,
  BindingClash,
  BindingNamespace,
  KeymapInput,
  Screen,
} from "./_app-runtime.js";

interface BindingChainEntry {
  namespace: BindingNamespace;
  bindings: Binding[];
  actions: WidgetActions | undefined;
}

interface ActiveBindingSeed {
  binding: Binding;
  namespace: BindingNamespace;
  actions: WidgetActions | undefined;
}

type ActionDispatchResult = "handled" | "consumed" | "unhandled";

// [LAW:one-way-deps] Narrow capability interface the dispatcher requires from
// its host (typically AppRuntime). The dispatcher never imports the
// host class — only this shape.
export interface BindingDispatcherDeps {
  // Default-action navigation hooks. setAppActions merges these with caller-
  // provided actions so the standard focus/quit/palette bindings always work.
  focusNext(): void;
  focusPrevious(): void;
  exit(): void;
  openCommandPalette(): Promise<void> | void;

  // Resolution context for action targets and binding chains.
  getFocusedNodeId(): string | null;
  getWidget(id: string): Widget | undefined;
  listWidgets(): Widget[];
  getActiveScreen(): Screen | null;

  // bindings_updated_signal publish hook (owned by SignalRegistry).
  publishBindingsUpdated(): void;

  // App-overridable clash hook. Default no-op; apps may surface clashes.
  reportBindingsClash(clashes: BindingClash[], namespace: BindingNamespace): void;
}

export class BindingDispatcher {
  private appBindings: Binding[] = [];
  private appActions: WidgetActions | undefined = undefined;
  private keymap = new Map<string, string[]>();
  private lastActionDispatchResult: ActionDispatchResult = "unhandled";
  private readonly bindingClashSignatures = new Map<string, string>();
  private readonly deps: BindingDispatcherDeps;
  private readonly appNavigationBindings: readonly BindingDeclaration[];

  constructor(deps: BindingDispatcherDeps, appNavigationBindings: readonly BindingDeclaration[]) {
    this.deps = deps;
    this.appNavigationBindings = appNavigationBindings;
    this.appBindings = makeBindings(appNavigationBindings);

    autoObservable(
      this,
      {
        deps: false,
        bindingClashSignatures: false,
        appNavigationBindings: false,
        lastActionDispatchResult: false,
      },
      { autoBind: true },
    );
  }

  // ---- Public API ----

  setAppBindings(declarations: Iterable<BindingDeclaration>): void {
    // [LAW:one-source-of-truth] App bindings are merged with navigation defaults
    // at one point; callers never assemble their own binding list.
    this.appBindings = makeBindings([...this.appNavigationBindings, ...declarations]);
    this.notifyBindingsUpdated();
  }

  setKeymap(next: KeymapInput): void {
    // [LAW:one-source-of-truth] Runtime key remaps are canonicalized into one
    // internal keymap store; dispatch and footer consumers derive from it.
    this.keymap = normalizeKeymap(next);
    this.notifyBindingsUpdated();
  }

  updateKeymap(patch: KeymapInput): void {
    const next = new Map(this.keymap);

    for (const [bindingId, keys] of normalizeKeymap(patch).entries()) {
      next.set(bindingId, keys);
    }

    this.keymap = next;
    this.notifyBindingsUpdated();
  }

  setAppActions(actions: WidgetActions | undefined): void {
    const navigation: WidgetActions = {
      action_focus_next: () => {
        this.deps.focusNext();
      },
      action_focus_previous: () => {
        this.deps.focusPrevious();
      },
      action_quit: () => {
        this.deps.exit();
      },
      action_command_palette: () => {
        void this.deps.openCommandPalette();
      },
    };
    this.appActions = { ...navigation, ...(actions ?? {}) };
  }

  getAppActions(): WidgetActions | undefined {
    return this.appActions;
  }

  notifyBindingsUpdated(): void {
    this.syncActiveBindingClashes();
    this.deps.publishBindingsUpdated();
  }

  getActiveBindings(): ActiveBinding[] {
    const chain = this.buildBindingChain();
    const activeBindings: ActiveBinding[] = [];
    const claimedKeys = new Set<string>();
    const widgetLayers = chain.filter((entry) => entry.namespace.kind === "widget").slice().reverse();
    const screenLayers = chain.filter((entry) => entry.namespace.kind === "screen");
    const appLayers = chain.filter((entry) => entry.namespace.kind === "app");

    // [LAW:single-enforcer] Binding display is derived once here so widgets
    // like Footer consume the same precedence, keymap, and checkAction rules
    // that execution uses instead of rebuilding them independently.
    this.collectActiveBindings(activeBindings, claimedKeys, chain, true);
    this.collectActiveBindings(activeBindings, claimedKeys, [...widgetLayers, ...screenLayers, ...appLayers], false);

    return activeBindings;
  }

  runAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean {
    const parsed = parseAction(action);
    const target = this.resolveActionTarget(parsed.namespace, defaultTarget);

    if (target === null) {
      this.lastActionDispatchResult = "unhandled";
      return false;
    }

    const actions = target.actions;
    const checkAction: WidgetCheckAction | undefined =
      typeof actions?.checkAction === "function" ? (actions.checkAction as WidgetCheckAction) : undefined;
    const gate = checkAction === undefined ? true : checkAction(parsed.actionName, parsed.params);

    if (gate === false || gate === null) {
      this.lastActionDispatchResult = "consumed";
      return false;
    }

    const candidate =
      pickActionCallback(actions, `_action_${parsed.actionName}`) ??
      pickActionCallback(actions, `action_${parsed.actionName}`);

    if (candidate === undefined) {
      this.lastActionDispatchResult = "unhandled";
      return false;
    }

    try {
      candidate(...parsed.params);
      this.lastActionDispatchResult = "handled";
      return true;
    } catch (error) {
      if (error instanceof SkipAction) {
        this.lastActionDispatchResult = "unhandled";
        return false;
      }

      throw error;
    }
  }

  checkAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean | null {
    const parsed = parseAction(action);
    const target = this.resolveActionTarget(parsed.namespace, defaultTarget);

    if (target === null) {
      return false;
    }

    const actions = target.actions;
    const checkAction: WidgetCheckAction | undefined =
      typeof actions?.checkAction === "function" ? (actions.checkAction as WidgetCheckAction) : undefined;

    return checkAction === undefined ? true : checkAction(parsed.actionName, parsed.params);
  }

  // ---- Pump-callable surface (consumed via MessagePumpDeps) ----

  resolveBindingsForNode(node: Widget): Binding[] {
    return this.rewriteBindings(node.bindings, createWidgetBindingNamespace(node));
  }

  dispatchBindingActionForNode(node: Widget, action: string): boolean {
    return this.dispatchBindingAction(action, { actions: node.actions });
  }

  dispatchPriorityBindings(key: string): boolean {
    const chain = this.buildBindingChain();

    // [LAW:dataflow-not-control-flow] Walk the chain top-down (app → screen → focused).
    // Data (priority flag) decides whether each binding fires, not conditional skips.
    for (const level of chain) {
      for (const binding of level.bindings) {
        if (binding.priority === true && binding.key === key) {
          if (this.dispatchBindingAction(binding.action, { actions: level.actions })) {
            return true;
          }
        }
      }
    }

    return false;
  }

  dispatchScreenKeyBindings(key: string): boolean {
    const screen = this.deps.getActiveScreen();

    if (screen !== null) {
      for (const binding of this.resolveBindingsForScreen(screen)) {
        if (binding.priority !== true && binding.key === key) {
          if (this.dispatchBindingAction(binding.action, { actions: screen.actions })) {
            return true;
          }
        }
      }
    }

    for (const binding of this.resolveBindingsForApp()) {
      if (binding.priority !== true && binding.key === key) {
        if (this.dispatchBindingAction(binding.action, { actions: this.appActions })) {
          return true;
        }
      }
    }

    return false;
  }

  resolveDefaultDispatchTarget(): Widget | undefined {
    const interactiveWidgets = this.deps.listWidgets().filter((entry) => entry.isInteractive);

    // [LAW:one-source-of-truth] Focus/default dispatch target resolution lives
    // in one helper so input routing and app-level dispatch share the same target choice.
    const focusedNodeId = this.deps.getFocusedNodeId();
    return (
      interactiveWidgets.find((entry) => entry.nodeId === focusedNodeId) ??
      interactiveWidgets.find((entry) => entry.focusable) ??
      interactiveWidgets[0]
    );
  }

  // ---- Internal helpers ----

  private dispatchBindingAction(action: string, defaultTarget?: ActionTargetDescriptor): boolean {
    // [LAW:single-enforcer] runAction is the single action-dispatch boundary;
    // binding handling derives consumed-vs-unhandled from its canonical result.
    void this.runAction(action, defaultTarget);
    return this.lastActionDispatchResult !== "unhandled";
  }

  private resolveBindingsForApp(): Binding[] {
    return this.rewriteBindings(this.appBindings, createAppBindingNamespace());
  }

  private resolveBindingsForScreen(screen: Screen): Binding[] {
    return this.rewriteBindings(screen.bindings, createScreenBindingNamespace(screen));
  }

  private rewriteBindings(bindings: Binding[], namespace: BindingNamespace): Binding[] {
    const rewritten: Binding[] = [];
    const remappedIds = new Set<string>();

    // [LAW:single-enforcer] Keymap application lives in one rewrite path so app,
    // screen, and widget bindings cannot drift in remap semantics.
    for (const binding of bindings) {
      const bindingId = binding.id;
      const mappedKeys = bindingId === undefined ? undefined : this.keymap.get(bindingId);

      if (bindingId === undefined || mappedKeys === undefined) {
        rewritten.push(binding);
        continue;
      }

      if (remappedIds.has(bindingId)) {
        continue;
      }

      remappedIds.add(bindingId);

      for (const key of mappedKeys) {
        rewritten.push({ ...binding, key });
      }
    }

    this.reportBindingClashes(namespace, rewritten);
    return rewritten;
  }

  private reportBindingClashes(namespace: BindingNamespace, bindings: Binding[]): void {
    const bindingsByKey = new Map<string, Binding[]>();

    for (const binding of bindings) {
      const bucket = bindingsByKey.get(binding.key) ?? [];
      bucket.push(binding);
      bindingsByKey.set(binding.key, bucket);
    }

    const clashes = Array.from(bindingsByKey.entries())
      .filter(([, entries]) => entries.length > 1)
      .map(([key, entries]) => ({ key, bindings: entries.slice() }));
    const signature = clashes
      .map((entry) => `${entry.key}:${entry.bindings.map((binding) => binding.id ?? binding.action).join("|")}`)
      .join(";");
    const previous = this.bindingClashSignatures.get(namespace.key);

    if (signature.length === 0) {
      this.bindingClashSignatures.delete(namespace.key);
      return;
    }

    if (previous === signature) {
      return;
    }

    this.bindingClashSignatures.set(namespace.key, signature);
    this.deps.reportBindingsClash(clashes, namespace);
  }

  private syncActiveBindingClashes(): void {
    const activeNamespaces = new Set(this.buildBindingChain().map((entry) => entry.namespace.key));

    for (const namespaceKey of this.bindingClashSignatures.keys()) {
      if (!activeNamespaces.has(namespaceKey)) {
        this.bindingClashSignatures.delete(namespaceKey);
      }
    }
  }

  private collectActiveBindings(
    target: ActiveBinding[],
    claimedKeys: Set<string>,
    layers: BindingChainEntry[],
    priority: boolean,
  ): void {
    for (const layer of layers) {
      for (const binding of layer.bindings) {
        if ((binding.priority === true) !== priority) {
          continue;
        }

        if (binding.show === false || claimedKeys.has(binding.key)) {
          continue;
        }

        const gate = this.checkAction(binding.action, { actions: layer.actions });

        if (gate === false) {
          continue;
        }

        claimedKeys.add(binding.key);
        target.push(this.createActiveBinding({
          binding,
          namespace: layer.namespace,
          actions: layer.actions,
        }, gate !== null));
      }
    }
  }

  private createActiveBinding(seed: ActiveBindingSeed, enabled: boolean): ActiveBinding {
    return {
      key: seed.binding.key,
      action: seed.binding.action,
      description: seed.binding.description,
      enabled,
      priority: seed.binding.priority === true,
      namespace: seed.namespace,
      run: () => this.runAction(seed.binding.action, { actions: seed.actions }),
    };
  }

  private buildBindingChain(): BindingChainEntry[] {
    const chain: BindingChainEntry[] = [];

    // App layer first so priority bindings are evaluated top-down.
    chain.push({
      namespace: createAppBindingNamespace(),
      bindings: this.resolveBindingsForApp(),
      actions: this.appActions,
    });

    const screen = this.deps.getActiveScreen();

    if (screen !== null) {
      chain.push({
        namespace: createScreenBindingNamespace(screen),
        bindings: this.resolveBindingsForScreen(screen),
        actions: screen.actions,
      });
    }

    const focusedNodeId = this.deps.getFocusedNodeId();
    const focused = focusedNodeId === null ? undefined : this.deps.getWidget(focusedNodeId);

    if (focused !== undefined) {
      const ancestry: Widget[] = [];
      let current: Widget | undefined = focused;

      while (current !== undefined) {
        ancestry.unshift(current);
        current = current.parent;
      }

      for (const node of ancestry) {
        chain.push({
          namespace: createWidgetBindingNamespace(node),
          bindings: this.resolveBindingsForNode(node),
          actions: node.actions,
        });
      }
    }

    return chain;
  }

  private resolveActionTarget(
    namespace: string,
    defaultTarget?: ActionTargetDescriptor,
  ): { actions: WidgetActions | undefined } | null {
    // [LAW:dataflow-not-control-flow] Named action namespaces dispatch via a
    // table keyed on namespace string. Adding a namespace registers a
    // resolver here; resolveActionTarget does not branch on namespace name.
    const namedNamespaces: Record<string, () => { actions: WidgetActions | undefined } | null> = {
      app: () => ({ actions: this.appActions }),
      screen: () => {
        const screen = this.deps.getActiveScreen();
        return screen === null ? null : { actions: screen.actions };
      },
      focused: () => {
        const focused = this.focusedWidget();
        return focused === undefined ? null : { actions: focused.actions };
      },
    };

    if (namespace !== "") {
      return namedNamespaces[namespace]?.() ?? null;
    }

    // Unnamespaced action: defaultTarget → focused widget → app, in order.
    const focused = this.focusedWidget();
    return (
      (defaultTarget === undefined ? undefined : { actions: defaultTarget.actions }) ??
      (focused === undefined ? undefined : { actions: focused.actions }) ??
      { actions: this.appActions }
    );
  }

  private focusedWidget(): Widget | undefined {
    const focusedNodeId = this.deps.getFocusedNodeId();
    return focusedNodeId === null ? undefined : this.deps.getWidget(focusedNodeId);
  }
}

function pickActionCallback(actions: WidgetActions | undefined, key: string): WidgetActionCallback | undefined {
  if (actions === undefined) {
    return undefined;
  }

  const candidate = actions[key];
  return typeof candidate === "function" ? (candidate as WidgetActionCallback) : undefined;
}

function createAppBindingNamespace(): BindingNamespace {
  return {
    kind: "app",
    key: "app",
    name: "app",
    nodeId: null,
  };
}

function createScreenBindingNamespace(screen: Screen): BindingNamespace {
  return {
    kind: "screen",
    key: `screen:${screen.id}`,
    name: screen.name,
    nodeId: null,
  };
}

function createWidgetBindingNamespace(widget: Widget): BindingNamespace {
  return {
    kind: "widget",
    key: `widget:${widget.nodeId}`,
    name: widget.id ?? widget.typeName,
    nodeId: widget.nodeId,
  };
}

function normalizeKeymap(input: KeymapInput): Map<string, string[]> {
  const entries = input instanceof Map ? input.entries() : Object.entries(input);
  const normalized = new Map<string, string[]>();

  for (const [bindingId, keyList] of entries) {
    normalized.set(bindingId, normalizeKeyList(keyList));
  }

  return normalized;
}

function normalizeKeyList(source: string): string[] {
  return source
    .split(",")
    .map((key) => normalizeKeyName(key).key)
    .filter((key) => key.length > 0);
}
