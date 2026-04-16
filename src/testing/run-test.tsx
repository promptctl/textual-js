import React from "react";
import { render } from "ink-testing-library";

import { TextualApp } from "../app/textual-app.js";
import { TextualFramework } from "../framework/app-framework.js";

export class Pilot {
  constructor(
    private readonly framework: TextualFramework,
    private readonly instance: ReturnType<typeof render>,
  ) {}

  press(key: string): void {
    this.instance.stdin.write(key);
    this.framework.postKey(key);
  }

  click(x: number, y: number): void {
    this.framework.postClick(x, y);
  }

  resize(width: number, height: number): void {
    this.framework.postResize(width, height);
  }

  async pause(): Promise<void> {
    await this.framework.whenIdle();
    await Promise.resolve();
  }
}

export interface TestSession {
  framework: TextualFramework;
  pilot: Pilot;
  cleanup: () => void;
  lastFrame: () => string | undefined;
  instance: ReturnType<typeof render>;
}

export function runTest(component: React.ReactElement): TestSession {
  let readyFramework: TextualFramework | null = null;
  const instance = render(
    <TextualApp
      onReady={(framework) => {
        readyFramework = framework;
      }}
    >
      {component}
    </TextualApp>,
  );

  if (readyFramework === null) {
    throw new Error("TextualApp did not expose a framework instance");
  }

  return {
    framework: readyFramework,
    pilot: new Pilot(readyFramework, instance),
    cleanup: () => {
      instance.unmount();
      instance.cleanup();
    },
    lastFrame: instance.lastFrame,
    instance,
  };
}
