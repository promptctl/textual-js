import { Segment } from "rich-js";
import { describe, expect, it } from "vitest";

import { Strip } from "../src/index.js";

describe("Strip construction and properties", () => {
  it("reports text and cell length", () => {
    const strip = new Strip([new Segment("hello")]);

    expect(strip.text).toBe("hello");
    expect(strip.cellLength).toBe(5);
  });

  it("caches cell length after first computation", () => {
    const strip = new Strip([new Segment("abc")]);
    const first = strip.cellLength;
    const second = strip.cellLength;

    expect(first).toBe(3);
    expect(second).toBe(3);
  });

  it("handles empty segment list", () => {
    const strip = new Strip([]);

    expect(strip.text).toBe("");
    expect(strip.cellLength).toBe(0);
  });

  it("concatenates text across multiple segments", () => {
    const strip = new Strip([new Segment("foo"), new Segment("bar")]);

    expect(strip.text).toBe("foobar");
    expect(strip.cellLength).toBe(6);
  });

  it("returns segments via toSegments", () => {
    const strip = new Strip([new Segment("a"), new Segment("b")]);
    const segments = strip.toSegments();

    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe("a");
    expect(segments[1].text).toBe("b");
  });
});

describe("Strip join", () => {
  it("joins multiple strips into one", () => {
    const joined = Strip.join([
      new Strip([new Segment("hi")]),
      new Strip([new Segment(" there")]),
    ]);

    expect(joined.text).toBe("hi there");
    expect(joined.cellLength).toBe(8);
  });

  it("joins empty list into empty strip", () => {
    const joined = Strip.join([]);

    expect(joined.text).toBe("");
    expect(joined.cellLength).toBe(0);
  });

  it("joins single strip as identity", () => {
    const original = new Strip([new Segment("solo")]);
    const joined = Strip.join([original]);

    expect(joined.text).toBe("solo");
  });
});

describe("Strip adjustCellLength", () => {
  it("pads with spaces when target exceeds content", () => {
    const strip = new Strip([new Segment("hi")]);
    const padded = strip.adjustCellLength(10);

    expect(padded.cellLength).toBe(10);
    expect(padded.text.startsWith("hi")).toBe(true);
  });

  it("crops when target is less than content", () => {
    const strip = new Strip([new Segment("hello world")]);
    const cropped = strip.adjustCellLength(5);

    expect(cropped.cellLength).toBe(5);
  });

  it("returns same length when target equals content", () => {
    const strip = new Strip([new Segment("exact")]);
    const adjusted = strip.adjustCellLength(5);

    expect(adjusted.cellLength).toBe(5);
    expect(adjusted.text).toBe("exact");
  });
});

describe("Strip crop", () => {
  it("extracts a horizontal sub-range", () => {
    const strip = new Strip([new Segment("he"), new Segment("llo")]);
    const cropped = strip.crop(1, 4);

    expect(cropped.text).toBe("ell");
  });

  it("returns empty strip when end <= start", () => {
    const strip = new Strip([new Segment("hello")]);
    const empty = strip.crop(3, 3);

    expect(empty.text).toBe("");
    expect(empty.cellLength).toBe(0);
  });

  it("handles crop from start of strip", () => {
    const strip = new Strip([new Segment("hello")]);
    const head = strip.crop(0, 3);

    expect(head.text).toBe("hel");
  });
});

describe("Strip simplify", () => {
  it("merges adjacent segments with same style", () => {
    const strip = new Strip([new Segment("he"), new Segment("llo")]);
    const simplified = strip.simplify();

    expect(simplified.text).toBe("hello");
  });
});
