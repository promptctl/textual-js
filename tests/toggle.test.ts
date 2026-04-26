import { describe, expect, it } from "vitest";

import { Content } from "../src/index.js";
import { RadioSetModel as RadioSet, RadioSetChanged } from "../src/widgets/radio-set.js";
import { ToggleButtonModel as ToggleButton, ToggleChanged } from "../src/widgets/toggle.js";

describe("ToggleButton (Checkbox/RadioButton model)", () => {
  it("defaults to false with empty label", () => {
    const toggle = new ToggleButton();

    expect(toggle.value).toBe(false);
    expect(toggle.label.plain).toBe("");
  });

  it("constructs with label and initial value", () => {
    const toggle = new ToggleButton("Accept", true);

    expect(toggle.label.plain).toBe("Accept");
    expect(toggle.value).toBe(true);
  });

  it("toggles value and returns the new state", () => {
    const toggle = new ToggleButton("", false);

    expect(toggle.toggle()).toBe(true);
    expect(toggle.value).toBe(true);

    expect(toggle.toggle()).toBe(false);
    expect(toggle.value).toBe(false);
  });

  it("supports label reassignment as string or Content", () => {
    const toggle = new ToggleButton("old");

    toggle.label = "new";
    expect(toggle.label.plain).toBe("new");

    toggle.label = Content.styled("styled", "bold");
    expect(toggle.label.plain).toBe("styled");
  });

  it("creates ToggleChanged messages with value", () => {
    const changed = new ToggleChanged(true);

    expect(changed.value).toBe(true);
    expect(changed.bubble).toBe(true);
  });
});

describe("RadioSet model", () => {
  it("constructs from ToggleButton instances", () => {
    const set = new RadioSet([
      new ToggleButton("A"),
      new ToggleButton("B"),
      new ToggleButton("C"),
    ]);

    expect(set.length).toBe(3);
    expect(set.pressedIndex).toBe(-1);
    expect(set.pressedButton).toBeNull();
  });

  it("constructs from strings", () => {
    const set = new RadioSet(["Alpha", "Beta", "Gamma"]);

    expect(set.length).toBe(3);
    expect(set.getButton(0).label.plain).toBe("Alpha");
  });

  it("collapses multiple initially-true buttons to the first", () => {
    const set = new RadioSet([
      new ToggleButton("A", true),
      new ToggleButton("B", true),
      new ToggleButton("C"),
    ]);

    expect(set.pressedIndex).toBe(0);
    expect(set.getButton(0).value).toBe(true);
    expect(set.getButton(1).value).toBe(false);
  });

  it("pressing a button turns off the previous one", () => {
    const set = new RadioSet(["A", "B", "C"]);

    expect(set.press(1)).toBe(true);
    expect(set.pressedIndex).toBe(1);
    expect(set.getButton(1).value).toBe(true);

    expect(set.press(2)).toBe(true);
    expect(set.pressedIndex).toBe(2);
    expect(set.getButton(1).value).toBe(false);
    expect(set.getButton(2).value).toBe(true);
  });

  it("pressing the already-pressed button is a no-op", () => {
    const set = new RadioSet(["A", "B"]);

    set.press(0);
    expect(set.press(0)).toBe(false);
    expect(set.pressedIndex).toBe(0);
  });

  it("rejects out-of-bounds index", () => {
    const set = new RadioSet(["A"]);

    expect(set.press(-1)).toBe(false);
    expect(set.press(5)).toBe(false);
  });

  it("creates RadioSetChanged messages", () => {
    const button = new ToggleButton("test");
    const changed = new RadioSetChanged(1, button);

    expect(changed.index).toBe(1);
    expect(changed.pressed).toBe(button);
  });
});
