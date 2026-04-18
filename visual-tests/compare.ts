/**
 * Compare Python Textual and textual-js snapshots.
 *
 * Reads the styled cell grids from both snapshot directories and produces a
 * per-fixture diff report. Each cell is compared character and style by character and style.
 *
 * Usage:
 *   npx tsx visual-tests/compare.ts [fixture_name]
 *
 * Exit code:
 *   0 — all fixtures match (or are within tolerance)
 *   1 — at least one fixture has differences
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { discoverPairedFixtures } from "./discover-fixtures.ts";
import { diffStyledGrids, formatStyledCell, type StyledCellDiff, type StyledGrid } from "./styled-grid.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PYTHON_DIR = join(__dirname, "snapshots", "python");
const JS_DIR = join(__dirname, "snapshots", "js");
const FIXTURES_DIR = join(__dirname, "fixtures");

interface FixtureReport {
  name: string;
  status: "match" | "diff" | "missing-python" | "missing-js";
  diffs: StyledCellDiff[];
  pythonLines: number;
  jsLines: number;
  matchPercentage: number;
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
    lines.push(
      `    [${diff.row}:${diff.col}] Python=${formatStyledCell(diff.python)} JS=${formatStyledCell(diff.js)}`,
    );
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
  return discoverPairedFixtures(FIXTURES_DIR);
}

async function compareFixture(name: string): Promise<FixtureReport> {
  const pyPath = join(PYTHON_DIR, `${name}.json`);
  const jsPath = join(JS_DIR, `${name}.json`);

  const pyExists = await fileExists(pyPath);
  const jsExists = await fileExists(jsPath);

  if (!pyExists) {
    return { name, status: "missing-python", diffs: [], pythonLines: 0, jsLines: 0, matchPercentage: 0 };
  }

  if (!jsExists) {
    return { name, status: "missing-js", diffs: [], pythonLines: 0, jsLines: 0, matchPercentage: 0 };
  }

  const pyGrid = JSON.parse(await readFile(pyPath, "utf-8")) as StyledGrid;
  const jsGrid = JSON.parse(await readFile(jsPath, "utf-8")) as StyledGrid;

  const { diffs, matchPercentage } = diffStyledGrids(pyGrid, jsGrid);

  return {
    name,
    status: diffs.length === 0 ? "match" : "diff",
    diffs,
    pythonLines: pyGrid.rows.length,
    jsLines: jsGrid.rows.length,
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
