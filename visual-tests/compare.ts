import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { discoverKnownDiffFixtures, discoverPairedFixtures } from "./discover-fixtures.ts";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PYTHON_DIR = join(__dirname, "snapshots", "python");
const JS_DIR = join(__dirname, "snapshots", "js");
const DIFF_DIR = join(__dirname, "snapshots", "diff");
const FIXTURES_DIR = join(__dirname, "fixtures");

interface FixtureReport {
  name: string;
  status: "match" | "diff" | "missing-python" | "missing-js" | "size-mismatch";
  // Whether fixture-todos.json records a reason this pair is expected to differ.
  // Deliberately separate from `status`: the status is what the pixels measured,
  // this is what we decided about it beforehand, and collapsing the two would
  // make a fixture that starts matching indistinguishable from one still
  // waiting on its widget. [LAW:one-source-of-truth]
  knownDiff: boolean;
  pixelDiffCount: number;
  pythonSize: string;
  jsSize: string;
  diffPath?: string;
}

function renderDiffSummary(report: FixtureReport): string {
  if (report.status === "missing-python") {
    return `  ${report.name}: FAIL (no Python PNG snapshot)`;
  }

  if (report.status === "missing-js") {
    return `  ${report.name}: FAIL (no JS PNG snapshot)`;
  }

  // A known diff still prints its pixel count — the number is how you notice the
  // gap closing, and a suppressed fixture that prints nothing tells you nothing.
  const label = report.knownDiff ? "KNOWN DIFF" : "DIFF";

  if (report.status === "size-mismatch") {
    return `  ${report.name}: ${label} (size mismatch: Python ${report.pythonSize}, JS ${report.jsSize})`;
  }

  if (report.status === "match") {
    return `  ${report.name}: MATCH (${report.pythonSize}, 0 differing pixels)`;
  }

  return `  ${report.name}: ${label} (${report.pixelDiffCount} differing pixels, diff: snapshots/diff/${report.name}.png)`;
}

export interface ComparisonSummary {
  matched: number;
  diffed: number;
  knownDiff: number;
  missing: number;
}

// [LAW:no-silent-failure] `knownDiff` withholds a *differing* fixture from the
// gate and nothing else. A missing PNG on a known-diff pair still counts as
// missing: "we expect the body rows to differ" is not "we expect the render to
// have never happened."
export function summarizeReports(reports: FixtureReport[]): ComparisonSummary {
  const differing = reports.filter(
    (report) => report.status === "diff" || report.status === "size-mismatch",
  );

  return {
    matched: reports.filter((report) => report.status === "match").length,
    diffed: differing.filter((report) => !report.knownDiff).length,
    knownDiff: differing.filter((report) => report.knownDiff).length,
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

async function readImageSize(path: string): Promise<string> {
  const { stdout } = await execFileAsync("magick", ["identify", "-format", "%wx%h", path], {
    cwd: __dirname,
    env: process.env,
  });
  return stdout.trim();
}

async function compareImages(pythonPath: string, jsPath: string, diffPath: string): Promise<number> {
  try {
    const { stderr } = await execFileAsync(
      "magick",
      ["compare", "-metric", "AE", pythonPath, jsPath, diffPath],
      { cwd: __dirname, env: process.env },
    );
    return parseFloat(stderr.trim().split(/\s+/)[0] ?? "0");
  } catch (error) {
    const failure = error as { code?: number; stderr?: string };
    if (failure.code === 1) {
      return parseFloat(((failure.stderr ?? "").trim().split(/\s+/)[0]) ?? "0");
    }
    throw error;
  }
}

async function compareFixture(name: string, knownDiff: boolean): Promise<FixtureReport> {
  const pyPath = join(PYTHON_DIR, `${name}.png`);
  const jsPath = join(JS_DIR, `${name}.png`);
  const diffPath = join(DIFF_DIR, `${name}.png`);

  const pyExists = await fileExists(pyPath);
  const jsExists = await fileExists(jsPath);

  if (!pyExists) {
    return { name, status: "missing-python", knownDiff, pixelDiffCount: 0, pythonSize: "-", jsSize: "-" };
  }

  if (!jsExists) {
    return { name, status: "missing-js", knownDiff, pixelDiffCount: 0, pythonSize: "-", jsSize: "-" };
  }

  const [pythonSize, jsSize] = await Promise.all([readImageSize(pyPath), readImageSize(jsPath)]);

  if (pythonSize !== jsSize) {
    return {
      name,
      status: "size-mismatch",
      knownDiff,
      pixelDiffCount: 0,
      pythonSize,
      jsSize,
      diffPath,
    };
  }

  const pixelDiffCount = await compareImages(pyPath, jsPath, diffPath);
  const status = pixelDiffCount === 0 ? "match" : "diff";

  if (status === "match") {
    await rm(diffPath, { force: true });
  }

  return {
    name,
    status,
    knownDiff,
    pixelDiffCount,
    pythonSize,
    jsSize,
    diffPath,
  };
}

export async function main(): Promise<void> {
  await mkdir(DIFF_DIR, { recursive: true });

  const fixtureFilter = process.argv[2] ?? null;
  let fixtures = await discoverFixtures();

  if (fixtures.length === 0) {
    process.stdout.write("No fixtures found. Run the capture steps first.\n");
    process.exit(0);
  }

  if (fixtureFilter) {
    fixtures = fixtures.filter((name) => name === fixtureFilter);
    if (fixtures.length === 0) {
      process.stderr.write(`No fixture found matching: ${fixtureFilter}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(`Comparing ${fixtures.length} PNG fixture pair(s)...\n\n`);

  const knownDiffFixtures = await discoverKnownDiffFixtures(FIXTURES_DIR);
  const reports: FixtureReport[] = [];

  for (const name of fixtures) {
    const report = await compareFixture(name, knownDiffFixtures.has(name));
    reports.push(report);
    process.stdout.write(`${renderDiffSummary(report)}\n`);
  }

  const summary = summarizeReports(reports);
  process.stdout.write(
    `\nSummary: ${summary.matched} match, ${summary.diffed} diff, ${summary.knownDiff} known diff, ${summary.missing} missing\n`,
  );

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
