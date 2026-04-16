import { describe, expect, it } from "vitest";

import { Scalar, Unit, generateTcss, parseScalar, parseSelectorList, parseTcss } from "../src/index.js";

describe("TCSS parsing", () => {
  it("parses and serializes a stylesheet through css-tree", () => {
    const stylesheet = parseTcss("Button.primary > Label, #save:focus { color: red; padding: 1 2; }", {
      origin: "user",
    });

    expect(generateTcss(stylesheet.ast)).toBe("Button.primary>Label,#save:focus{color:red;padding:1 2}");
  });

  it("expands nested rules and substitutes source variables", () => {
    const stylesheet = parseTcss(
      `
        $accent: tomato;

        Screen {
          background: black;

          Label {
            color: $accent;
          }

          & > .item {
            padding: 1 2;
          }
        }
      `,
      { origin: "user" },
    );

    expect(stylesheet.flatSource).toContain("Screen { background: black; }");
    expect(stylesheet.flatSource).toContain("Screen Label { color: tomato; }");
    expect(stylesheet.flatSource).toContain("Screen > .item { padding: 1 2; }");
  });

  it("parses selectors and specificity for type, class, id, pseudo, and combinators", () => {
    const selectors = parseSelectorList("Button.primary:focus > Label + #save ~ .status");

    expect(selectors).toHaveLength(1);
    expect(selectors[0].specificity).toEqual({ ids: 1, classes: 3, types: 2 });
    expect(selectors[0].combinators).toEqual([">", "+", "~"]);
  });

  it("parses axis-aware scalar values", () => {
    expect(parseScalar("10", "width").equals(new Scalar(10, Unit.CELLS, Unit.WIDTH))).toBe(true);
    expect(parseScalar("25%", "height").equals(new Scalar(25, Unit.PERCENT, Unit.HEIGHT))).toBe(true);
    expect(parseScalar("1fr", "width").equals(new Scalar(1, Unit.FRACTION, Unit.WIDTH))).toBe(true);
    expect(parseScalar("30vw", "width").equals(new Scalar(30, Unit.WIDTH, Unit.WIDTH))).toBe(true);
    expect(parseScalar("40vh", "height").equals(new Scalar(40, Unit.HEIGHT, Unit.HEIGHT))).toBe(true);
  });
});
