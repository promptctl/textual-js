import { describe, expect, it } from "vitest";

import { RuleModel as Rule, InvalidRuleOrientation, InvalidLineStyle } from "../src/widgets/rule.js";

describe("Rule widget", () => {
  it("constructs with default orientation and line style", () => {
    const rule = new Rule();

    expect(rule.orientation).toBe("horizontal");
    expect(rule.lineStyle).toBe("solid");
  });

  it("constructs with explicit orientation and line style", () => {
    const rule = new Rule("vertical", "dashed");

    expect(rule.orientation).toBe("vertical");
    expect(rule.lineStyle).toBe("dashed");
  });

  it("rejects invalid orientation at construction", () => {
    expect(() => new Rule("diagonal" as never)).toThrow(InvalidRuleOrientation);
  });

  it("rejects invalid orientation on assignment", () => {
    const rule = new Rule();

    expect(() => {
      rule.orientation = "diagonal" as never;
    }).toThrow(InvalidRuleOrientation);
  });

  it("rejects invalid line style at construction", () => {
    expect(() => new Rule("horizontal", "wavy")).toThrow(InvalidLineStyle);
  });

  it("rejects invalid line style on assignment", () => {
    const rule = new Rule();

    expect(() => {
      rule.lineStyle = "wavy";
    }).toThrow(InvalidLineStyle);
  });

  it("accepts valid reassignment of orientation and line style", () => {
    const rule = new Rule();

    rule.orientation = "vertical";
    rule.lineStyle = "heavy";

    expect(rule.orientation).toBe("vertical");
    expect(rule.lineStyle).toBe("heavy");
  });
});
