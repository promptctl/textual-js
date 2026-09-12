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

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import React from "react";
import stringWidth from "string-width";

import { runTest } from "../src/index.js";
import { discoverPairedFixtures } from "./discover-fixtures.ts";
import { parseAnsiToStyledGrid, styledGridToText } from "./styled-grid.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const SNAPSHOTS_DIR = join(__dirname, "snapshots", "js");

const TERMINAL_WIDTH = 80;
const TERMINAL_HEIGHT = 24;

function readEscapeSequenceEnd(output: string, startIndex: number): number {
  const nextCharacter = output[startIndex + 1];

  if (nextCharacter === "[") {
    let index = startIndex + 2;

    while (index < output.length) {
      const character = output[index];

      if (character >= "@" && character <= "~") {
        return index + 1;
      }

      index += 1;
    }
  }

  if (nextCharacter === "]") {
    let index = startIndex + 2;

    while (index < output.length) {
      if (output[index] === "\u0007") {
        return index + 1;
      }

      if (output[index] === "\u001B" && output[index + 1] === "\\") {
        return index + 2;
      }

      index += 1;
    }
  }

  return Math.min(output.length, startIndex + 2);
}

function measureAnsiCursor(output: string): { row: number; column: number } {
  let row = 0;
  let column = 0;
  let index = 0;

  while (index < output.length) {
    const character = output[index];

    if (character === "\u001B") {
      index = readEscapeSequenceEnd(output, index);
      continue;
    }

    if (character === "\r") {
      column = 0;
      index += 1;
      continue;
    }

    if (character === "\n") {
      row += 1;
      column = 0;
      index += 1;
      continue;
    }

    const codePoint = output.codePointAt(index);

    if (codePoint === undefined) {
      break;
    }

    const glyph = String.fromCodePoint(codePoint);
    column += stringWidth(glyph);
    index += glyph.length;
  }

  return { row, column };
}

function padAnsiFrameToTerminalSize(output: string): string {
  const cursor = measureAnsiCursor(output);
  const rowsToAppend = Math.max(0, TERMINAL_HEIGHT - cursor.row - 1);
  const columnAfterRows = rowsToAppend > 0 ? 0 : cursor.column;
  const columnsToAppend = Math.max(0, TERMINAL_WIDTH - columnAfterRows);

  // [LAW:one-source-of-truth] JS capture owns the translation from Ink output
  // into the fixed terminal frame consumed by the screenshot renderer.
  return `${output}${"\n".repeat(rowsToAppend)}${" ".repeat(columnsToAppend)}`;
}

async function discoverFixtures(): Promise<string[]> {
  return discoverPairedFixtures(FIXTURES_DIR);
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
      // [LAW:one-source-of-truth] runner_js.tsx renders the fixture with the app's
      // own defaults, where toasts and tooltips both exist; runTest defaults both
      // off for unit tests that never asked for them. Restoring them here is what
      // makes this path capture the same app the PNG path draws — the mirror of
      // capture_python.py's run_test(tooltips=True, notifications=True).
      transients: { tooltips: true, notifications: true },
    },
  );

  await session.pilot.pause();

  if (typeof module.capture === "function") {
    await module.capture(session);
  }

  const ansiFrame = padAnsiFrameToTerminalSize(session.lastFrame() ?? "");
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
