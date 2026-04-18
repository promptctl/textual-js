/**
 * Capture frames from textual-js fixtures.
 *
 * Runs each fixture component headlessly at a fixed terminal size, then saves:
 *   - An ANSI frame (the raw Ink output with escape codes)
 *   - A styled cell grid (for automated style-aware diff)
 *   - A plain-text grid (diagnostic only)
 *
 * Usage:
 *   npx tsx visual-tests/capture_js.ts [fixture_name]
 *
 * Output goes to visual-tests/snapshots/js/<fixture_name>.ansi
 *                                          <fixture_name>.txt
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import React from "react";

import { runTest } from "../src/index.js";
import { parseAnsiToStyledGrid, styledGridToText } from "./styled-grid.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const FIXTURE_MANIFEST_PATH = join(__dirname, "fixtures.json");
const SNAPSHOTS_DIR = join(__dirname, "snapshots", "js");

const TERMINAL_WIDTH = 80;
const TERMINAL_HEIGHT = 24;

async function discoverFixtures(): Promise<string[]> {
  const manifest = JSON.parse(await readFile(FIXTURE_MANIFEST_PATH, "utf-8")) as string[];
  return [...manifest].sort();
}

async function captureFixture(name: string): Promise<void> {
  process.stdout.write(`  Capturing: ${name}\n`);

  // Dynamic import of the fixture module
  const fixturePath = join(FIXTURES_DIR, `${name}.tsx`);
  const module = await import(fixturePath);
  const FixtureComponent = module.default;

  const session = await runTest(
    React.createElement(FixtureComponent),
    {
      size: { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT },
      appProps: (module.appProps ?? {}) as Record<string, unknown>,
    },
  );

  await session.pilot.pause();

  if (typeof module.capture === "function") {
    await module.capture(session);
  }

  const ansiFrame = session.lastFrame() ?? "";
  const styledGrid = parseAnsiToStyledGrid(ansiFrame);
  const textGrid = styledGridToText(styledGrid);

  const ansiPath = join(SNAPSHOTS_DIR, `${name}.ansi`);
  const jsonPath = join(SNAPSHOTS_DIR, `${name}.json`);
  const txtPath = join(SNAPSHOTS_DIR, `${name}.txt`);

  await writeFile(ansiPath, ansiFrame);
  await writeFile(jsonPath, `${JSON.stringify(styledGrid, null, 2)}\n`);
  await writeFile(txtPath, `${textGrid}${textGrid.length === 0 ? "" : "\n"}`);

  process.stdout.write(`    -> snapshots/js/${name}.ansi\n`);
  process.stdout.write(`    -> snapshots/js/${name}.json\n`);
  process.stdout.write(`    -> snapshots/js/${name}.txt\n`);

  session.unmount();
}

export interface CaptureSummary {
  failedFixtures: string[];
}

export async function captureFixtures(
  fixtures: string[],
  capture: (name: string) => Promise<void> = captureFixture,
): Promise<CaptureSummary> {
  const failedFixtures: string[] = [];

  for (const name of fixtures) {
    try {
      await capture(name);
    } catch (error) {
      failedFixtures.push(name);
      process.stderr.write(
        `  ERROR capturing ${name}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }

  return { failedFixtures };
}

export async function main(): Promise<void> {
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

  const summary = await captureFixtures(fixtures);

  process.stdout.write(`\nDone. Snapshots in: snapshots/js/\n`);

  if (summary.failedFixtures.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
