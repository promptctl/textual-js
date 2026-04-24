import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { TextualFramework } from "../src/framework/app-framework.js";

import {
  BadWidgetName,
  Hide,
  MountError,
  NoMatches,
  TooManyMatches,
  Offset,
  Show,
  Size,
  TextualApp,
  Widget,
  WidgetHost,
  Widget,
  find_first_enabled,
  find_last_enabled,
  find_next_enabled,
  find_next_enabled_no_wrap,
  get_directed_distance,
  runTest,
} from "../src/index.js";

function createNode(
  framework: TextualFramework,
  options: Partial<ConstructorParameters<typeof Widget>[0]> = {},
): Widget {
  return new Widget({
    framework,
    nodeId: options.nodeId ?? `node-${Math.random()}`,
    parentId: options.parentId ?? null,
    id: options.id,
    classes: options.classes ?? [],
    typeName: options.typeName ?? "Widget",
    handlersRef: options.handlersRef ?? { current: undefined },
    actionsRef: options.actionsRef ?? { current: undefined },
    bindingsRef: options.bindingsRef ?? { current: [] },
    focusable: options.focusable ?? false,
    canFocusChildren: options.canFocusChildren,
    autoFocus: options.autoFocus ?? false,
    disabled: options.disabled ?? false,
    loading: options.loading ?? false,
    tooltip: options.tooltip ?? null,
  });
}

describe("public Widget base surface", () => {
  it("requires a framework on construction and validates class names", () => {
    const framework = new App().framework;
    class Parent extends Widget {}
    class Child extends Widget {}

    const child = new Child({ framework, id: "child" });
    const parent = new Parent({ framework, id: "parent" });

    expect(parent.is_mounted).toBe(false);
    expect(parent.is_attached).toBe(false);
    expect(parent.children.toArray()).toEqual([]);
    expect(child.parentId).toBeNull();

    // [LAW:one-source-of-truth] A widget without a framework has no runtime
    // to belong to, so construction rejects it at the single boundary.
    expect(() => new Widget("bad" as never)).toThrow(TypeError);
    expect(() => new Widget({} as never)).toThrow();

    class lowercase extends Widget {}
    expect(() => new lowercase({ framework })).toThrow(BadWidgetName);
  });

  it("mounts, moves, removes, sorts, and looks up direct children", () => {
    const framework = new App().framework;
    const parent = createNode(framework, { nodeId: "parent", id: "parent", typeName: "Parent" });
    const first = createNode(framework, { nodeId: "first", id: "first", typeName: "Leaf" });
    const second = createNode(framework, { nodeId: "second", id: "second", typeName: "Leaf" });
    const third = createNode(framework, { nodeId: "third", id: "third", typeName: "Other" });

    expect(() => parent.mount(first)).toThrow(MountError);

    framework.registerWidget(parent);
    parent.mount(first, second);
    parent.mount(third, { before: "#second" });

    expect(parent.children.toArray().map((widget) => widget.id)).toEqual(["first", "third", "second"]);
    expect(parent.get_child_by_id("third")).toBe(third);
    expect(parent.get_widget_by_id("second")).toBe(second);
    expect(parent.get_child_by_type("Leaf")).toBe(first);
    expect(second.siblings.map((widget) => widget.id)).toEqual(["first", "third"]);

    parent.move_child(second, { before: first });
    expect(parent.children.toArray().map((widget) => widget.id)).toEqual(["second", "first", "third"]);

    parent.sort_children((widget) => widget.id);
    expect(parent.children.toArray().map((widget) => widget.id)).toEqual(["first", "second", "third"]);

    parent.remove_children("Other");
    expect(parent.children.toArray().map((widget) => widget.id)).toEqual(["first", "second"]);

    expect(() => parent.get_child_by_id("missing")).toThrow(NoMatches);
  });

  it("mount_all accepts iterables and preserves mount placement/error contracts", () => {
    const framework = new App().framework;
    const mountedParent = createNode(framework, { nodeId: "parent", id: "parent", typeName: "Parent" });
    const detachedParent = createNode(framework, { nodeId: "detached", id: "detached", typeName: "Parent" });
    const existing = createNode(framework, { nodeId: "existing", id: "existing", typeName: "Leaf" });
    const first = createNode(framework, { nodeId: "first", id: "first", typeName: "Leaf" });
    const second = createNode(framework, { nodeId: "second", id: "second", typeName: "Leaf" });

    function* widgets(): Iterable<Widget> {
      yield first;
      yield second;
    }

    framework.registerWidget(mountedParent);
    mountedParent.mount(existing);

    expect(mountedParent.mount_all(widgets(), { before: "#existing" })).toEqual([first, second]);
    expect(mountedParent.children.toArray().map((widget) => widget.id)).toEqual(["first", "second", "existing"]);
    expect(() => detachedParent.mount_all([createNode(framework, { nodeId: "late", id: "late" })])).toThrow(MountError);
    expect(() => mountedParent.mount_all([], { before: 0, after: 0 })).toThrow(MountError);
  });

  it("resolves _find_mount_point for indices, selectors, widget references, and spec error cases", () => {
    const framework = new App().framework;
    const parent = createNode(framework, { nodeId: "parent", id: "parent", typeName: "Parent" });
    const alpha = createNode(framework, { nodeId: "alpha", id: "alpha", typeName: "Alpha" });
    const beta = createNode(framework, { nodeId: "beta", id: "beta", typeName: "Beta" });
    const duplicateA = createNode(framework, { nodeId: "duplicate-a", id: "duplicate-a", typeName: "Duplicate" });
    const duplicateB = createNode(framework, { nodeId: "duplicate-b", id: "duplicate-b", typeName: "Duplicate" });
    const orphan = createNode(framework, { nodeId: "orphan", id: "orphan", typeName: "Leaf" });

    framework.registerWidget(parent);
    parent.mount(alpha, beta, duplicateA, duplicateB);

    expect(parent._find_mount_point(2)).toEqual([parent, 2]);
    expect(parent._find_mount_point(-1)).toEqual([parent, 3]);
    expect(parent._find_mount_point(beta)).toEqual([parent, 1]);
    expect(parent._find_mount_point("Beta")).toEqual([parent, 1]);
    expect(parent._find_mount_point("#alpha")).toEqual([parent, 0]);
    expect(() => parent._find_mount_point("#missing")).toThrow(NoMatches);
    expect(() => parent._find_mount_point("Duplicate")).toThrow(TooManyMatches);
    expect(() => parent._find_mount_point(orphan)).toThrow(MountError);
  });

  it("exposes pseudo helpers, automatic state classes, loading overlay, and render helpers", () => {
    class RenderWidget extends Widget {
      override render() {
        return "one\nthree";
      }
    }

    const framework = new App().framework;
    const parent = createNode(framework, { nodeId: "parent", id: "parent" });
    const first = createNode(framework, { nodeId: "first", id: "first", parentId: "parent", typeName: "Leaf" });
    const second = createNode(framework, { nodeId: "second", id: "second", parentId: "parent", typeName: "Leaf" });
    framework.registerWidget(parent);
    framework.registerWidget(first);
    framework.registerWidget(second);

    expect(first.first_child).toBe(true);
    expect(first.first_of_type).toBe(true);
    expect(second.last_child).toBe(true);
    expect(second.last_of_type).toBe(true);
    expect(first.is_odd).toBe(true);
    expect(second.is_even).toBe(true);

    first.setDisabled(true);
    second.setLoading(true);
    expect(first.hasClass("-disabled")).toBe(true);
    expect(second.hasClass("-loading")).toBe(true);
    expect(second._cover_widget).not.toBeNull();

    const rendered = new RenderWidget({ framework });
    expect(rendered.render_str("[bold]x[/]").plain).toBe("x");
    expect(rendered.get_content_width()).toBe(5);
    expect(rendered.get_content_height()).toBe(2);
    rendered.offset = [3, 4];
    expect(rendered.offset).toEqual(new Offset(3, 4));
  });
});

describe("Stage 4 focus and visibility policy", () => {
  it("excludes descendants when canFocusChildren is false and supports type-filtered navigation", async () => {
    function Input(): React.JSX.Element {
      return <Text>unused</Text>;
    }

    const framework = new App().framework;
    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Container" canFocusChildren={false}>
          <WidgetHost typeName="Input" id="blocked" focusable>
            <Text>blocked</Text>
          </WidgetHost>
        </WidgetHost>
        <WidgetHost typeName="Input" id="first" focusable>
          <Text>first</Text>
        </WidgetHost>
        <WidgetHost typeName="Label" id="label" focusable>
          <Text>label</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    expect(framework.getFocusChain().map((widget) => widget.id)).toEqual(["first", "label"]);
    expect(framework.focusNext(Input)?.id).toBe("first");

    instance.unmount();
    instance.cleanup();
  });

  it("reassigns focus when the focused widget is removed", () => {
    const framework = new App().framework;
    const first = createNode(framework, { nodeId: "first", id: "first", focusable: true });
    const second = createNode(framework, { nodeId: "second", id: "second", focusable: true });

    framework.registerWidget(first);
    framework.registerWidget(second);
    framework.focusWidget(first.nodeId);
    first.remove();

    expect(framework.focusedNodeId).toBe(second.nodeId);
  });

  it("emits Show and Hide when visible changes", async () => {
    const framework = new App().framework;
    const events: string[] = [];
    const widget = createNode(framework, {
      nodeId: "visible",
      id: "visible",
      handlersRef: {
        current: {
          onShow: () => events.push("show"),
          onHide: () => events.push("hide"),
        },
      },
    });
    const unsubscribe = framework.subscribeToMessages((message) => {
      if (message instanceof Show) events.push("broadcast-show");
      if (message instanceof Hide) events.push("broadcast-hide");
    });

    framework.registerWidget(widget);
    widget.visible = false;
    await framework.whenIdle();
    widget.visible = true;
    await framework.whenIdle();

    expect(events).toEqual(["hide", "broadcast-hide", "show", "broadcast-show"]);
    unsubscribe();
  });

  it("targets empty screen-space pointer events at the active screen root", async () => {
    const received: string[] = [];
    const session = await runTest(
      <WidgetHost
        typeName="ScreenRoot"
        id="screen-root"
        handlers={{
          onMouseMove: () => {
            received.push("move");
          },
        }}
      >
        <Text>root</Text>
      </WidgetHost>,
      { size: new Size(20, 5) },
    );

    session.framework.dispatchPointerMove(19, 4);
    await session.framework.whenIdle();

    expect(received).toEqual(["move"]);
    session.unmount();
  });

  it("traps focus to a subtree only when focus is already inside it and restores the full chain on release", async () => {
    const framework = new App().framework;
    const instance = render(
      <TextualApp framework={framework}>
        <WidgetHost typeName="Dialog" id="dialog">
          <WidgetHost typeName="Input" id="dialog-first" focusable>
            <Text>dialog first</Text>
          </WidgetHost>
          <WidgetHost typeName="Input" id="dialog-second" focusable>
            <Text>dialog second</Text>
          </WidgetHost>
        </WidgetHost>
        <WidgetHost typeName="Input" id="outside" focusable>
          <Text>outside</Text>
        </WidgetHost>
      </TextualApp>,
    );

    await framework.whenIdle();

    const dialog = framework.registry.getByCssId("dialog")!;
    const dialogFirst = framework.registry.getByCssId("dialog-first")!;
    const outside = framework.registry.getByCssId("outside")!;
    const fullChain = framework.getFocusChain().map((widget) => widget.id);

    framework.focusWidget(outside.nodeId);
    dialog.trap_focus();
    expect(framework.getFocusChain().map((widget) => widget.id)).toEqual(fullChain);

    framework.focusWidget(dialogFirst.nodeId);
    dialog.trap_focus();
    expect(framework.getFocusChain().map((widget) => widget.id)).toEqual(["dialog-first", "dialog-second"]);
    expect(framework.focusNext()?.id).toBe("dialog-second");
    expect(framework.focusNext()?.id).toBe("dialog-first");

    dialog.trap_focus(false);
    expect(framework.getFocusChain().map((widget) => widget.id)).toEqual(fullChain);

    instance.unmount();
    instance.cleanup();
  });
});

describe("widget navigation helpers", () => {
  it("finds enabled candidates with and without wrapping", () => {
    const candidates = [{ disabled: true }, { disabled: false }, { disabled: true }, { disabled: false }];

    expect(get_directed_distance(2, 8, 1, 10)).toBe(4);
    expect(get_directed_distance(2, 8, -1, 10)).toBe(6);
    expect(find_first_enabled(candidates)).toBe(1);
    expect(find_last_enabled(candidates)).toBe(3);
    expect(find_next_enabled(candidates, 3, 1)).toBe(1);
    expect(find_next_enabled_no_wrap(candidates, 3, 1)).toBeNull();
    expect(find_next_enabled_no_wrap(candidates, 1, 1, true)).toBe(1);
  });
});
