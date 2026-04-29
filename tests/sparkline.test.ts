import { describe, expect, it } from "vitest";

import {
  SparklineModel as Sparkline,
  renderSparkline,
  renderSparklineRows,
  summaryMin,
  summaryMax,
} from "../src/widgets/sparkline.js";

describe("Sparkline renderable", () => {
  it("renders data as block characters", () => {
    const result = renderSparkline([0, 1, 2, 3, 4, 5, 6, 7], 8);

    expect(result).toHaveLength(8);
    // First char should be lowest block, last should be highest
    expect(result[0]).toBe("▁");
    expect(result[7]).toBe("█");
  });

  it("renders empty data as minimum blocks", () => {
    const result = renderSparkline([], 5);

    expect(result).toHaveLength(5);
    // All blocks should be the same (no range)
    expect(new Set(result.split("")).size).toBe(1);
  });

  it("renders single data point", () => {
    const result = renderSparkline([42], 3);

    expect(result).toHaveLength(3);
    // All blocks the same since min === max
    expect(new Set(result.split("")).size).toBe(1);
  });

  it("expands fewer data points than width", () => {
    const result = renderSparkline([0, 10], 6);

    expect(result).toHaveLength(6);
    // Should have variation between low and high blocks
    expect(result[0]).toBe("▁");
    expect(result[result.length - 1]).toBe("█");
  });

  it("aggregates more data points than width", () => {
    const result = renderSparkline([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);

    expect(result).toHaveLength(3);
  });

  it("handles uniform data (all same value)", () => {
    const result = renderSparkline([5, 5, 5, 5], 4);

    expect(result).toHaveLength(4);
    expect(new Set(result.split("")).size).toBe(1);
  });

  it("uses the Sparkline class for encapsulation", () => {
    const sparkline = new Sparkline([1, 5, 3, 7, 2]);
    const rendered = sparkline.render();

    expect(rendered).toHaveLength(5);
    expect(typeof rendered).toBe("string");
  });

  it("respects explicit width option", () => {
    const sparkline = new Sparkline([1, 2, 3], { width: 10 });
    const rendered = sparkline.render();

    expect(rendered).toHaveLength(10);
  });

  it("defaults width to data length", () => {
    const sparkline = new Sparkline([1, 2, 3, 4]);
    expect(sparkline.width).toBe(4);
  });

  it("renders three rows for height=3 with the expected stacking", () => {
    // Mirrors visual-tests/fixtures/sparkline_basic.py (data 1..10 at width 40).
    const rows = renderSparklineRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
      width: 40,
      height: 3,
    });

    expect(rows).toHaveLength(3);
    expect(rows[2]).toBe("▁▁▁▁▃▃▃▃▆▆▆▆████████████████████████████");
    expect(rows[1]).toBe("                ▃▃▃▃▅▅▅▅████████████████");
    expect(rows[0]).toBe("                            ▂▂▂▂▅▅▅▅████");
  });

  it("min and max summaries differ when buckets contain multiple points", () => {
    const data = [1, 9, 2, 8, 3, 7, 4, 6];
    const minRow = renderSparklineRows(data, { width: 4, summary: summaryMin })[0];
    const maxRow = renderSparklineRows(data, { width: 4, summary: summaryMax })[0];

    expect(minRow).not.toBe(maxRow);
  });

  it("matches Python Textual's bucket pattern for sparkline_summary_max", () => {
    // Mirrors visual-tests/fixtures/sparkline_summary_max.py baseline.
    const rows = renderSparklineRows(
      [5, 1, 4, 2, 8, 3, 9, 2, 7, 1, 6, 4, 8, 2, 9, 3],
      { width: 40, height: 3, summary: summaryMax },
    );

    expect(rows[2]).toBe("███▁▁███▃▃▃██▆▆███▃▃███▁▁████████▃▃███▆▆");
  });
});
