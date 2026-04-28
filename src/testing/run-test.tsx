import React from "react";
import { render } from "ink-testing-library";

import type { Message } from "../events/message.js";
import { App } from "../app/app.js";
import { TextualApp, type TextualAppProps } from "../app/textual-app.js";
import { Size } from "../geometry/index.js";
import type { Widget } from "../framework/widget.js";

export class OutOfBounds extends Error {}

export class PilotTargetNotFound extends Error {}

export interface RunTestOptions {
  size?: { width: number; height: number };
  props?: Record<string, unknown>;
  appProps?: Partial<TextualAppProps>;
  messageHook?: (message: Message) => void;
  transients?: {
    tooltips?: boolean;
    notifications?: boolean;
  };
}

type AppInput = React.ReactElement | React.ComponentType<Record<string, unknown>>;
type PointerTarget = string | Widget | React.ComponentType<unknown> | undefined;
type PointerOffset = { x: number; y: number };
type PointerInput = PointerTarget | number | PointerOptions | undefined;

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
  targetNode?: Widget;
  hitIntendedTarget: boolean;
}

interface ResolvedWidgetPointerRegion {
  effectiveRegion: Widget["effectiveScreenRegion"];
  visibleRegion: Widget["visibleScreenRegion"];
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

function isWidget(target: PointerTarget): target is Widget {
  return typeof target === "object" && target !== null && "nodeId" in target;
}

function readTypeName(target: React.ComponentType<unknown>): string {
  return target.displayName ?? target.name;
}

class TestErrorBoundary extends React.Component<React.PropsWithChildren<{ app: App }>, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    // [LAW:single-enforcer] Test-time render/compose failures are captured at
    // one boundary so runTest observes the same exception path for initial
    // render and later screen swaps instead of relying on Ink internals.
    this.props.app.framework.reportUnhandledError(error);
  }

  render(): React.ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

// [LAW:one-source-of-truth] Pilot drives App, not the framework directly.
// App's public methods (postKey, exit, findWidgets, terminalSize) are the
// driver's vocabulary. Test-only mechanics (raw pointer dispatch, hit-test,
// terminal-size override) reach the framework via `app.framework` because
// the audit categorized those as internal-only — they will not migrate to
// App's public surface.
export class Pilot {
  constructor(private readonly app: App) {}

  toString(): string {
    return `<Pilot app=${this.app.constructor.name}>`;
  }

  async press(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.app.postKey(key);
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
    await this.pause();
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
    this.app.framework.setControlledTerminalSize(new Size(width, height));
    this.app.framework.postResize(width, height);
    await this.pause();
  }

  async pause(delay?: number): Promise<void> {
    await settleApp(this.app);

    if (delay !== undefined) {
      await sleep(Math.max(0, delay) * 1000);
      await settleApp(this.app);
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
    return this.app.exit(result);
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
    kind: "down" | "up" | "move",
    resolved: ResolvedPointerTarget,
  ): Promise<void> {
    if (kind === "down") {
      this.app.framework.dispatchPointerDown(resolved.screenX, resolved.screenY);
    } else if (kind === "up") {
      this.app.framework.dispatchPointerUp(resolved.screenX, resolved.screenY);
    } else {
      this.app.framework.dispatchPointerMove(resolved.screenX, resolved.screenY);
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
    const resolvedRegion = this.assertTargetRegionIsReachable(intendedNode);
    const absoluteX =
      offset?.x === undefined
        ? resolvedRegion.visibleRegion.x + defaultPointerCoordinate(resolvedRegion.visibleRegion.width)
        : resolvedRegion.effectiveRegion.x + offset.x;
    const absoluteY =
      offset?.y === undefined
        ? resolvedRegion.visibleRegion.y + defaultPointerCoordinate(resolvedRegion.visibleRegion.height)
        : resolvedRegion.effectiveRegion.y + offset.y;
    this.assertReachableCoordinate(absoluteX, absoluteY, resolvedRegion.visibleRegion);
    return this.resolveHitAtPoint(intendedNode, absoluteX, absoluteY);
  }

  private resolveTargetNode(target: Exclude<PointerTarget, undefined>): Widget {
    if (isWidget(target)) {
      return target;
    }

    if (typeof target === "string") {
      const [match] = target.startsWith("#")
        ? this.app.findWidgets(target)
        : this.app.framework.registry.list().filter((widget) => widget.typeName === target);

      if (match !== undefined) {
        return match;
      }
    } else {
      const typeName = readTypeName(target);
      const match = this.app.framework.registry.list().find((widget) => widget.typeName === typeName);

      if (match !== undefined) {
        return match;
      }
    }

    throw new PilotTargetNotFound("No widget found for the requested target");
  }

  private assertBounds(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.app.terminalSize.width || y >= this.app.terminalSize.height) {
      throw new OutOfBounds(`Pointer target (${x}, ${y}) is outside the terminal bounds`);
    }
  }

  private assertTargetRegionIsReachable(target: Widget): ResolvedWidgetPointerRegion {
    const visibleRegion = target.visibleScreenRegion;

    // [LAW:single-enforcer] Pointer reachability is validated at this boundary
    // so all selector/class/instance targeting shares one out-of-bounds rule.
    if (visibleRegion.isEmpty) {
      throw new OutOfBounds(`Widget "${target.typeName}" is outside the visible screen region`);
    }

    return {
      effectiveRegion: target.effectiveScreenRegion,
      visibleRegion,
    };
  }

  private assertReachableCoordinate(x: number, y: number, visibleRegion: Widget["visibleScreenRegion"]): void {
    this.assertBounds(x, y);

    if (!visibleRegion.contains(x, y)) {
      throw new OutOfBounds(`Pointer target (${x}, ${y}) is outside the visible widget region`);
    }
  }

  private resolveHitAtPoint(
    intendedNode: Widget | undefined,
    absoluteX: number,
    absoluteY: number,
  ): ResolvedPointerTarget {
    const targetNode = this.app.framework.hitTest(absoluteX, absoluteY);
    const localX = targetNode === undefined ? absoluteX : absoluteX - targetNode.effectiveScreenRegion.x;
    const localY = targetNode === undefined ? absoluteY : absoluteY - targetNode.effectiveScreenRegion.y;

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

async function settleApp(app: App): Promise<void> {
  // [LAW:single-enforcer] Test settling iterates until the app reaches a
  // fixed point. Each Mount dispatch can flip a widget's lifecycleReady,
  // which (via mobx-react observers) schedules a React render; that render
  // mounts the next layer of children, whose useLayoutEffect runs
  // registerWidget and enqueues fresh Mount messages. We loop until two
  // consecutive snapshots agree on the (id, width, height) tuple of every
  // registered widget — so layout has measured every descendant before the
  // test exercises hit-tests or the rendered frame.
  let previousSignature: string | null = null;
  for (let iteration = 0; iteration < 50; iteration += 1) {
    await app.whenIdle();
    // Yield through several microtasks. mobx-react-lite's useSyncExternalStore
    // flips an internal version on observable mutation, and React processes
    // the resulting render in the next microtask round. Avoid setTimeout
    // here: tests using vi.useFakeTimers would hang on a mocked timer.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    // Re-sync layout readers so widget regions reflect the latest Ink
    // measurement after staged child mounts. Without this, parent regions
    // captured before children rendered remain stale.
    app.framework.recordDisplayPass();
    const widgets = app.findWidgets("*");
    const signature = widgets
      .map((w) => `${w.nodeId}:${w.screenRegion.width}x${w.screenRegion.height}`)
      .sort()
      .join("|");
    if (signature === previousSignature) {
      app.framework.throwPendingError();
      return;
    }
    previousSignature = signature;
  }
  throw new Error("settleApp: app never reached a fixed point in 50 iterations");
}

// [LAW:one-source-of-truth] App is the test session's primary handle.
// `framework` is retained as a read-only peer typed via App["framework"]
// so existing tests that touch internal mechanics continue to compile
// without this file directly importing TextualFramework. Future tickets
// retire those test usages as their underlying production-source bypasses
// migrate to App's public surface or are re-homed in Phase 7.
export interface TestSession {
  app: App;
  framework: App["framework"];
  pilot: Pilot;
  cleanup: () => void;
  unmount: () => void;
  lastFrame: () => string | undefined;
  instance: ReturnType<typeof render>;
  readonly result: unknown;
}

export async function runTestRoot(
  root: React.ReactElement,
  app: App,
  options: RunTestOptions = {},
): Promise<TestSession> {
  const size = options.size ?? { width: 80, height: 24 };

  // [LAW:one-source-of-truth] The requested test size is installed on the
  // framework before the first render so mount/layout code observes one
  // canonical terminal dimension instead of a later corrective resize.
  app.framework.setControlledTerminalSize(new Size(size.width, size.height));
  app.framework.setCaptureUnhandledErrors(true);
  app.framework.setShowNotifications(options.transients?.notifications ?? false);
  app.framework.setShowTooltips(options.transients?.tooltips ?? false);
  const unsubscribeMessageHook =
    options.messageHook === undefined ? undefined : app.subscribeToMessages(options.messageHook);
  const instance = render(
    <TestErrorBoundary app={app}>
      {root}
    </TestErrorBoundary>,
  );

  try {
    await settleApp(app);
  } catch (error) {
    unsubscribeMessageHook?.();
    instance.unmount();
    instance.cleanup();
    throw error;
  }

  const unmount = (): void => {
    let thrownError: unknown = null;

    unsubscribeMessageHook?.();

    try {
      instance.unmount();
      instance.cleanup();
    } catch (error) {
      thrownError = error;
    }

    if (thrownError !== null) {
      throw thrownError;
    }

    app.framework.throwPendingError();
  };

  return {
    app,
    framework: app.framework,
    pilot: new Pilot(app),
    cleanup: unmount,
    unmount,
    lastFrame: instance.lastFrame,
    instance,
    get result() {
      return app.returnValue;
    },
  };
}

export async function runTest(component: AppInput, options: RunTestOptions = {}): Promise<TestSession> {
  const app = new App();
  const root = (
    <TextualApp
      {...options.appProps}
      framework={app.framework}
      showTooltips={options.transients?.tooltips ?? false}
    >
      {resolveComponent(component, options.props ?? {})}
    </TextualApp>
  );

  return runTestRoot(root, app, options);
}
