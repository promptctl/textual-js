import { App } from "../src/index.js";
import React, { useLayoutEffect } from "react";
import { threadId } from "node:worker_threads";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import {
  Content,
  Widget,
  WidgetScope,
  TextualApp,
  DeadlockError,
  WorkerDeclarationError,
  WorkerError,
  WorkerCancelled,
  WorkerFailed,
  WorkerStateChanged,
  getCurrentWorker,
  get_current_worker,
  work,
  useWidget,
} from "../src/index.js";

function WorkerHarness(props: {
  onReady: (widget: Widget) => void;
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
    const app = new App();
    const framework = app.framework;
    const states: string[] = [];
    let widget!: Widget;

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

    await app.whenIdle();

    const worker = widget.runWorker(async (_signal, currentWorker) => {
      expect(getCurrentWorker()).toBe(currentWorker);
      currentWorker.update(1, 2);
      currentWorker.advance();
      return "done";
    }, { name: "success-worker" });

    await expect(worker.wait()).resolves.toBe("done");
    await app.whenIdle();
    expect(app.workers.has(worker)).toBe(true);
    await app.workers.waitForComplete();

    expect(worker.progress).toBe(100);
    expect(worker.completed_steps).toBe(2);
    expect(worker.total_steps).toBe(2);
    expect(worker.is_finished).toBe(true);
    expect(states).toEqual(["running", "success"]);
    expect(app.workers.length).toBe(0);

    instance.unmount();
    instance.cleanup();
  });

  it("maps aborts to cancellation and reports failures distinctly", async () => {
    const app = new App();
    const framework = app.framework;
    const states: string[] = [];
    let widget!: Widget;

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

    await app.whenIdle();

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
    await app.whenIdle();

    expect(states).toContain("cancelled");
    expect(states).toContain("error");

    instance.unmount();
    instance.cleanup();
  });

  it("cancels widget-owned workers on unmount", async () => {
    const app = new App();
    const framework = app.framework;
    let widget!: Widget;

    const instance = render(
      <TextualApp framework={framework}>
        <WorkerHarness
          onReady={(value) => {
            widget = value;
          }}
        />
      </TextualApp>,
    );

    await app.whenIdle();

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

  it("supports run_worker aliases, pending start, callable inputs, and manager surfaces", async () => {
    const app = new App();
    const framework = app.framework;
    const pendingWorker = app.runWorker(async () => "pending", { start: false, name: "pending" });

    expect(pendingWorker.state).toBe("pending");
    expect(app.workers.has(pendingWorker)).toBe(true);
    await expect(pendingWorker.wait()).rejects.toBeInstanceOf(WorkerError);

    app.workers.start_all();
    await expect(pendingWorker.wait()).resolves.toBe("pending");

    const promiseWorker = app.runWorker(Promise.resolve("promise"), { name: "promise" });
    const syncThreadWorker = app.runWorker(() => {
      return globalThis.process ? 1 : 0;
    }, { thread: true, name: "sync", description: Content.styled("sync worker", "bold") });

    await expect(promiseWorker.wait()).resolves.toBe("promise");
    await expect(syncThreadWorker.wait()).resolves.toBe(1);
    expect(syncThreadWorker.description).toBeInstanceOf(Content);
    expect(app.workers.has(syncThreadWorker)).toBe(true);
    await app.workers.wait_for_complete();

    expect(app.workers.length).toBe(0);
    expect(Array.from(app.workers.reversed())).toEqual([]);
    expect(app.workers.toString()).toContain("0 workers");
  });

  it("runs sync and async thread workers on a worker thread", async () => {
    const app = new App();
    const framework = app.framework;
    const syncThreadWorker = app.runWorker(() => {
      return require("node:worker_threads").threadId as number;
    }, { thread: true, name: "sync-thread" });
    const asyncThreadWorker = app.runWorker(async () => {
      return require("node:worker_threads").threadId as number;
    }, { thread: true, name: "async-thread" });

    await expect(syncThreadWorker.wait()).resolves.not.toBe(threadId);
    await expect(asyncThreadWorker.wait()).resolves.not.toBe(threadId);
    await app.workers.wait_for_complete();
  });

  it("defaults exitOnError to true but suppresses app error forwarding when disabled", async () => {
    const defaultFramework = new App().framework;
    defaultFramework.setCaptureUnhandledErrors(true);
    const defaultWorker = defaultFramework.runAppWorker(async () => {
      throw new Error("default failure");
    }, { name: "default-failure" });

    await expect(defaultWorker.wait()).rejects.toBeInstanceOf(WorkerFailed);
    await expect(defaultFramework.whenIdle()).rejects.toBeInstanceOf(WorkerFailed);

    const suppressedFramework = new App().framework;
    suppressedFramework.setCaptureUnhandledErrors(true);
    const suppressedWorker = suppressedFramework.runAppWorker(async () => {
      throw new Error("suppressed failure");
    }, { name: "suppressed-failure", exitOnError: false });

    await expect(suppressedWorker.wait()).rejects.toBeInstanceOf(WorkerFailed);
    await expect(suppressedFramework.whenIdle()).resolves.toBeUndefined();
  });

  it("implements work decorator launch, thread sync methods, declaration errors, and exclusivity", async () => {
    class DecoratedWorkerHost {
      constructor(readonly framework: App["framework"]) {}

      runWorker(callable: never, options = {}) {
        return this.framework.runAppWorker(callable, options);
      }

      async asyncTask(value: string): Promise<string> {
        return `async:${value}`;
      }

      syncTask(value: string): string {
        return `sync:${value}`;
      }

      async exclusiveTask(value: string): Promise<string> {
        const worker = get_current_worker();

        return new Promise((resolve, reject) => {
          worker.controller.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
          setTimeout(() => {
            resolve(value);
          }, 20);
        });
      }
    }

    const asyncDescriptor = Object.getOwnPropertyDescriptor(DecoratedWorkerHost.prototype, "asyncTask")!;
    work(DecoratedWorkerHost.prototype, "asyncTask", asyncDescriptor);
    Object.defineProperty(DecoratedWorkerHost.prototype, "asyncTask", asyncDescriptor);

    const syncDescriptor = Object.getOwnPropertyDescriptor(DecoratedWorkerHost.prototype, "syncTask")!;
    work({ thread: true })(DecoratedWorkerHost.prototype, "syncTask", syncDescriptor);
    Object.defineProperty(DecoratedWorkerHost.prototype, "syncTask", syncDescriptor);

    const exclusiveDescriptor = Object.getOwnPropertyDescriptor(DecoratedWorkerHost.prototype, "exclusiveTask")!;
    work({ exclusive: true })(DecoratedWorkerHost.prototype, "exclusiveTask", exclusiveDescriptor);
    Object.defineProperty(DecoratedWorkerHost.prototype, "exclusiveTask", exclusiveDescriptor);

    class InvalidHost {
      sync(): string {
        return "invalid";
      }
    }

    const invalidDescriptor = Object.getOwnPropertyDescriptor(InvalidHost.prototype, "sync")!;
    expect(() => {
      work(InvalidHost.prototype, "sync", invalidDescriptor);
    }).toThrow(WorkerDeclarationError);

    const app = new App();
    const framework = app.framework;
    const host = new DecoratedWorkerHost(framework);

    await expect((host.asyncTask("ok") as unknown as { wait: () => Promise<unknown> }).wait()).resolves.toBe("async:ok");
    await expect((host.syncTask("ok") as unknown as { wait: () => Promise<unknown> }).wait()).resolves.toBe("sync:ok");

    const first = host.exclusiveTask("first") as unknown as { wait: () => Promise<unknown> };
    const second = host.exclusiveTask("second") as unknown as { wait: () => Promise<unknown> };

    await expect(first.wait()).rejects.toBeInstanceOf(WorkerCancelled);
    await expect(second.wait()).resolves.toBe("second");
  });

  it("allows nested workers and surfaces self-wait deadlocks as worker failures", async () => {
    const app = new App();
    const framework = app.framework;
    const results: string[] = [];

    const parent = app.runWorker(async () => {
      app.runWorker(async () => {
        results.push("child");
      }, { name: "child" });
      results.push("parent");
    }, { name: "parent" });

    await parent.wait();
    await app.workers.wait_for_complete();

    expect(new Set(results)).toEqual(new Set(["parent", "child"]));

    const selfWaiter = app.runWorker(async () => {
      await getCurrentWorker().wait();
    }, { name: "self" });

    await expect(selfWaiter.wait()).rejects.toBeInstanceOf(WorkerFailed);
    expect(selfWaiter.error).toBeInstanceOf(DeadlockError);
  });
});
