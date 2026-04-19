import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { discoverPairedFixtures } from "./discover-fixtures.ts";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_DIR = resolve(__dirname, "..");
const FIXTURES_DIR = join(__dirname, "fixtures");
const SNAPSHOTS_DIR = join(__dirname, "snapshots");
const DOCKERFILE = join(__dirname, "Dockerfile");
const RENDER_SCRIPT = "/work/visual-tests/render-ansi-xvfb.sh";
const DOCKER_IMAGE = "textual-js-visual-tests:local";
const EXEC_MAX_BUFFER = 20 * 1024 * 1024;

type SnapshotSide = "python" | "js";
type RenderSide = SnapshotSide | "both";

interface CaptureTarget {
  fixture: string;
  side: SnapshotSide;
  ansiPath: string;
  pngPath: string;
  title: string;
}

function toContainerPath(path: string): string {
  return `/work/${path}`;
}

async function ensureDockerImage(): Promise<void> {
  // [LAW:single-enforcer] The renderer owns the visual isolation boundary; no
  // caller decides whether fixture screenshots may touch the active desktop.
  await execFileAsync("docker", ["build", "--load", "-t", DOCKER_IMAGE, "-f", DOCKERFILE, __dirname], {
    cwd: PROJECT_DIR,
    env: process.env,
    maxBuffer: EXEC_MAX_BUFFER,
  });
}

async function renderTarget(target: CaptureTarget): Promise<void> {
  await mkdir(dirname(target.pngPath), { recursive: true });

  await execFileAsync(
    "docker",
    [
      "run",
      "--rm",
      "--volume",
      `${PROJECT_DIR}:/work`,
      "--workdir",
      "/work",
      DOCKER_IMAGE,
      "bash",
      RENDER_SCRIPT,
      toContainerPath(target.ansiPath),
      toContainerPath(target.pngPath),
      target.title,
    ],
    {
      cwd: PROJECT_DIR,
      env: process.env,
      maxBuffer: EXEC_MAX_BUFFER,
    },
  );
}

async function discoverFixtures(): Promise<string[]> {
  return discoverPairedFixtures(FIXTURES_DIR);
}

function parseRenderSide(value: string | undefined): RenderSide {
  if (value === undefined) {
    return "both";
  }

  if (value === "python" || value === "js" || value === "both") {
    return value;
  }

  throw new Error(`Invalid render side: ${value}`);
}

function buildTargets(fixtures: string[], renderSide: RenderSide): CaptureTarget[] {
  const sides: SnapshotSide[] = renderSide === "both" ? ["python", "js"] : [renderSide];

  return fixtures.flatMap((fixture) => {
    return sides.map((side) => ({
      fixture,
      side,
      ansiPath: join("visual-tests", "snapshots", side, `${fixture}.ansi`),
      pngPath: join("visual-tests", "snapshots", side, `${fixture}.png`),
      // [LAW:one-source-of-truth] The title is the xterm window identity used
      // by the isolated Xvfb screenshot process.
      title: `textual-js visual fixture: ${fixture} ${side}`,
    }));
  });
}

export async function main(): Promise<void> {
  const fixtureFilter = process.argv.find((argument) => !argument.startsWith("--") && argument !== process.argv[0] && argument !== process.argv[1]) ?? null;
  const sideArgument = process.argv.find((argument) => argument.startsWith("--side="));
  const renderSide = parseRenderSide(sideArgument?.slice("--side=".length));
  let fixtures = await discoverFixtures();

  if (fixtureFilter) {
    fixtures = fixtures.filter((name) => name === fixtureFilter);
    if (fixtures.length === 0) {
      process.stderr.write(`No fixture found matching: ${fixtureFilter}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(`Rendering ${fixtures.length} ${renderSide} fixture screenshot set(s) in isolated Xvfb...\n\n`);

  await ensureDockerImage();

  const targets = buildTargets(fixtures, renderSide);

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
