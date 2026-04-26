import { describe, expect, it } from "vitest";

import { Offset } from "../src/index.js";
import { SelectionModel as Selection } from "../src/widgets/selection.js";

describe("Selection model", () => {
  it("extracts text from a single line", () => {
    const selection = new Selection(new Offset(2, 0), new Offset(5, 0));
    expect(selection.extract("hello world")).toBe("llo");
  });

  it("extracts text across multiple lines", () => {
    const selection = new Selection(new Offset(2, 0), new Offset(3, 1));
    expect(selection.extract("hello\nworld")).toBe("llo\nwor");
  });

  it("handles null start as beginning of text", () => {
    const selection = new Selection(null, new Offset(3, 0));
    expect(selection.extract("hello")).toBe("hel");
  });

  it("handles null end as end of text", () => {
    const selection = new Selection(new Offset(2, 0), null);
    expect(selection.extract("hello")).toBe("llo");
  });

  it("handles both null as entire text", () => {
    const selection = new Selection(null, null);
    expect(selection.extract("hello\nworld")).toBe("hello\nworld");
  });

  it("handles reversed offsets (end before start) on same line", () => {
    const selection = new Selection(new Offset(5, 0), new Offset(2, 0));
    expect(selection.extract("hello world")).toBe("llo");
  });

  it("detects empty selections", () => {
    const empty = new Selection(new Offset(3, 1), new Offset(3, 1));
    expect(empty.isEmpty).toBe(true);

    const nonEmpty = new Selection(new Offset(0, 0), new Offset(5, 0));
    expect(nonEmpty.isEmpty).toBe(false);

    const nullSelection = new Selection(null, null);
    expect(nullSelection.isEmpty).toBe(false);
  });
});
