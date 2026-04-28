import { App } from "../src/index.js";
import React from "react";
import { Text } from "ink";
import { observer } from "mobx-react-lite";
import { describe, expect, it } from "vitest";

import {
  BadIdentifier,
  Color,
  InvalidQueryFormat,
  NoMatches,
  TextualApp,
  TooManyMatches,
  Widget,
  WidgetScope,
  WrongType,
  useWidget,
} from "../src/index.js";
import { render } from "ink-testing-library";

function QueryLabel(props: { id?: string; classes?: string; text: string; focusable?: boolean }): React.JSX.Element {
  const widget = useWidget({
    id: props.id,
    classes: props.classes,
    typeName: "Label",
    focusable: props.focusable,
  });

  return (
    <WidgetScope widget={widget.handle}>
      <Text>{props.text}</Text>
    </WidgetScope>
  );
}

class View {}

class SubView extends View {}

function TypedBase(props: { id: string; children?: React.ReactNode }): React.JSX.Element {
  const widget = useWidget({
    id: props.id,
    typeName: "TypedBase",
    typeToken: View,
  });

  return <WidgetScope widget={widget.handle}>{props.children}</WidgetScope>;
}

function TypedDerived(props: { id: string; children?: React.ReactNode }): React.JSX.Element {
  const widget = useWidget({
    id: props.id,
    typeName: "TypedDerived",
    typeToken: SubView,
  });

  return <WidgetScope widget={widget.handle}>{props.children}</WidgetScope>;
}

const QueryContainer = observer(function QueryContainer(props: {
  id?: string;
  classes?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  const widget = useWidget({
    id: props.id,
    classes: props.classes,
    typeName: "Container",
  });

  return <WidgetScope widget={widget.handle}>{props.children}</WidgetScope>;
});

describe("DOM query API", () => {
  it("supports selector matching, combinators, pseudo-classes, and chaining", async () => {
    const app = new App();

    const instance = render(
      <TextualApp framework={app.framework}>
        <QueryContainer id="root">
          <QueryContainer id="first" classes="alpha">
            <QueryLabel id="one" classes="item status" text="one" />
          </QueryContainer>
          <QueryContainer id="second" classes="beta">
            <QueryLabel id="two" classes="item" text="two" focusable />
          </QueryContainer>
          <QueryLabel id="three" classes="status" text="three" />
        </QueryContainer>
      </TextualApp>,
    );

    await app.whenIdle();

    const root = app.getByCssId("root") as Widget;
    const second = app.getByCssId("second") as Widget;
    const two = app.getByCssId("two") as Widget;
    two.focus();

    expect(root.query(".item").results().map((widget) => widget.id)).toEqual(["one", "two"]);
    expect(root.queryOne(".item").id).toBe("one");
    expect(root.queryOne("#one").id).toBe("one");
    expect(root.queryExactlyOne("#two").id).toBe("two");
    expect(() => root.queryExactlyOne(".item")).toThrow(TooManyMatches);
    expect(root.queryChildren("Container").results().map((widget) => widget.id)).toEqual(["first", "second"]);
    expect(two.queryAncestor("#root").id).toBe("root");
    expect(() => two.queryAncestor("#missing")).toThrow(NoMatches);
    expect(root.query("Container Label").results().map((widget) => widget.id)).toContain("two");
    expect(root.query("#first > Label").results().map((widget) => widget.id)).toEqual(["one"]);
    expect(root.query("#first + #second").results().map((widget) => widget.id)).toEqual(["second"]);
    expect(root.query("#first ~ #second").results().map((widget) => widget.id)).toEqual(["second"]);
    expect(root.query("Label:focus").results().map((widget) => widget.id)).toEqual(["two"]);
    expect(root.query("Container:focus-within").results().map((widget) => widget.id)).toEqual(["second"]);
    expect(root.query(".item").filter("#two").first().id).toBe("two");
    expect(root.query(".item").exclude("#one").last().id).toBe("two");
    expect(() => root.query("1")).toThrow(InvalidQueryFormat);
    expect(() => root.query("foo_bar")).toThrow(InvalidQueryFormat);
    expect(second.queryChildren("*").results().map((widget) => widget.id)).toEqual(["two"]);

    instance.unmount();
    instance.cleanup();
  });

  it("supports traversal snapshots, typed singleton queries, and result-set mutations", async () => {
    const app = new App();

    const instance = render(
      <TextualApp framework={app.framework}>
        <QueryContainer id="root">
          <QueryContainer id="first" classes="alpha">
            <QueryLabel id="one" classes="item" text="one" />
          </QueryContainer>
          <QueryContainer id="second" classes="beta">
            <QueryLabel id="two" classes="item" text="two" focusable />
          </QueryContainer>
          <QueryLabel id="three" classes="item" text="three" />
        </QueryContainer>
      </TextualApp>,
    );

    await app.whenIdle();

    const root = app.getByCssId("root") as Widget;
    const two = app.getByCssId("two") as Widget;

    expect(root.walkChildren({ method: "depth" }).map((widget) => widget.id)).toEqual([
      "first",
      "one",
      "second",
      "two",
      "three",
    ]);
    expect(root.walkChildren({ method: "breadth", reverse: true }).map((widget) => widget.id)).toEqual([
      "two",
      "one",
      "three",
      "second",
      "first",
    ]);
    expect(two.queryAncestor("#root", "Container").id).toBe("root");
    expect(root.queryOneOptional("#missing")).toBeNull();
    expect(() => root.queryOne("#one", "Container")).toThrow(WrongType);
    expect(root.query(".item").results("Container")).toEqual([]);
    expect(root.query(".item").length).toBe(3);
    expect(root.query(".item").at(1)?.id).toBe("two");
    expect(root.query(".item").slice(1).map((widget) => widget.id)).toEqual(["two", "three"]);
    expect(root.query(".item").reversed().map((widget) => widget.id)).toEqual(["three", "two", "one"]);

    root.query(".item").addClass("selected");
    await app.whenIdle();
    expect(root.query(".selected").results().map((widget) => widget.id)).toEqual(["one", "two", "three"]);

    root.query("#one").setStyles("background: red;");
    await app.whenIdle();
    expect((app.getByCssId("one") as Widget).resolvedStyles.getRule("background")).toEqual(Color.parse("red"));

    expect(root.query(".item").focus()?.id).toBe("two");
    expect(app.focusedNodeId).toBe(two.nodeId);
    root.query("#two").blur();
    expect(app.focusedNodeId).toBeNull();

    expect(() => root.addClass("bad class")).toThrow(BadIdentifier);

    instance.unmount();
    instance.cleanup();
  });

  it("matches type selectors through ancestry and supports queryExactlyOne(type)", async () => {
    const app = new App();

    const instance = render(
      <TextualApp framework={app.framework}>
        <TypedBase id="typed-root">
          <QueryContainer id="typed-container">
            <TypedDerived id="typed-child" />
          </QueryContainer>
        </TypedBase>
      </TextualApp>,
    );

    await app.whenIdle();

    const rootHandle = app.getByCssId("typed-root") as Widget;

    expect(rootHandle.query("View").results().map((widget) => widget.id)).toContain("typed-child");
    expect(rootHandle.query("TypedBase").results().map((widget) => widget.id)).toContain("typed-child");
    expect(rootHandle.queryExactlyOne(View).id).toBe("typed-child");

    instance.unmount();
    instance.cleanup();
  });
});
