/**
 * Compare Python Textual and textual-js snapshots.
 *
 * Reads the plain-text grids from both snapshot directories and produces a
 * per-fixture diff report. Each cell is compared character by character.
 *
 * Usage:
 *   npx tsx visual-tests/compare.ts [fixture_name]
 *
 * Exit code:
 *   0 — all fixtures match (or are within tolerance)
 *   1 — at least one fixture has differences
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PYTHON_DIR = join(__dirname, "snapshots", "python");
const JS_DIR = join(__dirname, "snapshots", "js");

interface CellDiff {
  row: number;
  col: number;
  python: string;
  js: string;
}

interface FixtureReport {
  name: string;
  status: "match" | "diff" | "missing-python" | "missing-js";
  diffs: CellDiff[];
  pythonLines: number;
  jsLines: number;
  matchPercentage: number;
}

function diffTextGrids(pythonText: string, jsText: string): { diffs: CellDiff[]; matchPercentage: number } {
  const pythonLines = pythonText.split("\n");
  const jsLines = jsText.split("\n");
  const maxRows = Math.max(pythonLines.length, jsLines.length);
  const diffs: CellDiff[] = [];
  let totalCells = 0;
  let matchingCells = 0;

  for (let row = 0; row < maxRows; row++) {
    const pyLine = pythonLines[row] ?? "";
    const jsLine = jsLines[row] ?? "";
    const maxCols = Math.max(pyLine.length, jsLine.length);

    for (let col = 0; col < maxCols; col++) {
      const pyChar = pyLine[col] ?? " ";
      const jsChar = jsLine[col] ?? " ";
      totalCells++;

      if (pyChar === jsChar) {
        matchingCells++;
      } else {
        diffs.push({ row, col, python: pyChar, js: jsChar });
      }
    }
  }

  const matchPercentage = totalCells === 0 ? 100 : (matchingCells / totalCells) * 100;
  return { diffs, matchPercentage };
}

function renderDiffSummary(report: FixtureReport): string {
  const lines: string[] = [];

  if (report.status === "missing-python") {
    lines.push(`  ${report.name}: FAIL (no Python snapshot)`);
    return lines.join("\n");
  }

  if (report.status === "missing-js") {
    lines.push(`  ${report.name}: FAIL (no JS snapshot)`);
    return lines.join("\n");
  }

  if (report.status === "match") {
    lines.push(`  ${report.name}: MATCH (${report.matchPercentage.toFixed(1)}%)`);
    return lines.join("\n");
  }

  lines.push(`  ${report.name}: DIFF (${report.matchPercentage.toFixed(1)}% match, ${report.diffs.length} cells differ)`);
  lines.push(`    Python: ${report.pythonLines} lines, JS: ${report.jsLines} lines`);

  // Show first N diffs
  const maxShown = 10;
  const shown = report.diffs.slice(0, maxShown);

  for (const diff of shown) {
    const pyDisplay = diff.python === " " ? "SP" : JSON.stringify(diff.python);
    const jsDisplay = diff.js === " " ? "SP" : JSON.stringify(diff.js);
    lines.push(`    [${diff.row}:${diff.col}] Python=${pyDisplay} JS=${jsDisplay}`);
  }

  if (report.diffs.length > maxShown) {
    lines.push(`    ... and ${report.diffs.length - maxShown} more`);
  }

  return lines.join("\n");
}

export interface ComparisonSummary {
  matched: number;
  diffed: number;
  missing: number;
}

export function summarizeReports(reports: FixtureReport[]): ComparisonSummary {
  return {
    matched: reports.filter((report) => report.status === "match").length,
    diffed: reports.filter((report) => report.status === "diff").length,
    missing: reports.filter((report) => report.status === "missing-python" || report.status === "missing-js").length,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function discoverFixtures(): Promise<string[]> {
  const names = new Set<string>();

  try {
    const pyFiles = await readdir(PYTHON_DIR);
    for (const file of pyFiles) {
      if (file.endsWith(".txt")) {
        names.add(file.replace(/\.txt$/, ""));
      }
    }
  } catch {
    // Directory may not exist yet
  }

  try {
    const jsFiles = await readdir(JS_DIR);
    for (const file of jsFiles) {
      if (file.endsWith(".txt")) {
        names.add(file.replace(/\.txt$/, ""));
      }
    }
  } catch {
    // Directory may not exist yet
  }

  return [...names].sort();
}

async function compareFixture(name: string): Promise<FixtureReport> {
  const pyPath = join(PYTHON_DIR, `${name}.txt`);
  const jsPath = join(JS_DIR, `${name}.txt`);

  const pyExists = await fileExists(pyPath);
  const jsExists = await fileExists(jsPath);

  if (!pyExists) {
    return { name, status: "missing-python", diffs: [], pythonLines: 0, jsLines: 0, matchPercentage: 0 };
  }

  if (!jsExists) {
    return { name, status: "missing-js", diffs: [], pythonLines: 0, jsLines: 0, matchPercentage: 0 };
  }

  const pyText = (await readFile(pyPath, "utf-8")).trimEnd();
  const jsText = (await readFile(jsPath, "utf-8")).trimEnd();

  const { diffs, matchPercentage } = diffTextGrids(pyText, jsText);

  return {
    name,
    status: diffs.length === 0 ? "match" : "diff",
    diffs,
    pythonLines: pyText.split("\n").length,
    jsLines: jsText.split("\n").length,
    matchPercentage,
  };
}

export async function main(): Promise<void> {
  const fixtureFilter = process.argv[2] ?? null;
  let fixtures = await discoverFixtures();

  if (fixtures.length === 0) {
    process.stdout.write("No snapshots found. Run capture_python.py and capture_js.ts first.\n");
    process.exit(0);
  }

  if (fixtureFilter) {
    fixtures = fixtures.filter((name) => name === fixtureFilter);
    if (fixtures.length === 0) {
      process.stderr.write(`No fixture found matching: ${fixtureFilter}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(`Comparing ${fixtures.length} fixture(s)...\n\n`);

  const reports: FixtureReport[] = [];

  for (const name of fixtures) {
    const report = await compareFixture(name);
    reports.push(report);
    process.stdout.write(renderDiffSummary(report) + "\n");
  }

  const summary = summarizeReports(reports);

  process.stdout.write(`\nSummary: ${summary.matched} match, ${summary.diffed} diff, ${summary.missing} missing\n`);

  if (summary.diffed > 0 || summary.missing > 0) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
