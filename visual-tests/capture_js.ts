/**
 * Capture frames from textual-js fixtures.
 *
 * Runs each fixture component headlessly at a fixed terminal size, then saves:
 *   - An ANSI frame (the raw Ink output with escape codes)
 *   - A plain-text grid (ANSI stripped, for automated text diff)
 *
 * Usage:
 *   npx tsx visual-tests/capture_js.ts [fixture_name]
 *
 * Output goes to visual-tests/snapshots/js/<fixture_name>.ansi
 *                                          <fixture_name>.txt
 */

import { readdir } from "node:fs/promises";
import { writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import React from "react";

import { runTest } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const SNAPSHOTS_DIR = join(__dirname, "snapshots", "js");

const TERMINAL_WIDTH = 80;
const TERMINAL_HEIGHT = 24;

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\x1B\][^\x07]*\x07/g, "")
    .replace(/\x1B\][^\x1B]*\x1B\\/g, "");
}

async function discoverFixtures(): Promise<string[]> {
  const entries = await readdir(FIXTURES_DIR);
  return entries
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => name.replace(/\.tsx$/, ""))
    .sort();
}

async function captureFixture(name: string): Promise<void> {
  process.stdout.write(`  Capturing: ${name}\n`);

  // Dynamic import of the fixture module
  const fixturePath = join(FIXTURES_DIR, `${name}.tsx`);
  const module = await import(fixturePath);
  const FixtureComponent = module.default;

  const session = await runTest(
    React.createElement(FixtureComponent),
    { size: { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT } },
  );

  await session.pilot.pause();

  const ansiFrame = session.lastFrame() ?? "";
  const textGrid = stripAnsi(ansiFrame);

  // Remove trailing blank lines from text grid
  const lines = textGrid.split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  const ansiPath = join(SNAPSHOTS_DIR, `${name}.ansi`);
  const txtPath = join(SNAPSHOTS_DIR, `${name}.txt`);

  await writeFile(ansiPath, ansiFrame);
  await writeFile(txtPath, lines.join("\n") + "\n");

  process.stdout.write(`    -> snapshots/js/${name}.ansi\n`);
  process.stdout.write(`    -> snapshots/js/${name}.txt\n`);

  session.unmount();
}

async function main(): Promise<void> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });

  const fixtureFilter = process.argv[2] ?? null;
  let fixtures = await discoverFixtures();

  if (fixtureFilter) {
    fixtures = fixtures.filter((name) => name === fixtureFilter);
    if (fixtures.length === 0) {
      process.stderr.write(`No fixture found matching: ${fixtureFilter}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(
    `Capturing ${fixtures.length} textual-js fixture(s)...\n\n`,
  );

  for (const name of fixtures) {
    try {
      await captureFixture(name);
    } catch (error) {
      process.stderr.write(
        `  ERROR capturing ${name}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  process.stdout.write(`\nDone. Snapshots in: snapshots/js/\n`);
}

main().catch((error) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
