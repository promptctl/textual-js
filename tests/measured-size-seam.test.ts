// [LAW:single-enforcer] The seam only enforces its three obligations — be the
// observer, decide the unmeasured case once, never feed a widget's output back
// into its own measurement — for as long as it is the only door. A widget that
// reads `screenRegion` itself walks around all three silently, and the failure
// it produces (a width that was right once and quietly stopped tracking) looks
// exactly like a correct render. So the door is checked mechanically rather than
// left to review.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const SEAM_MODULE = "src/framework/measured-size.tsx";

// Walked by hand rather than with `readdirSync({ recursive: true })`: that option
// and the `parentPath` it populates land in Node 20.1 and 20.12, while this
// package's `engines` floor is 18.
function sourceFilesUnder(directory: string): string[] {
  return readdirSync(join(repoRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    return entry.isDirectory()
      ? sourceFilesUnder(path)
      : /\.tsx?$/.test(entry.name)
        ? [path]
        : [];
  });
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

  // Narrower than it looks, deliberately: this catches the four historical
  // fallbacks coming back verbatim, not every tiebreak someone could invent. The
  // general case is the sibling test above — a new tiebreak needs the observable,
  // and the observable is unreachable outside the seam.
  it("has not regrown any of the four fallbacks it replaced", () => {
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
