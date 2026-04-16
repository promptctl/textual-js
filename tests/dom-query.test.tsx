import React from "react";
import { Text } from "ink";
import { observer } from "mobx-react-lite";
import { describe, expect, it } from "vitest";

import {
  InvalidQueryFormat,
  TextualApp,
  TextualFramework,
  WidgetNode,
  WidgetScope,
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
    const framework = new TextualFramework();

    const instance = render(
      <TextualApp framework={framework}>
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

    await framework.whenIdle();

    const root = framework.registry.getByCssId("root") as WidgetNode;
    const second = framework.registry.getByCssId("second") as WidgetNode;
    const two = framework.registry.getByCssId("two") as WidgetNode;
    two.focus();

    expect(root.query(".item").results().map((widget) => widget.id)).toEqual(["one", "two"]);
    expect(root.queryOne("#one").id).toBe("one");
    expect(root.queryExactlyOne("#two").id).toBe("two");
    expect(root.queryChildren("Container").results().map((widget) => widget.id)).toEqual(["first", "second"]);
    expect(two.queryAncestor("#root")?.id).toBe("root");
    expect(root.query("Container Label").results().map((widget) => widget.id)).toContain("two");
    expect(root.query("#first > Label").results().map((widget) => widget.id)).toEqual(["one"]);
    expect(root.query("#first + #second").results().map((widget) => widget.id)).toEqual(["second"]);
    expect(root.query("#first ~ #second").results().map((widget) => widget.id)).toEqual(["second"]);
    expect(root.query("Label:focus").results().map((widget) => widget.id)).toEqual(["two"]);
    expect(root.query(".item").filter("#two").first().id).toBe("two");
    expect(root.query(".item").exclude("#one").last().id).toBe("two");
    expect(() => root.query("1")).toThrow(InvalidQueryFormat);
    expect(second.queryChildren("*").results().map((widget) => widget.id)).toEqual(["two"]);

    instance.unmount();
    instance.cleanup();
  });
});
