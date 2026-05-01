// [LAW:single-enforcer] PointerEngine is the sole owner of pointer dispatch
// (down/up/move/click), hit-testing, click-chain timing, pending-press
// bookkeeping, and hovered-node tracking. The framework orchestrator triggers
// cross-cutting effects (tooltip refresh, style recalc, focus changes,
// pointer-shape updates, message posting) through a narrow injected deps
// interface — the engine never reaches back into TextualFramework directly.
// [LAW:one-source-of-truth] hoveredNodeId, lastPointerLocation,
// pendingPointerClick, and lastClickChain live in exactly one place: this
// engine. The framework reads these as the canonical source for tooltip and
// hover-derived behavior.
// [LAW:one-way-deps] The engine depends only on a narrow PointerEngineDeps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import { autoObservable } from "./auto-observable.js";

import type { Widget } from "./widget.js";
import type { Message } from "../events/message.js";
import { Click, MouseDown, MouseMove, MouseUp } from "../events/events.js";

export interface PointerLocation {
  x: number;
  y: number;
}

export interface PendingPointerClick {
  targetId: string | null;
  canceled: boolean;
  downTime: number;
}

export interface ClickChainState {
  targetId: string | null;
  chain: number;
  time: number;
}

export interface ResolvedPointerTarget {
  x: number;
  y: number;
  targetNode?: Widget;
}

// [LAW:one-way-deps] Narrow capability interface the engine requires from its
// host (typically TextualFramework). The engine never imports the host class.
export interface PointerEngineDeps {
  listWidgets(): Widget[];
  getWidget(nodeId: string): Widget | undefined;
  getRootChildren(): Widget[];
  resolveDefaultDispatchTarget(): Widget | undefined;
  ancestorsAllowFocus(widget: Widget): boolean;
  postMessage(targetId: string, message: Message): boolean;
  focusWidget(nodeId: string | null): void;
  recalculateStyles(): void;
  setPointerShape(shape: string): void;
  // Called whenever the hovered node changes (including transitions to/from
  // null). The framework uses this to refresh tooltip state.
  onHoverChanged(previousNodeId: string | null, nextNodeId: string | null): void;
  // Called when pointer moves but hover target did not change. The framework
  // uses this to track the active tooltip's pointer position.
  onPointerMovedSameHover(pointer: PointerLocation): void;
  // Multi-click time threshold in seconds (mirrors Textual's
  // CLICK_CHAIN_TIME_THRESHOLD).
  clickChainTimeThreshold: number;
}

export class PointerEngine {
  hoveredNodeId: string | null = null;
  lastPointerLocation: PointerLocation | null = null;
  private pendingPointerClick: PendingPointerClick | null = null;
  private lastClickChain: ClickChainState | null = null;
  private readonly deps: PointerEngineDeps;

  constructor(deps: PointerEngineDeps) {
    this.deps = deps;
    autoObservable(
      this,
      {
        deps: false,
        pendingPointerClick: false,
        lastClickChain: false,
      },
      { autoBind: true },
    );
  }

  // ---- Public dispatch API ----

  dispatchPointerClick(screenX: number, screenY: number, chain = 1): void {
    // [LAW:single-enforcer] Pointer clicks are synthesized from the same
    // down/up path that owns click-chain state instead of a second direct path.
    for (let index = 0; index < Math.max(1, Math.trunc(chain)); index += 1) {
      this.dispatchPointerDown(screenX, screenY);
      this.dispatchPointerUp(screenX, screenY);
    }
  }

  dispatchPointerDown(screenX: number, screenY: number): void {
    const resolved = this.resolvePointerTarget(screenX, screenY);
    const dispatchTarget = this.resolvePointerDispatchTarget(resolved.targetNode);
    const dispatched = this.postResolvedPointerMessage(
      dispatchTarget,
      resolved,
      (x, y) => new MouseDown(x, y),
    );
    const focusTarget = this.resolvePointerFocusTarget(resolved.targetNode);

    if (focusTarget !== undefined) {
      this.deps.focusWidget(focusTarget.nodeId);
    }

    // [LAW:one-source-of-truth] The active press target and down timestamp live
    // in one engine-owned record so MouseUp and MouseMove derive click state
    // from the same canonical snapshot.
    this.pendingPointerClick =
      dispatched === undefined
        ? null
        : {
            targetId: dispatched.nodeId,
            canceled: false,
            downTime: Date.now(),
          };
  }

  dispatchPointerUp(screenX: number, screenY: number): void {
    const resolved = this.resolvePointerTarget(screenX, screenY);
    const dispatchTarget = this.resolvePointerDispatchTarget(resolved.targetNode);
    const pendingClick = this.pendingPointerClick;

    this.postResolvedPointerMessage(dispatchTarget, resolved, (x, y) => new MouseUp(x, y));
    this.pendingPointerClick = null;

    if (
      dispatchTarget !== undefined &&
      pendingClick !== null &&
      !pendingClick.canceled &&
      pendingClick.targetId === dispatchTarget.nodeId
    ) {
      const clickChain = this.resolveClickChain(dispatchTarget.nodeId, pendingClick.downTime);
      this.postResolvedPointerMessage(dispatchTarget, resolved, (x, y) => new Click(x, y, clickChain));
    }
  }

  dispatchPointerMove(screenX: number, screenY: number): void {
    const pointer = { x: screenX, y: screenY };
    const resolved = this.resolvePointerTarget(screenX, screenY);
    const dispatchTarget = this.resolvePointerDispatchTarget(resolved.targetNode);

    this.lastPointerLocation = pointer;
    this.updateHoveredNode(resolved.targetNode, pointer);
    this.markPendingPointerClick(dispatchTarget);
    this.postResolvedPointerMessage(dispatchTarget, resolved, (x, y) => new MouseMove(x, y));
  }

  hitTest(screenX: number, screenY: number): Widget | undefined {
    const widgets = this.deps.listWidgets();
    const candidates = widgets.filter(
      (widget) =>
        widget.isInteractive &&
        !widget.visibleScreenRegion.isEmpty &&
        widget.visibleScreenRegion.contains(screenX, screenY),
    );

    return candidates
      .sort((left, right) => {
        const depthDifference = widgetDepth(left) - widgetDepth(right);

        if (depthDifference !== 0) {
          return depthDifference;
        }

        return widgets.indexOf(left) - widgets.indexOf(right);
      })
      .at(-1);
  }

  // ---- Lifecycle hooks invoked by the framework orchestrator ----

  // Returns information about hover state at the last known pointer location.
  // The framework calls this after layout changes to decide whether tooltip
  // state needs updating. The engine mutates hoveredNodeId in place; the
  // framework owns the cross-cutting effects (tooltip hide, recalc styles).
  recomputeHoverFromLastPointer(): {
    hadPointer: boolean;
    hoveredChanged: boolean;
    nextHoveredNodeId: string | null;
    hit: Widget | undefined;
  } {
    if (this.lastPointerLocation === null) {
      return { hadPointer: false, hoveredChanged: false, nextHoveredNodeId: null, hit: undefined };
    }

    const hit = this.hitTest(this.lastPointerLocation.x, this.lastPointerLocation.y);
    const nextHoveredNodeId = hit?.nodeId ?? null;
    const hoveredChanged = this.hoveredNodeId !== nextHoveredNodeId;

    if (hoveredChanged) {
      this.hoveredNodeId = nextHoveredNodeId;
    }

    return { hadPointer: true, hoveredChanged, nextHoveredNodeId, hit };
  }

  // Returns true if the hovered node was non-null before clearing (so the
  // framework knows whether to recalc styles). The framework owns tooltip
  // cleanup separately.
  clearPointerState(): boolean {
    const hoveredChanged = this.hoveredNodeId !== null;

    this.hoveredNodeId = null;
    this.lastPointerLocation = null;

    if (hoveredChanged) {
      this.deps.recalculateStyles();
    }

    return hoveredChanged;
  }

  // Reset all pointer-engine state. Used on shutdown.
  reset(): void {
    this.hoveredNodeId = null;
    this.lastPointerLocation = null;
    this.pendingPointerClick = null;
    this.lastClickChain = null;
  }

  // Called when a widget is about to unmount; clears hovered reference if it
  // matches. Tooltip cleanup remains on the framework.
  forgetWidgetHover(nodeId: string): boolean {
    if (this.hoveredNodeId === nodeId) {
      this.hoveredNodeId = null;
      return true;
    }
    return false;
  }

  // ---- Private helpers ----

  private resolvePointerTarget(screenX: number, screenY: number): ResolvedPointerTarget {
    const targetNode = this.hitTest(screenX, screenY);

    if (targetNode === undefined) {
      return { x: screenX, y: screenY };
    }

    return {
      x: screenX - targetNode.effectiveScreenRegion.x,
      y: screenY - targetNode.effectiveScreenRegion.y,
      targetNode,
    };
  }

  private resolvePointerDispatchTarget(targetNode: Widget | undefined): Widget | undefined {
    return targetNode ?? this.resolveActiveScreenRootTarget() ?? this.deps.resolveDefaultDispatchTarget();
  }

  private resolveActiveScreenRootTarget(): Widget | undefined {
    return this.deps.getRootChildren().find((widget) => widget.isInteractive);
  }

  private resolvePointerFocusTarget(targetNode: Widget | undefined): Widget | undefined {
    // [LAW:single-enforcer] Disabled/loading pointer focus gating shares the
    // pointer boundary with event suppression instead of widget code.
    if (targetNode?.isDisabledEffective || targetNode?.isLoadingEffective) {
      return undefined;
    }

    let current = targetNode;

    while (current !== undefined) {
      if (this.deps.ancestorsAllowFocus(current) && current.allowFocus()) {
        return current;
      }

      current = current.parent;
    }

    return undefined;
  }

  private postResolvedPointerMessage(
    dispatchTarget: Widget | undefined,
    resolved: ResolvedPointerTarget,
    createMessage: (x: number, y: number) => Message,
  ): Widget | undefined {
    if (dispatchTarget === undefined) {
      return undefined;
    }

    const coordinates = resolved.targetNode === undefined ? { x: resolved.x, y: resolved.y } : resolved;
    return this.deps.postMessage(dispatchTarget.nodeId, createMessage(coordinates.x, coordinates.y))
      ? dispatchTarget
      : undefined;
  }

  private markPendingPointerClick(dispatchTarget: Widget | undefined): void {
    const pendingClick = this.pendingPointerClick;

    if (
      pendingClick !== null &&
      !pendingClick.canceled &&
      pendingClick.targetId !== (dispatchTarget?.nodeId ?? null)
    ) {
      pendingClick.canceled = true;
    }
  }

  private resolveClickChain(targetId: string, mouseDownTime: number): number {
    const thresholdMs = this.deps.clickChainTimeThreshold * 1000;
    const previousClick = this.lastClickChain;
    const chain =
      previousClick !== null &&
      previousClick.targetId === targetId &&
      mouseDownTime - previousClick.time <= thresholdMs
        ? previousClick.chain + 1
        : 1;

    // [LAW:single-enforcer] Multi-click timing and same-target matching are
    // derived at the pointer forwarding boundary so widgets read one canonical
    // chain value from Click instead of re-implementing double-click logic.
    this.lastClickChain = {
      targetId,
      chain,
      time: Date.now(),
    };
    return chain;
  }

  private updateHoveredNode(targetNode: Widget | undefined, pointer: PointerLocation): void {
    const nextHoveredNodeId = targetNode?.nodeId ?? null;
    const previousHoveredNodeId = this.hoveredNodeId;
    const hoveredChanged = previousHoveredNodeId !== nextHoveredNodeId;

    this.lastPointerLocation = pointer;
    // [LAW:one-source-of-truth] The hovered widget's resolved pointer rule is
    // the canonical cursor-shape source; the app-level pointerShape derives from it.
    this.deps.setPointerShape(targetNode?.resolvedStyles.getRule<string>("pointer") ?? "default");

    if (hoveredChanged) {
      this.hoveredNodeId = nextHoveredNodeId;
      this.deps.recalculateStyles();
      this.deps.onHoverChanged(previousHoveredNodeId, nextHoveredNodeId);
      return;
    }

    this.deps.onPointerMovedSameHover(pointer);
  }
}

function widgetDepth(widget: Widget): number {
  let depth = 0;
  let current = widget.parent;

  while (current !== undefined) {
    depth += 1;
    current = current.parent;
  }

  return depth;
}
