import { describe, expect, it } from "vitest";

import {
  Color,
  Scalar,
  Stylesheet,
  StylesheetParseError,
  TokenError,
  Unit,
  generateTcss,
  is_id_selector,
  parseScalar,
  parseSelectorList,
  parseTcss,
  substitute_references,
  tokenizeTcss,
  UnresolvedVariableError,
} from "../src/index.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

    expect(stylesheet.flatSource).toContain("Screen { background:black; }");
    expect(stylesheet.flatSource).toContain("Screen Label { color:tomato; }");
    expect(stylesheet.flatSource).toContain("Screen>.item { padding:1 2; }");
  });

  it("substitutes newline-terminated and transitive TCSS variables before css-tree parsing", () => {
    const stylesheet = parseTcss(
      `
        $base: tomato
        $accent: $base;

        Button {
          color: $accent;
        }
      `,
      { origin: "user" },
    );

    expect(stylesheet.flatSource).toContain("Button { color:tomato; }");
    expect(stylesheet.rules[0]?.declarations[0]?.value).toEqual(Color.parse("tomato"));
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

  it("scopes DEFAULT_CSS self selectors onto the widget instance", () => {
    const stylesheet = parseTcss(
      `
        .active { color: red; }
        :focus { background: blue; }
      `,
      {
        origin: "default",
        scopeTypeName: "Button",
      },
    );

    expect(stylesheet.flatSource).toContain("Button.active { color:red; }");
    expect(stylesheet.flatSource).toContain("Button:focus { background:blue; }");
  });

  it("normalizes parsed color values at the stylesheet boundary", () => {
    const stylesheet = parseTcss("Button { color: rebeccapurple; background: rgba(2, 3, 4, 2); }", {
      origin: "user",
    });

    expect(stylesheet.rules[0]?.declarations[0]?.value).toEqual(Color.parse("rebeccapurple"));
    expect(stylesheet.rules[0]?.declarations[1]?.value).toEqual(Color.parse("rgba(2, 3, 4, 2)"));
  });

  it("canonicalizes Stage 2 declaration values at parse time", () => {
    const stylesheet = parseTcss(
      `
        Button {
          offset: 5% 40%;
          offset-x: -2;
          offset-y: 10h;
          overflow: hidden auto;
          opacity: 150%;
          text-align: justify;
          text-style: bold italic underline strike reverse;
          text-wrap: ellipsis;
          grid-columns: 1fr 25%;
          grid-rows: 2 3fr;
          grid-size: 3 4;
          align: center middle;
          scrollbar-color: chartreuse;
        }
      `,
      { origin: "user" },
    );
    const declarations = new Map(stylesheet.rules[0]?.declarations.map((declaration) => [declaration.property, declaration.value]));

    expect(declarations.get("offset")).toEqual({
      x: new Scalar(5, Unit.PERCENT, Unit.WIDTH),
      y: new Scalar(40, Unit.PERCENT, Unit.HEIGHT),
    });
    expect(declarations.get("offset-x")).toEqual(new Scalar(-2, Unit.CELLS, Unit.WIDTH));
    expect(declarations.get("offset-y")).toEqual(new Scalar(10, Unit.HEIGHT, Unit.HEIGHT));
    expect(declarations.get("overflow")).toEqual({ x: "hidden", y: "auto" });
    expect(declarations.get("opacity")).toBe(1);
    expect(declarations.get("text-style")).toEqual({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
      reverse: true,
    });
    expect(declarations.get("grid-columns")).toEqual([
      new Scalar(1, Unit.FRACTION, Unit.WIDTH),
      new Scalar(25, Unit.PERCENT, Unit.WIDTH),
    ]);
    expect(declarations.get("grid-rows")).toEqual([
      new Scalar(2, Unit.CELLS, Unit.HEIGHT),
      new Scalar(3, Unit.FRACTION, Unit.HEIGHT),
    ]);
    expect(declarations.get("grid-size")).toEqual([3, 4]);
    expect(declarations.get("align")).toEqual({ horizontal: "center", vertical: "middle" });
    expect(declarations.get("scrollbar-color")).toEqual(Color.parse("chartreuse"));
  });

  it("keeps important and declaration order metadata at the parser boundary", () => {
    const stylesheet = parseTcss(".a { color: red !important; color: blue; } .a { background: white; }", {
      origin: "user",
    });

    expect(stylesheet.rules[0]?.order).toBe(0);
    expect(stylesheet.rules[1]?.order).toBe(1);
    expect(stylesheet.rules[0]?.declarations[0]).toMatchObject({
      property: "color",
      important: true,
      value: Color.parse("red"),
    });
    expect(stylesheet.rules[0]?.declarations[1]).toMatchObject({
      property: "color",
      important: false,
      value: Color.parse("blue"),
    });
  });

  it("exports token streams and substitutes variables with provenance", () => {
    const tokens = tokenizeTcss("$pad: 2 4;\n.card { padding: $pad; }");
    const substituted = substitute_references(tokens);
    const numbers = substituted.filter((token) => token.name === "number");

    expect(tokens.some((token) => token.name === "variable_name" && token.value === "$pad:")).toBe(true);
    expect(numbers.map((token) => token.value)).toEqual(["2", "4"]);
    expect(numbers.every((token) => token.referenced_by?.name === "$pad")).toBe(true);
  });

  it("validates selector utilities and pseudo-class suggestions", () => {
    expect(is_id_selector("#foo")).toBe(true);
    expect(is_id_selector("#5foo")).toBe(false);
    expect(() => tokenizeTcss("Button:foucs { color: red; }")).toThrow(TokenError);
    expect(() => parseTcss("Button:foucs { color: red; }", { origin: "user" })).toThrow(/focus/);
  });

  it("parses transitions and Stylesheet file sources", () => {
    const stylesheet = parseTcss("Button { transition: width 1200ms in_out_cubic 0.5s; }", { origin: "user" });
    const transition = stylesheet.rules[0]?.declarations[0]?.value;
    const directory = mkdtempSync(join(tmpdir(), "textual-js-css-"));
    const path = join(directory, "mega.tcss");

    writeFileSync(path, ".---we-made-it-to-the-end--- { color: red; }");

    const loaded = Stylesheet.read(path);
    loaded.parse();

    expect(transition).toEqual([{ property: "width", duration: 1.2, easing: "in_out_cubic", delay: 0.5 }]);
    expect(loaded.rules[0]?.selectors[0]?.raw).toBe(".---we-made-it-to-the-end---");
    expect(() => parseTcss("Button { transition: width 1s not_real; }", { origin: "user" })).toThrow(/easing/);
  });

  it("canonicalizes nested selector expansion before cascade consumption", () => {
    const stylesheet = parseTcss(
      `
        Vertical {
          Button:light {
            background: red;
          }

          min-height: 3;

          #two, *:focus {
            background: green !important;
          }

          height: auto;

          Label {
            background: yellow;

            &:light, &:dark {
              color: blue;
            }

            &:hover {
              background: orange !important;
            }
          }
        }
      `,
      { origin: "user" },
    );

    expect(stylesheet.flatSource).toContain("Vertical { min-height:3; height:auto; }");
    expect(stylesheet.flatSource).toContain("Vertical Button:light { background:red; }");
    expect(stylesheet.flatSource).toContain("Vertical #two, Vertical *:focus { background:green!important; }");
    expect(stylesheet.flatSource).toContain("Vertical Label:hover { background:orange!important; }");
  });

  it("raises explicit parse errors for malformed TCSS and declaration values", () => {
    expect(() => parseTcss("Button { color: $missing; }", { origin: "user" })).toThrow(UnresolvedVariableError);
    expect(() => parseTcss("Button { colr: red; }", { origin: "user" })).toThrow(/color/);
    expect(() => parseTcss("Button { color: blu; }", { origin: "user" })).toThrow(/blue/);
    expect(() => parseTcss("Button { width: 10px; }", { origin: "user" })).toThrow(StylesheetParseError);
    expect(() => parseTcss("Button { text-align: sideways; }", { origin: "user" })).toThrow(StylesheetParseError);
    expect(() => parseTcss("Selector {", { origin: "user" })).toThrow(StylesheetParseError);
    expect(() => parseTcss("Selector{ Foo {", { origin: "user" })).toThrow(StylesheetParseError);
    expect(() => parseTcss("&.foo { color: red; }", { origin: "user" })).toThrow(StylesheetParseError);
    expect(() => parseTcss("& { color: red; }", { origin: "user" })).toThrow(TokenError);
  });
});
