import { App } from "../src/index.js";
import { describe, expect, it } from "vitest";

import { InputModel as Input, InputChanged, InputSubmitted, createInputActions } from "../src/widgets/input.js";
describe("Input model", () => {
  it("constructs with default empty value", () => {
    const input = new Input();

    expect(input.value).toBe("");
    expect(input.cursorPosition).toBe(0);
    expect(input.type).toBe("text");
  });

  it("constructs with initial value and positions cursor at end", () => {
    const input = new Input({ value: "hello" });

    expect(input.value).toBe("hello");
    expect(input.cursorPosition).toBe(5);
  });

  it("rejects invalid input type", () => {
    expect(() => new Input({ type: "bogus" })).toThrow();
  });
});

describe("Input cursor movement", () => {
  it("moves left and right with boundary clamping", () => {
    const input = new Input({ value: "abc" });
    input.cursorPosition = 1;

    input.moveCursorRight();
    expect(input.cursorPosition).toBe(2);

    input.moveCursorLeft();
    expect(input.cursorPosition).toBe(1);

    input.moveCursorHome();
    expect(input.cursorPosition).toBe(0);

    input.moveCursorLeft();
    expect(input.cursorPosition).toBe(0);

    input.moveCursorEnd();
    expect(input.cursorPosition).toBe(3);

    input.moveCursorRight();
    expect(input.cursorPosition).toBe(3);
  });

  it("moves by word boundaries", () => {
    const input = new Input({ value: "hello world test" });
    input.cursorPosition = 0;

    input.moveCursorWordRight();
    expect(input.cursorPosition).toBe(6);

    input.moveCursorWordRight();
    expect(input.cursorPosition).toBe(12);

    input.moveCursorWordLeft();
    expect(input.cursorPosition).toBe(6);

    input.moveCursorWordLeft();
    expect(input.cursorPosition).toBe(0);
  });

  it("treats entire value as one word in password mode", () => {
    const input = new Input({ value: "hello world", password: true });
    input.cursorPosition = 5;

    input.moveCursorWordLeft();
    expect(input.cursorPosition).toBe(0);

    input.moveCursorWordRight();
    expect(input.cursorPosition).toBe(11);
  });
});

describe("Input selection", () => {
  it("selects a range and reports selected text", () => {
    const input = new Input({ value: "hello world" });
    input.select(0, 5);

    expect(input.selectedText).toBe("hello");
    expect(input.selection).toEqual({ start: 0, end: 5 });
  });

  it("selects all text", () => {
    const input = new Input({ value: "hello" });
    input.selectAll();

    expect(input.selectedText).toBe("hello");
  });

  it("handles reversed selection (end < start)", () => {
    const input = new Input({ value: "hello" });
    input.select(5, 2);

    expect(input.selectedText).toBe("llo");
  });

  it("clears selection", () => {
    const input = new Input({ value: "hello" });
    input.selectAll();
    input.clearSelection();

    expect(input.selection).toBeNull();
    expect(input.selectedText).toBe("");
  });

  it("deletes selection and repositions cursor", () => {
    const input = new Input({ value: "hello world" });
    input.select(5, 11);

    expect(input.deleteSelection()).toBe(true);
    expect(input.value).toBe("hello");
    expect(input.cursorPosition).toBe(5);
    expect(input.selection).toBeNull();
  });

  it("returns false when deleting empty or no selection", () => {
    const input = new Input({ value: "hello" });
    expect(input.deleteSelection()).toBe(false);

    input.select(3, 3);
    expect(input.deleteSelection()).toBe(false);
  });
});

describe("Input text insertion and deletion", () => {
  it("inserts text at cursor position", () => {
    const input = new Input({ value: "helo" });
    input.cursorPosition = 3;

    expect(input.insert("l")).toBe(true);
    expect(input.value).toBe("hello");
    expect(input.cursorPosition).toBe(4);
  });

  it("replaces selection on insert", () => {
    const input = new Input({ value: "hello world" });
    input.select(6, 11);

    expect(input.insert("there")).toBe(true);
    expect(input.value).toBe("hello there");
  });

  it("deletes left (backspace)", () => {
    const input = new Input({ value: "hello" });
    input.cursorPosition = 5;

    expect(input.deleteLeft()).toBe(true);
    expect(input.value).toBe("hell");
    expect(input.cursorPosition).toBe(4);
  });

  it("deletes right (delete key)", () => {
    const input = new Input({ value: "hello" });
    input.cursorPosition = 0;

    expect(input.deleteRight()).toBe(true);
    expect(input.value).toBe("ello");
    expect(input.cursorPosition).toBe(0);
  });

  it("delete left at start is a no-op", () => {
    const input = new Input({ value: "hello" });
    input.cursorPosition = 0;
    expect(input.deleteLeft()).toBe(false);
  });

  it("delete right at end is a no-op", () => {
    const input = new Input({ value: "hello" });
    input.cursorPosition = 5;
    expect(input.deleteRight()).toBe(false);
  });

  it("deletes word left", () => {
    const input = new Input({ value: "hello world" });
    input.cursorPosition = 11;

    expect(input.deleteWordLeft()).toBe(true);
    expect(input.value).toBe("hello ");
  });

  it("deletes word right", () => {
    const input = new Input({ value: "hello world" });
    input.cursorPosition = 0;

    expect(input.deleteWordRight()).toBe(true);
    expect(input.value).toBe("world");
  });

  it("deletes to start", () => {
    const input = new Input({ value: "hello world" });
    input.cursorPosition = 5;

    expect(input.deleteToStart()).toBe(true);
    expect(input.value).toBe(" world");
    expect(input.cursorPosition).toBe(0);
  });

  it("deletes to end", () => {
    const input = new Input({ value: "hello world" });
    input.cursorPosition = 5;

    expect(input.deleteToEnd()).toBe(true);
    expect(input.value).toBe("hello");
  });

  it("clears all content", () => {
    const input = new Input({ value: "hello" });
    input.clear();

    expect(input.value).toBe("");
    expect(input.cursorPosition).toBe(0);
    expect(input.selection).toBeNull();
  });
});

describe("Input programmatic delete and replace", () => {
  it("deletes a range regardless of direction", () => {
    const input = new Input({ value: "hello world" });

    expect(input.delete(0, 6)).toBe(true);
    expect(input.value).toBe("world");

    const input2 = new Input({ value: "hello world" });
    expect(input2.delete(6, 0)).toBe(true);
    expect(input2.value).toBe("world");
  });

  it("replaces a range with new text", () => {
    const input = new Input({ value: "hello world" });

    expect(input.replace("there", 6, 11)).toBe(true);
    expect(input.value).toBe("hello there");
  });

  it("clamps delete/replace ranges to value bounds", () => {
    const input = new Input({ value: "hello" });

    expect(input.delete(-5, 100)).toBe(true);
    expect(input.value).toBe("");
  });
});

describe("Input restrict pattern", () => {
  it("rejects insertions that violate the restrict pattern", () => {
    const input = new Input({ type: "integer" });

    expect(input.insert("5")).toBe(true);
    expect(input.insert("a")).toBe(false);
    expect(input.value).toBe("5");
  });

  it("allows negative integers with the integer type", () => {
    const input = new Input({ type: "integer" });

    expect(input.insert("-")).toBe(true);
    expect(input.insert("3")).toBe(true);
    expect(input.value).toBe("-3");
  });

  it("accepts plus signs and underscore digit grouping for integers", () => {
    const signed = new Input({ type: "integer" });

    expect(signed.insert("+")).toBe(true);
    expect(signed.insert("1")).toBe(true);
    expect(signed.value).toBe("+1");

    const grouped = new Input({ type: "integer" });

    expect(grouped.insert("1")).toBe(true);
    expect(grouped.insert("_")).toBe(true);
    expect(grouped.insert("0")).toBe(true);
    expect(grouped.insert("0")).toBe(true);
    expect(grouped.insert("0")).toBe(true);
    expect(grouped.value).toBe("1_000");
  });

  it("supports number type with decimal points", () => {
    const input = new Input({ type: "number" });

    expect(input.insert("3")).toBe(true);
    expect(input.insert(".")).toBe(true);
    expect(input.insert("1")).toBe(true);
    expect(input.insert("4")).toBe(true);
    expect(input.value).toBe("3.14");
    expect(input.insert(".")).toBe(false);
  });

  it("accepts scientific notation and typing partials for number input", () => {
    const exponent = new Input({ type: "number" });

    expect(exponent.insert("1")).toBe(true);
    expect(exponent.insert("e")).toBe(true);
    expect(exponent.insert("+")).toBe(true);
    expect(exponent.insert("3")).toBe(true);
    expect(exponent.value).toBe("1e+3");

    const partial = new Input({ type: "number" });

    expect(partial.insert(".")).toBe(true);
    expect(partial.value).toBe(".");

    const trailingUnderscore = new Input({ type: "number" });

    expect(trailingUnderscore.insert("1")).toBe(true);
    expect(trailingUnderscore.insert("_")).toBe(true);
    expect(trailingUnderscore.value).toBe("1_");
  });

  it("rejects bare e and non-finite number literals", () => {
    const bareExponent = new Input({ type: "number" });
    expect(bareExponent.insert("e")).toBe(false);

    const infinite = new Input({ type: "number" });
    expect(infinite.insert("inf")).toBe(false);

    const nan = new Input({ type: "number" });
    expect(nan.insert("nan")).toBe(false);
  });

  it("supports custom restrict regex", () => {
    const input = new Input({ restrict: /^[a-z]*$/ });

    expect(input.insert("abc")).toBe(true);
    expect(input.insert("1")).toBe(false);
    expect(input.value).toBe("abc");
  });

  it("treats custom restrict regex as a whole-value predicate even when stateful", () => {
    const input = new Input({ restrict: /^[a-z]*$/g });

    expect(input.insert("a")).toBe(true);
    expect(input.insert("b")).toBe(true);
    expect(input.insert("c")).toBe(true);
    expect(input.value).toBe("abc");
  });
});

describe("Input max length", () => {
  it("rejects insertions that exceed max length", () => {
    const input = new Input({ maxLength: 5 });

    expect(input.insert("hello")).toBe(true);
    expect(input.insert("x")).toBe(false);
    expect(input.value).toBe("hello");
  });
});

describe("Input password mode word operations", () => {
  it("deleteWordLeft removes everything to the left in password mode", () => {
    const input = new Input({ value: "hello world", password: true });
    input.cursorPosition = 5;

    expect(input.deleteWordLeft()).toBe(true);
    expect(input.value).toBe(" world");
    expect(input.cursorPosition).toBe(0);
  });

  it("deleteWordRight removes everything to the right in password mode", () => {
    const input = new Input({ value: "hello world", password: true });
    input.cursorPosition = 5;

    expect(input.deleteWordRight()).toBe(true);
    expect(input.value).toBe("hello");
  });
});

describe("Input restrict on replace", () => {
  it("rejects replace that violates restrict pattern", () => {
    const input = new Input({ type: "integer", value: "123" });

    expect(input.replace("abc", 0, 3)).toBe(false);
    expect(input.value).toBe("123");
  });

  it("accepts replace that satisfies restrict pattern", () => {
    const input = new Input({ type: "integer", value: "123" });

    expect(input.replace("456", 0, 3)).toBe(true);
    expect(input.value).toBe("456");
  });

  it("rejects replace that exceeds max length", () => {
    const input = new Input({ maxLength: 5, value: "abc" });

    expect(input.replace("123456", 0, 3)).toBe(false);
    expect(input.value).toBe("abc");
  });
});

describe("Input value setter", () => {
  it("clamps cursor position when value shrinks", () => {
    const input = new Input({ value: "hello world" });
    input.cursorPosition = 11;
    input.value = "hi";

    expect(input.cursorPosition).toBe(2);
  });

  it("clears selection on value set", () => {
    const input = new Input({ value: "hello" });
    input.selectAll();
    input.value = "new";

    expect(input.selection).toBeNull();
  });
});

describe("Input cursor position setter", () => {
  it("clamps negative cursor position to zero", () => {
    const input = new Input({ value: "hello" });
    input.cursorPosition = -5;

    expect(input.cursorPosition).toBe(0);
  });

  it("clamps cursor position beyond value length", () => {
    const input = new Input({ value: "hi" });
    input.cursorPosition = 100;

    expect(input.cursorPosition).toBe(2);
  });
});

describe("Input messages", () => {
  it("creates InputChanged with value", () => {
    const changed = new InputChanged("hello");
    expect(changed.value).toBe("hello");
  });

  it("creates InputSubmitted with value", () => {
    const submitted = new InputSubmitted("hello");
    expect(submitted.value).toBe("hello");
  });
});

describe("Input framework action routing", () => {
  it("exposes movement commands through the canonical action dispatcher", () => {
    const app = new App();
    const input = new Input({ value: "hello world" });
    const actions = createInputActions(input);

    expect(app.runAction("cursor_left", { actions })).toBe(true);
    expect(input.cursorPosition).toBe(10);

    expect(app.runAction("cursor_left_word", { actions })).toBe(true);
    expect(input.cursorPosition).toBe(6);

    expect(app.runAction("home", { actions })).toBe(true);
    expect(input.cursorPosition).toBe(0);

    expect(app.runAction("cursor_right_word", { actions })).toBe(true);
    expect(input.cursorPosition).toBe(6);

    expect(app.runAction("end", { actions })).toBe(true);
    expect(input.cursorPosition).toBe(11);
  });

  it("exposes delete commands through the canonical action dispatcher", () => {
    const app = new App();
    const input = new Input({ value: "hello world" });
    const actions = createInputActions(input);

    input.cursorPosition = 5;
    expect(app.runAction("delete_left", { actions })).toBe(true);
    expect(input.value).toBe("hell world");

    input.value = "hello world";
    input.cursorPosition = 6;
    expect(app.runAction("delete_right_word", { actions })).toBe(true);
    expect(input.value).toBe("hello ");

    input.value = "hello world";
    input.cursorPosition = 5;
    expect(app.runAction("delete_left_all", { actions })).toBe(true);
    expect(input.value).toBe(" world");

    expect(app.runAction("delete_right_all", { actions })).toBe(true);
    expect(input.value).toBe("");
  });
});
