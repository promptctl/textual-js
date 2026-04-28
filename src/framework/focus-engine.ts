// [LAW:single-enforcer] FocusEngine is the sole owner of focus-chain
// construction, focus traps, structural focus-address restoration, and
// app-blur focus-bookkeeping (blurredFocusAddress / focusChangedWhileBlurred /
// isAppBlurred). The framework orchestrator triggers cross-cutting effects
// (style recalc, bindings notification, focus/blur message enqueue) through a
// narrow injected deps interface — the engine never reaches back into
// TextualFramework directly.
// [LAW:one-source-of-truth] focusTrapNodeId / blurredFocusAddress /
// focusChangedWhileBlurred / isAppBlurred live in exactly one place: this
// engine. The authoritative focusedNodeId remains on the framework as the
// public observable; the engine reads/writes it through deps callbacks so
// there is still exactly one cell holding it.
// [LAW:one-way-deps] The engine depends only on a narrow FocusEngineDeps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import { makeAutoObservable } from "mobx";

import type { Widget } from "./widget.js";
import type { Screen } from "./app-framework.js";

export interface FocusAddress {
  path: number[];
  widgetId: string | null;
  typeName: string;
}

// [LAW:one-way-deps] Narrow capability interface the engine requires from its
// host (typically TextualFramework). The engine never imports the host class.
export interface FocusEngineDeps {
  getFocusedNodeId(): string | null;
  setFocusedNodeId(nodeId: string | null): void;
  getActiveScreen(): Screen | null;
  getAppAutoFocus(): string | null;
  isRunning(): boolean;
  listWidgets(): Widget[];
  getWidget(nodeId: string): Widget | undefined;
  getChildren(parentId: string | null): Widget[];
  recalculateStyles(): void;
  notifyBindingsUpdated(): void;
  enqueueFocusBlur(previousNode: Widget | undefined, nextNode: Widget | undefined): void;
  callAfterRefresh(callback: () => void): void;
  parseSelectors(selectorText: string): ParsedSelectorLike[];
  matchesSelector(widget: Widget, selector: ParsedSelectorLike): boolean;
  resolveWidgetTypeName(typeConstraint: string | Function): string;
}

// Local alias avoids importing the styles module just for a structural type.
// The engine never inspects ParsedSelector internals; it only forwards values
// returned from deps.parseSelectors back into deps.matchesSelector.
export type ParsedSelectorLike = unknown;

export class FocusEngine {
  // [LAW:one-source-of-truth] The single backing store for focus-trap state
  // and app-blur focus bookkeeping.
  focusTrapNodeId: string | null = null;
  isAppBlurred = false;
  blurredFocusAddress: FocusAddress | null = null;
  focusChangedWhileBlurred = false;
  private readonly deps: FocusEngineDeps;

  constructor(deps: FocusEngineDeps) {
    this.deps = deps;
    makeAutoObservable(
      this,
      {
        focusTrapNodeId: false,
        deps: false,
      } as never,
      { autoBind: true },
    );
  }

  // ---- Public focus API ----

  focusWidget(nodeId: string | null): void {
    this.applyFocusChange(nodeId, { markBlurOverride: true });
  }

  clearFocusWithin(container: Widget): void {
    const focusedId = this.deps.getFocusedNodeId();
    const focused = focusedId === null ? undefined : this.deps.getWidget(focusedId);

    if (focused === undefined) {
      return;
    }

    let current: Widget | undefined = focused;

    while (current !== undefined) {
      if (current.nodeId === container.nodeId) {
        this.focusWidget(null);
        return;
      }

      current = current.parent;
    }
  }

  trapFocus(widget: Widget, enabled = true): void {
    const focusedId = this.deps.getFocusedNodeId();

    if (
      enabled &&
      focusedId !== null &&
      this.isNodeWithin(this.deps.getWidget(focusedId), widget)
    ) {
      this.focusTrapNodeId = widget.nodeId;
      this.deps.notifyBindingsUpdated();
      return;
    }

    if (!enabled && this.focusTrapNodeId === widget.nodeId) {
      this.focusTrapNodeId = null;
      this.deps.notifyBindingsUpdated();
    }
  }

  getFocusChain(): Widget[] {
    const trap = this.focusTrapNodeId === null ? undefined : this.deps.getWidget(this.focusTrapNodeId);

    return this.deps.listWidgets().filter((widget) => {
      const insideTrap = trap === undefined || this.isNodeWithin(widget, trap);
      const ancestorsAllowFocus = this.ancestorsAllowFocus(widget);
      return insideTrap && ancestorsAllowFocus && widget.allowFocus();
    });
  }

  focusNext(selector?: string | Function): Widget | null {
    return this.moveFocus(1, selector);
  }

  focusPrevious(selector?: string | Function): Widget | null {
    return this.moveFocus(-1, selector);
  }

  // ---- App-lifecycle focus bookkeeping ----

  // [LAW:single-enforcer] App-blur snapshot/clear/restore live here so every
  // path through handleAppBlur/handleAppFocus updates one bookkeeping store.
  beginAppBlur(): void {
    const focusedId = this.deps.getFocusedNodeId();
    const focused = focusedId === null ? undefined : this.deps.getWidget(focusedId);
    this.blurredFocusAddress = focused === undefined ? null : this.captureFocusAddress(focused);
    this.isAppBlurred = true;
    this.focusChangedWhileBlurred = false;
  }

  // Returns the address that should be restored, or null if focus changed
  // while blurred (in which case the caller should NOT restore).
  endAppBlur(): { shouldRestore: boolean; address: FocusAddress | null } {
    const shouldRestore = !this.focusChangedWhileBlurred;
    const address = this.blurredFocusAddress;

    this.isAppBlurred = false;
    this.blurredFocusAddress = null;
    this.focusChangedWhileBlurred = false;

    return { shouldRestore, address };
  }

  resetBlurState(): void {
    this.isAppBlurred = false;
    this.blurredFocusAddress = null;
    this.focusChangedWhileBlurred = false;
  }

  // ---- Cross-cutting helpers used by the framework orchestrator ----

  // Used by the framework to recover focus after the focused widget is
  // unregistered, and to clear a stale trap reference at the same boundary.
  releaseTrapIfNode(nodeId: string): void {
    if (this.focusTrapNodeId === nodeId) {
      this.focusTrapNodeId = null;
    }
  }

  scheduleActiveScreenFocusResolution(allowAutoFocus: boolean): void {
    this.deps.callAfterRefresh(() => {
      if (this.isAppBlurred) {
        return;
      }

      if (this.deps.getFocusedNodeId() !== null) {
        return;
      }

      const target = this.resolveFocusTarget(
        this.deps.getActiveScreen()?.lastFocusedAddress ?? null,
        allowAutoFocus,
      );
      this.applyFocusChange(target?.nodeId ?? null, { markBlurOverride: false });
    });
  }

  // [LAW:single-enforcer] Focus transitions are emitted from one method so
  // restore, user focus changes, and blur-driven clears share one path.
  applyFocusChange(nodeId: string | null, options: { markBlurOverride: boolean }): void {
    const previousId = this.deps.getFocusedNodeId();

    if (previousId === nodeId) {
      return;
    }

    if (this.isAppBlurred && options.markBlurOverride) {
      this.focusChangedWhileBlurred = true;
    }

    this.deps.setFocusedNodeId(nodeId);
    this.deps.recalculateStyles();

    const previousNode = previousId === null ? undefined : this.deps.getWidget(previousId);
    const nextNode = nodeId === null ? undefined : this.deps.getWidget(nodeId);
    this.deps.enqueueFocusBlur(previousNode, nextNode);

    this.deps.notifyBindingsUpdated();
  }

  saveScreenFocusSnapshot(screen: Screen): void {
    const focusedId = this.deps.getFocusedNodeId();
    const focused = focusedId === null ? undefined : this.deps.getWidget(focusedId);
    screen.savedFocusNodeId = focused?.nodeId ?? null;
    screen.lastFocusedAddress = focused === undefined ? null : this.captureFocusAddress(focused);
  }

  // [LAW:one-source-of-truth] Focus restore captures one structural address
  // derived from registry order. No alternate identity path participates.
  captureFocusAddress(widget: Widget): FocusAddress {
    const segments: number[] = [];
    let current: Widget | undefined = widget;

    while (current !== undefined) {
      const siblings = this.deps.getChildren(current.parentId);
      const index = siblings.findIndex((entry) => entry.nodeId === current!.nodeId);
      segments.unshift(Math.max(0, index));
      current = current.parent;
    }

    return {
      path: segments,
      widgetId: widget.id ?? null,
      typeName: widget.typeName,
    };
  }

  // ---- Private helpers ----

  private moveFocus(direction: 1 | -1, selector?: string | Function): Widget | null {
    const chain = this.filterFocusChain(selector);

    if (chain.length === 0) {
      this.focusWidget(null);
      return null;
    }

    const focusedId = this.deps.getFocusedNodeId();
    const currentIndex =
      focusedId === null ? -1 : chain.findIndex((widget) => widget.nodeId === focusedId);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : chain.length - 1
        : (currentIndex + direction + chain.length) % chain.length;
    const next = chain[nextIndex];

    this.focusWidget(next.nodeId);
    return next;
  }

  resolveFocusTarget(address: FocusAddress | null, allowAutoFocus: boolean): Widget | null {
    const chain = this.getFocusChain();

    if (chain.length === 0) {
      return null;
    }

    if (address !== null) {
      return this.findNearestFocusCandidate(chain, address);
    }

    if (!allowAutoFocus) {
      return null;
    }

    return this.resolveAutoFocusTarget(chain);
  }

  private filterFocusChain(selector?: string | Function): Widget[] {
    const chain = this.getFocusChain();

    if (selector === undefined) {
      return chain;
    }

    if (typeof selector === "function") {
      const typeName = this.deps.resolveWidgetTypeName(selector);
      return chain.filter((widget) => widget.matchesType(typeName));
    }

    const selectors = this.deps.parseSelectors(selector);
    return chain.filter((widget) =>
      selectors.some((candidate) => this.deps.matchesSelector(widget, candidate)),
    );
  }

  ancestorsAllowFocus(widget: Widget): boolean {
    let current = widget.parent;

    while (current !== undefined) {
      if (!current.allowFocusChildren()) {
        return false;
      }

      current = current.parent;
    }

    return true;
  }

  private isNodeWithin(widget: Widget | undefined, ancestor: Widget): boolean {
    let current = widget;

    while (current !== undefined) {
      if (current.nodeId === ancestor.nodeId) {
        return true;
      }

      current = current.parent;
    }

    return false;
  }

  private resolveAutoFocusTarget(chain: Widget[]): Widget | null {
    const selector = this.getEffectiveAutoFocusSelector();

    if (selector === null || selector === "") {
      return null;
    }

    if (selector === "*") {
      return chain[0] ?? null;
    }

    const selectors = this.deps.parseSelectors(selector);
    return (
      chain.find((widget) =>
        selectors.some((candidate) => this.deps.matchesSelector(widget, candidate)),
      ) ?? null
    );
  }

  resolveExactFocusTarget(address: FocusAddress): Widget | null {
    const chain = this.getFocusChain();

    for (const widget of chain) {
      if (focusAddressesEqual(address, this.captureFocusAddress(widget))) {
        return widget;
      }
    }

    return null;
  }

  private getEffectiveAutoFocusSelector(): string | null {
    const screen = this.deps.getActiveScreen();

    if (screen?.autoFocus === "") {
      return "";
    }

    if (screen?.autoFocus !== null && screen?.autoFocus !== undefined) {
      return screen.autoFocus;
    }

    return this.deps.getAppAutoFocus();
  }

  private findNearestFocusCandidate(chain: Widget[], address: FocusAddress): Widget | null {
    let best: Widget | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const widget of chain) {
      const distance = focusAddressDistance(address, this.captureFocusAddress(widget));

      if (distance < bestDistance) {
        best = widget;
        bestDistance = distance;
      }
    }

    return best;
  }
}

export function focusAddressDistance(left: FocusAddress, right: FocusAddress): number {
  let shared = 0;
  const shortestLength = Math.min(left.path.length, right.path.length);

  while (shared < shortestLength && left.path[shared] === right.path[shared]) {
    shared += 1;
  }

  const siblingDistance =
    shared < left.path.length && shared < right.path.length
      ? Math.abs(left.path[shared] - right.path[shared])
      : 0;

  return siblingDistance + (left.path.length - shared) + (right.path.length - shared);
}

export function focusAddressesEqual(left: FocusAddress, right: FocusAddress): boolean {
  return (
    left.widgetId === right.widgetId &&
    left.typeName === right.typeName &&
    left.path.length === right.path.length &&
    left.path.every((segment, index) => segment === right.path[index])
  );
}
