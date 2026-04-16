import React from "react";
import { render } from "ink-testing-library";

import { Click, MouseDown, MouseMove, MouseUp } from "../events/events.js";
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
}

type AppInput = React.ReactElement | React.ComponentType<Record<string, unknown>>;
type PointerTarget = string | WidgetNode | React.ComponentType<unknown> | undefined;

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
  constructor(private readonly framework: TextualFramework) {}

  async press(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.framework.postKey(key);
      await this.pause();
    }
  }

  async type(text: string): Promise<void> {
    await this.press(...Array.from(text));
  }

  async mouseDown(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    return this.dispatchPointer("down", target, y);
  }

  async mouseUp(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    return this.dispatchPointer("up", target, y);
  }

  async hover(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    return this.dispatchPointer("move", target, y);
  }

  async click(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    const resolved = this.resolvePointerTarget(target, y);
    await this.mouseDown(target, y);
    await this.mouseUp(target, y);

    if (resolved.targetNode !== undefined) {
      this.framework.postMessage(resolved.targetNode.nodeId, new Click(resolved.x, resolved.y));
    } else {
      this.framework.postClick(resolved.x, resolved.y);
    }

    await this.pause();
    return true;
  }

  async doubleClick(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    const first = await this.click(target, y);
    const second = await this.click(target, y);
    return first && second;
  }

  async tripleClick(target?: PointerTarget | { offset?: { x: number; y: number } }, y?: number): Promise<boolean> {
    const first = await this.click(target, y);
    const second = await this.click(target, y);
    const third = await this.click(target, y);
    return first && second && third;
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
    target?: PointerTarget | { offset?: { x: number; y: number } },
    y?: number,
  ): Promise<boolean> {
    const resolved = this.resolvePointerTarget(target, y);

    if (kind === "down") {
      if (resolved.targetNode !== undefined) {
        this.framework.postMessage(resolved.targetNode.nodeId, new MouseDown(resolved.x, resolved.y));
      } else {
        this.framework.postMouseDown(resolved.x, resolved.y);
      }
    } else if (kind === "up") {
      if (resolved.targetNode !== undefined) {
        this.framework.postMessage(resolved.targetNode.nodeId, new MouseUp(resolved.x, resolved.y));
      } else {
        this.framework.postMouseUp(resolved.x, resolved.y);
      }
    } else if (resolved.targetNode !== undefined) {
      this.framework.postMessage(resolved.targetNode.nodeId, new MouseMove(resolved.x, resolved.y));
    } else {
      this.framework.postMouseMove(resolved.x, resolved.y);
    }

    await this.pause();
    return true;
  }

  private resolvePointerTarget(
    target?: PointerTarget | { offset?: { x: number; y: number } },
    y?: number,
  ): { x: number; y: number; targetNode?: WidgetNode } {
    if (typeof target === "number") {
      this.assertBounds(target, y ?? 0);
      return { x: target, y: y ?? 0 };
    }

    const offset = typeof target === "object" && target !== null && "offset" in target ? target.offset : undefined;

    if (offset !== undefined) {
      this.assertBounds(offset.x, offset.y);
      return { x: offset.x, y: offset.y };
    }

    if (target === undefined) {
      return { x: 0, y: 0 };
    }

    const targetNode = this.resolveTargetNode(target as Exclude<PointerTarget, undefined>);
    return { x: 0, y: 0, targetNode };
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
}

export interface TestSession {
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
  const unsubscribeMessageHook =
    options.messageHook === undefined ? undefined : framework.subscribeToMessages(options.messageHook);
  const instance = render(
    <TextualApp framework={framework}>
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
