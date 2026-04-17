import { Segment } from "rich-js";
import { describe, expect, it } from "vitest";

import { Strip } from "../src/index.js";

describe("Strip", () => {
  it("reports text and cell length", () => {
    const strip = new Strip([new Segment("hello")]);

    expect(strip.text).toBe("hello");
    expect(strip.cellLength).toBe(5);
  });

  it("joins and adjusts line length", () => {
    const joined = Strip.join([new Strip([new Segment("hi")]), new Strip([new Segment(" there")])]);
    const padded = joined.adjustCellLength(10);

    expect(joined.text).toBe("hi there");
    expect(padded.cellLength).toBe(10);
  });

  it("crops and simplifies segments", () => {
    const strip = new Strip([new Segment("he"), new Segment("llo")]);
    const cropped = strip.crop(1, 4);
    const simplified = strip.simplify();

    expect(cropped.text).toBe("ell");
    expect(simplified.text).toBe("hello");
  });
});
