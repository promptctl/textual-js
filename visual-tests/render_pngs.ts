import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { discoverPairedFixtures } from "./discover-fixtures.ts";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const SNAPSHOTS_DIR = join(__dirname, "snapshots");
const DISPLAY_SCRIPT = resolve(__dirname, "display-ansi.sh");
const WINDOW_FINDER = resolve(__dirname, "find-window.swift");
const WINDOW_READY_TIMEOUT_MS = 5000;
const WINDOW_CAPTURE_DELAY_MS = 300;
const WINDOW_OWNER = "Ghostty";

type SnapshotSide = "python" | "js";

interface CaptureTarget {
  fixture: string;
  side: SnapshotSide;
  ansiPath: string;
  pngPath: string;
  title: string;
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, delayMs);
  });
}

async function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  // [LAW:dataflow-not-control-flow] File readiness is polled through one
  // repeated check path; timeout is data, not a separate waiting branch.
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await access(path, fsConstants.F_OK);
      return;
    } catch {
      await sleep(50);
    }
  }

  throw new Error(`Timed out waiting for render-ready signal: ${path}`);
}

async function runAppleScript(source: string): Promise<string> {
  const { stdout } = await execFileAsync("osascript", ["-e", source], {
    cwd: __dirname,
    env: process.env,
  });
  return stdout.trim();
}

async function openCaptureWindow(command: string): Promise<string> {
  const script = `
    tell application "Ghostty"
      set cfg to new surface configuration
      set command of cfg to "${escapeAppleScriptString(command)}"
      set wait after command of cfg to true
      set captureWindow to new window with configuration cfg
      return id of captureWindow
    end tell
  `;

  return runAppleScript(script);
}

async function closeCaptureWindow(windowId: string): Promise<void> {
  const script = `
    tell application "Ghostty"
      if (exists (first window whose id is "${escapeAppleScriptString(windowId)}")) then
        close window (first window whose id is "${escapeAppleScriptString(windowId)}")
      end if
    end tell
  `;

  await runAppleScript(script);
}

async function resolveCapturedWindowNumber(title: string): Promise<number> {
  const { stdout } = await execFileAsync("swift", [WINDOW_FINDER, WINDOW_OWNER, title], {
    cwd: __dirname,
    env: process.env,
  });

  const payload = JSON.parse(stdout) as { id: number };
  return payload.id;
}

async function waitForCapturedWindowNumber(title: string): Promise<number> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < WINDOW_READY_TIMEOUT_MS) {
    try {
      return await resolveCapturedWindowNumber(title);
    } catch {
      await sleep(50);
    }
  }

  throw new Error(`Timed out waiting for Ghostty window titled "${title}"`);
}

async function captureWindow(windowNumber: number, outputPath: string): Promise<void> {
  await execFileAsync("screencapture", ["-x", "-o", "-l", String(windowNumber), outputPath], {
    cwd: __dirname,
    env: process.env,
  });
}

async function renderTarget(target: CaptureTarget): Promise<void> {
  const controlPath = join(SNAPSHOTS_DIR, ".tmp", `${target.side}-${target.fixture}.control`);
  const readyPath = join(SNAPSHOTS_DIR, ".tmp", `${target.side}-${target.fixture}.ready`);

  await mkdir(dirname(controlPath), { recursive: true });
  await mkdir(dirname(target.pngPath), { recursive: true });
  await rm(controlPath, { force: true });
  await rm(readyPath, { force: true });
  await writeFile(controlPath, "");

  const command = [
    "bash",
    shellQuote(DISPLAY_SCRIPT),
    shellQuote(target.ansiPath),
    shellQuote(readyPath),
    shellQuote(controlPath),
    shellQuote(target.title),
  ].join(" ");

  let windowId = "";

  try {
    windowId = await openCaptureWindow(command);
    await waitForFile(readyPath, WINDOW_READY_TIMEOUT_MS);
    const windowNumber = await waitForCapturedWindowNumber(target.title);
    await sleep(WINDOW_CAPTURE_DELAY_MS);
    await captureWindow(windowNumber, target.pngPath);
  } finally {
    await rm(controlPath, { force: true });
    await rm(readyPath, { force: true });

    if (windowId.length > 0) {
      await sleep(150);
      await closeCaptureWindow(windowId);
    }
  }
}

async function discoverFixtures(): Promise<string[]> {
  return discoverPairedFixtures(FIXTURES_DIR);
}

function buildTargets(fixtures: string[]): CaptureTarget[] {
  return fixtures.flatMap((fixture) => {
    const title = `textual-js visual fixture: ${fixture}`;
    return (["python", "js"] as const).map((side) => ({
      fixture,
      side,
      ansiPath: join(SNAPSHOTS_DIR, side, `${fixture}.ansi`),
      pngPath: join(SNAPSHOTS_DIR, side, `${fixture}.png`),
      title,
    }));
  });
}

export async function main(): Promise<void> {
  const fixtureFilter = process.argv[2] ?? null;
  let fixtures = await discoverFixtures();

  if (fixtureFilter) {
    fixtures = fixtures.filter((name) => name === fixtureFilter);
    if (fixtures.length === 0) {
      process.stderr.write(`No fixture found matching: ${fixtureFilter}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(`Rendering ${fixtures.length} fixture screenshot pair(s)...\n\n`);

  const targets = buildTargets(fixtures);

  for (const target of targets) {
    process.stdout.write(`  Capturing ${target.side}: ${target.fixture}\n`);
    await renderTarget(target);
    process.stdout.write(`    -> snapshots/${target.side}/${target.fixture}.png\n`);
  }

  process.stdout.write("\nDone. PNG snapshots in: snapshots/python/ and snapshots/js/\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
