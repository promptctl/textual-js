/**
 * Render fixture PNGs via the black-box Docker pipeline.
 *
 * Each fixture runs naturally inside an xterm that lives in an Xvfb display
 * inside a Docker container. No reconstructed ANSI, no cell-grid backdoor —
 * the PNG is what xterm actually drew for the real library code.
 *
 * Usage:
 *   tsx render_pngs.ts [fixture]  --side=python|js|both
 *
 * There is no `--include-todos`: this line used to advertise one, and nothing
 * ever parsed it. `--side=python` already covers todo-listed baselines, which is
 * the case the flag was reaching for.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { discoverPairedFixtures, discoverPythonBaselineFixtures } from "./discover-fixtures.ts";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_DIR = resolve(__dirname, "..");
const PARENT_DIR = resolve(PROJECT_DIR, "..");
const FIXTURES_DIR = join(__dirname, "fixtures");
const DOCKERFILE = join(__dirname, "Dockerfile");
const DOCKER_IMAGE = "textual-js-visual-tests:local";
const EXEC_MAX_BUFFER = 32 * 1024 * 1024;

type SnapshotSide = "python" | "js";
type RenderSide = SnapshotSide | "both";

interface RenderTarget {
  fixture: string;
  side: SnapshotSide;
  pngPath: string;
}

async function ensureDockerImage(): Promise<void> {
  // [LAW:single-enforcer] The renderer owns the visual isolation boundary; no
  // caller decides whether fixture screenshots may touch the active desktop.
  await execFileAsync(
    "docker",
    ["build", "--load", "-t", DOCKER_IMAGE, "-f", DOCKERFILE, __dirname],
    { cwd: PROJECT_DIR, env: process.env, maxBuffer: EXEC_MAX_BUFFER },
  );
}

// Parent dir mount is required so `node_modules/rich-js -> ../../rich-js`
// (a file: symlink on the host) resolves inside the container.
const CONTAINER_PROJECT = `/host-code/${PROJECT_DIR.split("/").pop() ?? "textual-js"}`;

// [LAW:decomposition] Entering the fixture container is one job with one
// statement of how it is done. Both baseline representations — the PNG and the
// cell record — go through here, so neither can drift onto a different image,
// mount, or working directory than the other.
async function runInFixtureContainer(command: string[]): Promise<void> {
  await execFileAsync(
    "docker",
    ["run", "--rm", "--volume", `${PARENT_DIR}:/host-code`, "--workdir", CONTAINER_PROJECT, DOCKER_IMAGE, ...command],
    { cwd: PROJECT_DIR, env: process.env, maxBuffer: EXEC_MAX_BUFFER },
  );
}

async function renderTarget(target: RenderTarget): Promise<void> {
  await mkdir(dirname(target.pngPath), { recursive: true });

  await runInFixtureContainer([
    "bash",
    `${CONTAINER_PROJECT}/visual-tests/render-fixture-xvfb.sh`,
    target.side,
    target.fixture,
    `${CONTAINER_PROJECT}/${target.pngPath}`,
  ]);
}

// The cell-level record of the frame the PNG holds: the exact bytes Textual
// emitted, and their plain text.
//
// [LAW:one-source-of-truth] The fixture list is passed in, never re-derived here.
// capture_python.py used to run its own discovery over the same directory and todo
// file, and the two implementations had already drifted: 118 fixtures had a PNG and
// only 115 had a cell record.
async function captureCellRecords(fixtures: string[]): Promise<void> {
  await runInFixtureContainer([
    "uv",
    "run",
    "--project",
    `${CONTAINER_PROJECT}/visual-tests`,
    "python",
    `${CONTAINER_PROJECT}/visual-tests/capture_python.py`,
    ...fixtures,
  ]);
}

async function discoverFixtures(renderSide: RenderSide): Promise<string[]> {
  // Python baseline discovery already includes both paired fixtures and
  // todo-listed future baselines — the todo list is the only admission
  // control. JS/both renders restrict to paired fixtures.
  if (renderSide === "python") {
    return discoverPythonBaselineFixtures(FIXTURES_DIR);
  }
  return discoverPairedFixtures(FIXTURES_DIR);
}

function parseRenderSide(value: string | undefined): RenderSide {
  if (value === undefined) return "both";
  if (value === "python" || value === "js" || value === "both") return value;
  throw new Error(`Invalid render side: ${value}`);
}

function buildTargets(fixtures: string[], renderSide: RenderSide): RenderTarget[] {
  const sides: SnapshotSide[] = renderSide === "both" ? ["python", "js"] : [renderSide];
  return fixtures.flatMap((fixture) =>
    sides.map((side) => ({
      fixture,
      side,
      pngPath: join("visual-tests", "snapshots", side, `${fixture}.png`),
    })),
  );
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fixtureFilter = args.find((a) => !a.startsWith("--")) ?? null;
  const sideArg = args.find((a) => a.startsWith("--side="))?.slice("--side=".length);
  const renderSide = parseRenderSide(sideArg);

  let fixtures = await discoverFixtures(renderSide);

  // [LAW:verifiable-goals] Validate the filter before the 30s docker build
  // — fail fast on a typo'd fixture name rather than after build cost.
  if (fixtureFilter) {
    fixtures = fixtures.filter((name) => name === fixtureFilter);
    if (fixtures.length === 0) {
      process.stderr.write(`No fixture found matching: ${fixtureFilter}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(
    `Rendering ${fixtures.length} ${renderSide} fixture screenshot set(s) inside Docker...\n\n`,
  );

  await ensureDockerImage();

  const targets = buildTargets(fixtures, renderSide);
  for (const target of targets) {
    process.stdout.write(`  Capturing ${target.side}: ${target.fixture}\n`);
    await renderTarget(target);
    process.stdout.write(`    -> snapshots/${target.side}/${target.fixture}.png\n`);
  }

  // A Python baseline is every representation of one frame, produced together in
  // this command. Splitting them let the cell record describe a different frame than
  // the PNG for as long as nobody ran the second command — which nothing ever did.
  //
  // Side-keyed, because the asymmetry is real rather than incidental: the Python
  // side is the reference and its frame is what gets read during diagnosis, while
  // the JS side is the thing under test and is only ever compared, never consulted.
  // [LAW:dataflow-not-control-flow] exception: the two sides genuinely produce
  // different artifacts, and a per-side artifact table would be more machinery than
  // one honest branch.
  // `fixtures` is empty whenever discovery found nothing, which the render loop
  // above treats as no work. capture_python.py takes `nargs="+"`, so handing it
  // zero names is an argparse usage error rather than a no-op — a broken run
  // reported for a repo state (no fixtures on disk) that is merely empty.
  if (renderSide !== "js" && fixtures.length > 0) {
    process.stdout.write("\n  Capturing python cell records (.ansi / .txt)\n");
    await captureCellRecords(fixtures);
  }

  process.stdout.write("\nDone. PNG snapshots in: snapshots/python/ and snapshots/js/\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
