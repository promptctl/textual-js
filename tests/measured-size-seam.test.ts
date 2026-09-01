// [LAW:single-enforcer] The seam only enforces its three obligations — be the
// observer, decide the unmeasured case once, never feed a widget's output back
// into its own measurement — for as long as it is the only door. A widget that
// reads `screenRegion` itself walks around all three silently, and the failure
// it produces (a width that was right once and quietly stopped tracking) looks
// exactly like a correct render. So the door is checked mechanically rather than
// left to review.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const SEAM_MODULE = "src/framework/measured-size.tsx";

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(join(repoRoot, directory), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => relative(repoRoot, join(entry.parentPath, entry.name)));
}

function linesMatching(files: string[], pattern: RegExp): string[] {
  return files.flatMap((file) =>
    readFileSync(join(repoRoot, file), "utf8")
      .split("\n")
      .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : [])),
  );
}

describe("measured-size seam", () => {
  it("is the only reader of screenRegion in the rendering layer", () => {
    const renderingLayer = [...sourceFilesUnder("src/widgets"), ...sourceFilesUnder("src/content")];

    expect(linesMatching(renderingLayer, /screenRegion/)).toEqual([]);
  });

  it("is the only place the unmeasured case is decided", () => {
    // The four answers this seam replaced, each written by a widget that had no
    // way to tell "zero columns" from "never measured".
    const abandonedFallbacks = /Math\.max\(0, region\.width\)|screenRegion\.width > 0 \?|cssWidth \?\? region\.width|containerWidth <= 0/;
    const everySource = [
      ...sourceFilesUnder("src/widgets"),
      ...sourceFilesUnder("src/content"),
      ...sourceFilesUnder("src/framework"),
    ].filter((file) => file !== SEAM_MODULE);

    expect(linesMatching(everySource, abandonedFallbacks)).toEqual([]);
  });
});
