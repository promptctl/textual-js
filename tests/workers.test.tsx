import React, { useLayoutEffect } from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";

import {
  WidgetNode,
  WidgetScope,
  TextualApp,
  TextualFramework,
  WorkerCancelled,
  WorkerFailed,
  WorkerStateChanged,
  getCurrentWorker,
  useWidget,
} from "../src/index.js";

function WorkerHarness(props: {
  onReady: (widget: WidgetNode) => void;
  onStateChange?: (message: WorkerStateChanged) => void;
}): React.JSX.Element {
  const widget = useWidget({
    id: "worker-harness",
    typeName: "WorkerHarness",
    handlers:
      props.onStateChange === undefined
        ? undefined
        : {
            onWorkerStateChanged: (message) => {
              props.onStateChange?.(message as WorkerStateChanged);
            },
          },
  });

  useLayoutEffect(() => {
    props.onReady(widget.handle);
  }, [props, widget.handle]);

  return (
    <WidgetScope widget={widget.handle}>
      <Text>workers</Text>
    </WidgetScope>
  );
}

describe("workers", () => {
  it("tracks lifecycle, progress, current worker context, and manager cleanup", async () => {
    const framework = new TextualFramework();
    const states: string[] = [];
    let widget!: WidgetNode;

    const instance = render(
      <TextualApp framework={framework}>
        <WorkerHarness
          onReady={(value) => {
            widget = value;
          }}
          onStateChange={(message) => {
            states.push(message.state);
          }}
        />
      </TextualApp>,
    );

    await framework.whenIdle();

    const worker = widget.runWorker(async (_signal, currentWorker) => {
      expect(getCurrentWorker()).toBe(currentWorker);
      currentWorker.update(1, 2);
      currentWorker.advance();
      return "done";
    }, { name: "success-worker" });

    await expect(worker.wait()).resolves.toBe("done");
    await framework.whenIdle();
    await framework.workers.waitForComplete();

    expect(worker.progress).toBe(100);
    expect(states).toEqual(["running", "success"]);
    expect(framework.workers.length).toBe(0);

    instance.unmount();
    instance.cleanup();
  });

  it("maps aborts to cancellation and reports failures distinctly", async () => {
    const framework = new TextualFramework();
    const states: string[] = [];
    let widget!: WidgetNode;

    const instance = render(
      <TextualApp framework={framework}>
        <WorkerHarness
          onReady={(value) => {
            widget = value;
          }}
          onStateChange={(message) => {
            states.push(message.state);
          }}
        />
      </TextualApp>,
    );

    await framework.whenIdle();

    const cancellableWorker = widget.runWorker(
      (_signal) =>
        new Promise<string>((_resolve, reject) => {
          _signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
      { name: "cancel-worker" },
    );

    cancellableWorker.cancel();
    await expect(cancellableWorker.wait()).rejects.toBeInstanceOf(WorkerCancelled);

    const failingWorker = widget.runWorker(async () => {
      throw new Error("boom");
    }, { name: "fail-worker" });

    await expect(failingWorker.wait()).rejects.toBeInstanceOf(WorkerFailed);
    await framework.whenIdle();

    expect(states).toContain("cancelled");
    expect(states).toContain("error");

    instance.unmount();
    instance.cleanup();
  });

  it("cancels widget-owned workers on unmount", async () => {
    const framework = new TextualFramework();
    let widget!: WidgetNode;

    const instance = render(
      <TextualApp framework={framework}>
        <WorkerHarness
          onReady={(value) => {
            widget = value;
          }}
        />
      </TextualApp>,
    );

    await framework.whenIdle();

    const worker = widget.runWorker(
      (signal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
      { name: "unmount-worker" },
    );

    instance.unmount();
    instance.cleanup();

    await expect(worker.wait()).rejects.toBeInstanceOf(WorkerCancelled);
  });
});
