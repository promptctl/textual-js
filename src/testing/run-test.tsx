import React from "react";
import { render } from "ink-testing-library";

import type { Message } from "../events/message.js";
import { TextualApp } from "../app/textual-app.js";
import { TextualFramework } from "../framework/app-framework.js";
import type { WidgetNode } from "../framework/widget-node.js";

export class OutOfBounds extends Error {}

export class PilotTargetNotFound extends Error {}

export interface RunTestOptions {
  size?: { width: number; height: number };
  props?: Record<string, unknown>;
  messageHook?: (message: Message) => void;
  transients?: {
    tooltips?: boolean;
    notifications?: boolean;
  };
}

type AppInput = React.ReactElement | React.ComponentType<Record<string, unknown>>;
type PointerTarget = string | WidgetNode | React.ComponentType<unknown> | undefined;
type PointerOffset = { x: number; y: number };
type PointerInput = PointerTarget | number | PointerOptions | undefined;
const CLICK_CHAIN_WINDOW_MS = 500;

export interface PointerOptions {
  widget?: PointerTarget;
  offset?: PointerOffset;
  times?: number;
}

interface ResolvedPointerTarget {
  screenX: number;
  screenY: number;
  x: number;
  y: number;
  targetNode?: WidgetNode;
  hitIntendedTarget: boolean;
}

export function camelToSnake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function resolveComponent(input: AppInput, props: Record<string, unknown>): React.ReactElement {
  if (React.isValidElement(input)) {
    return input;
  }

  return React.createElement(input as React.ComponentType<Record<string, unknown>>, props);
}

function isWidgetNode(target: PointerTarget): target is WidgetNode {
  return typeof target === "object" && target !== null && "nodeId" in target;
}

function readTypeName(target: React.ComponentType<unknown>): string {
  return target.displayName ?? target.name;
}

export class Pilot {
  private lastClick: { key: string; chain: number; time: number } | null = null;

  constructor(private readonly framework: TextualFramework) {}

  toString(): string {
    return `<Pilot app=${this.framework.constructor.name}>`;
  }

  async press(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.framework.postKey(key);
      await this.pause();
    }
  }

  async type(text: string): Promise<void> {
    await this.press(...Array.from(text));
  }

  async mouseDown(target?: PointerInput, y?: number): Promise<boolean> {
    return this.dispatchPointer("down", target, y);
  }

  async mouseUp(target?: PointerInput, y?: number): Promise<boolean> {
    return this.dispatchPointer("up", target, y);
  }

  async hover(target?: PointerInput, y?: number): Promise<boolean> {
    return this.dispatchPointer("move", target, y);
  }

  async click(target?: PointerInput, y?: number): Promise<boolean> {
    const resolved = this.resolvePointerTarget(target, y);
    const options = isPointerOptions(target) ? target : undefined;
    const times = normalizeClickCount(options?.times);

    // [LAW:dataflow-not-control-flow] Repeated clicks reuse the exact same
    // dispatch pipeline; the repeat count is data, not a separate code path.
    for (let index = 0; index < times; index += 1) {
      await this.dispatchResolvedPointer("down", resolved);
      await this.dispatchResolvedPointer("up", resolved);
      await this.dispatchResolvedPointer("click", resolved, this.resolveClickChain(resolved));
    }

    return resolved.hitIntendedTarget;
  }

  async doubleClick(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    return this.click(normalizeRepeatedClickTarget(target, 2), y);
  }

  async tripleClick(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    return this.click(normalizeRepeatedClickTarget(target, 3), y);
  }

  async resize(width: number, height: number): Promise<void> {
    await this.resizeTerminal(width, height);
  }

  async resizeTerminal(width: number, height: number): Promise<void> {
    this.framework.postResize(width, height);
    await this.pause();
  }

  async pause(delay = 0): Promise<void> {
    await this.framework.whenIdle();

    if (delay > 0) {
      await sleep(delay);
      await this.framework.whenIdle();
    }
  }

  async waitForAnimation(): Promise<void> {
    await this.pause();
  }

  async waitForScheduledAnimations(): Promise<void> {
    await this.pause();
  }

  async exit(result?: unknown): Promise<unknown> {
    await this.pause();
    return this.framework.exit(result);
  }

  private async dispatchPointer(
    kind: "down" | "up" | "move",
    target?: PointerInput,
    y?: number,
  ): Promise<boolean> {
    const resolved = this.resolvePointerTarget(target, y);
    await this.dispatchResolvedPointer(kind, resolved);
    return resolved.hitIntendedTarget;
  }

  private async dispatchResolvedPointer(
    kind: "down" | "up" | "move" | "click",
    resolved: ResolvedPointerTarget,
    clickChain = 1,
  ): Promise<void> {
    if (kind === "down") {
      this.framework.dispatchPointerDown(resolved.screenX, resolved.screenY);
    } else if (kind === "up") {
      this.framework.dispatchPointerUp(resolved.screenX, resolved.screenY);
    } else if (kind === "move") {
      this.framework.dispatchPointerMove(resolved.screenX, resolved.screenY);
    } else {
      this.framework.dispatchPointerClick(resolved.screenX, resolved.screenY, clickChain);
    }

    await this.pause();
  }

  private resolvePointerTarget(
    target?: PointerInput,
    y?: number,
  ): ResolvedPointerTarget {
    if (typeof target === "number") {
      const absoluteX = target;
      const absoluteY = y ?? 0;
      this.assertBounds(absoluteX, absoluteY);
      return this.resolveHitAtPoint(undefined, absoluteX, absoluteY);
    }

    const options = isPointerOptions(target) ? target : undefined;
    const intendedTarget = options === undefined ? target : options.widget;
    const offset = options?.offset;

    if (intendedTarget === undefined) {
      const absoluteX = offset?.x ?? 0;
      const absoluteY = offset?.y ?? 0;
      this.assertBounds(absoluteX, absoluteY);
      return this.resolveHitAtPoint(undefined, absoluteX, absoluteY);
    }

    const intendedNode = this.resolveTargetNode(intendedTarget as Exclude<PointerTarget, undefined>);
    this.assertTargetRegionIsReachable(intendedNode);
    const absoluteX = intendedNode.screenRegion.x + (offset?.x ?? defaultPointerCoordinate(intendedNode.screenRegion.width));
    const absoluteY = intendedNode.screenRegion.y + (offset?.y ?? defaultPointerCoordinate(intendedNode.screenRegion.height));
    this.assertBounds(absoluteX, absoluteY);
    return this.resolveHitAtPoint(intendedNode, absoluteX, absoluteY);
  }

  private resolveClickChain(resolved: ResolvedPointerTarget): number {
    const key = resolved.targetNode?.nodeId ?? `${resolved.x}:${resolved.y}`;
    const now = Date.now();
    const chain =
      this.lastClick !== null &&
      this.lastClick.key === key &&
      now - this.lastClick.time <= CLICK_CHAIN_WINDOW_MS
        ? this.lastClick.chain + 1
        : 1;

    // [LAW:one-source-of-truth] Click-chain state is tracked in one place so
    // double and triple clicks are derived uniformly across all pilot helpers.
    this.lastClick = { key, chain, time: now };
    return chain;
  }

  private resolveTargetNode(target: Exclude<PointerTarget, undefined>): WidgetNode {
    if (isWidgetNode(target)) {
      return target;
    }

    if (typeof target === "string") {
      const [match] = target.startsWith("#")
        ? this.framework.findWidgets(target)
        : this.framework.registry.list().filter((widget) => widget.typeName === target);

      if (match !== undefined) {
        return match;
      }
    } else {
      const typeName = readTypeName(target);
      const match = this.framework.registry.list().find((widget) => widget.typeName === typeName);

      if (match !== undefined) {
        return match;
      }
    }

    throw new PilotTargetNotFound("No widget found for the requested target");
  }

  private assertBounds(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.framework.terminalSize.width || y >= this.framework.terminalSize.height) {
      throw new OutOfBounds(`Pointer target (${x}, ${y}) is outside the terminal bounds`);
    }
  }

  private assertTargetRegionIsReachable(target: WidgetNode): void {
    const visibleRegion = target.screenRegion.clip(this.framework.terminalSize.width, this.framework.terminalSize.height);

    // [LAW:single-enforcer] Pointer reachability is validated at this boundary
    // so all selector/class/instance targeting shares one out-of-bounds rule.
    if (visibleRegion.isEmpty) {
      throw new OutOfBounds(`Widget "${target.typeName}" is outside the visible screen region`);
    }
  }

  private resolveHitAtPoint(
    intendedNode: WidgetNode | undefined,
    absoluteX: number,
    absoluteY: number,
  ): ResolvedPointerTarget {
    const targetNode = this.framework.hitTest(absoluteX, absoluteY);
    const localX = targetNode === undefined ? absoluteX : absoluteX - targetNode.screenRegion.x;
    const localY = targetNode === undefined ? absoluteY : absoluteY - targetNode.screenRegion.y;

    return {
      screenX: absoluteX,
      screenY: absoluteY,
      x: localX,
      y: localY,
      targetNode,
      hitIntendedTarget: intendedNode === undefined ? true : targetNode?.nodeId === intendedNode.nodeId,
    };
  }
}

function isPointerOptions(target: PointerInput): target is PointerOptions {
  return typeof target === "object" && target !== null && ("widget" in target || "offset" in target || "times" in target);
}

function normalizeRepeatedClickTarget(
  target: PointerTarget | { offset?: { x: number; y: number } } | undefined,
  times: number,
): PointerOptions {
  if (isPointerOptions(target)) {
    return { ...target, times };
  }

  return { widget: target as PointerTarget, times };
}

function normalizeClickCount(times: number | undefined): number {
  if (times === undefined) {
    return 1;
  }

  return Number.isFinite(times) ? Math.max(1, Math.trunc(times)) : 1;
}

function defaultPointerCoordinate(size: number): number {
  return size <= 0 ? 0 : Math.floor((size - 1) / 2);
}

export interface TestSession {
  app: TextualFramework;
  framework: TextualFramework;
  pilot: Pilot;
  cleanup: () => void;
  unmount: () => void;
  lastFrame: () => string | undefined;
  instance: ReturnType<typeof render>;
  readonly result: unknown;
}

export async function runTest(component: AppInput, options: RunTestOptions = {}): Promise<TestSession> {
  const framework = new TextualFramework();
  framework.setShowNotifications(options.transients?.notifications ?? false);
  const unsubscribeMessageHook =
    options.messageHook === undefined ? undefined : framework.subscribeToMessages(options.messageHook);
  const instance = render(
    <TextualApp framework={framework} showTooltips={options.transients?.tooltips ?? false}>
      {resolveComponent(component, options.props ?? {})}
    </TextualApp>,
  );

  const size = options.size ?? { width: 80, height: 24 };
  framework.postResize(size.width, size.height);
  await framework.whenIdle();

  const unmount = (): void => {
    unsubscribeMessageHook?.();
    instance.unmount();
    instance.cleanup();
  };

  return {
    app: framework,
    framework,
    pilot: new Pilot(framework),
    cleanup: unmount,
    unmount,
    lastFrame: instance.lastFrame,
    instance,
    get result() {
      return framework.exitResult;
    },
  };
}
