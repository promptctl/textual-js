/**
 * Print a fixture's `interactions` list as JSON on stdout.
 *
 * Usage:  tsx extract-interactions.ts <side> <fixture-name>
 *   side = "python" | "js"
 *
 * Output: A JSON array of interaction objects (possibly empty), one line.
 *
 * Interaction shapes (uniform across sides):
 *   {"type":"key","keys":"Tab"}
 *   {"type":"type","text":"hello"}
 *   {"type":"hover","cell":[col,row]}
 *   {"type":"click","cell":[col,row],"button":1}
 *   {"type":"wait","ms":50}
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");

// [LAW:single-enforcer] Interaction extraction is the only seam that reads
// the fixture's declarative action tape; both orchestrator sides go through
// this one entrypoint so the JSON shape cannot drift.
const PYTHON_EXTRACT = `
import importlib.util, json, sys
name = sys.argv[1]
path = sys.argv[2]
spec = importlib.util.spec_from_file_location(name, path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(getattr(module, "interactions", [])))
`;

async function extractPython(name: string): Promise<string> {
  const fixturePath = join(FIXTURES_DIR, `${name}.py`);
  const { stdout } = await execFileAsync(
    "uv",
    ["run", "--project", join(__dirname), "python", "-c", PYTHON_EXTRACT, name, fixturePath],
    { env: process.env, maxBuffer: 1024 * 1024 },
  );
  return stdout.trim();
}

async function extractJs(name: string): Promise<string> {
  const fixturePath = join(FIXTURES_DIR, `${name}.tsx`);
  const fixtureModule: { interactions?: unknown } = await import(fixturePath);
  return JSON.stringify(fixtureModule.interactions ?? []);
}

async function main(): Promise<void> {
  const side = process.argv[2];
  const name = process.argv[3];

  if (side !== "python" && side !== "js") {
    process.stderr.write("usage: extract-interactions.ts <python|js> <fixture>\n");
    process.exit(2);
  }

  if (name === undefined) {
    process.stderr.write("usage: extract-interactions.ts <python|js> <fixture>\n");
    process.exit(2);
  }

  const json = side === "python" ? await extractPython(name) : await extractJs(name);

  // Sanity: result must parse as an array; fail loud if a fixture exports a
  // non-array so the orchestrator never interprets garbage as an action tape.
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error(`fixture ${side}/${name} exported interactions of non-array type: ${typeof parsed}`);
  }

  process.stdout.write(`${json}\n`);
}

main().catch((error) => {
  process.stderr.write(`extract-interactions fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
