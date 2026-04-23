/**
 * Validate a fixture's `interactions` tape and emit it as TSV.
 *
 * Usage:  tsx extract-interactions.ts <side> <fixture-name>
 *   side = "python" | "js"
 *
 * Output: zero or more TAB-separated lines on stdout, one per interaction.
 *   key      <keys>
 *   type     <text>
 *   hover    <col>    <row>
 *   click    <col>    <row>    <button>
 *   wait     <ms>
 *
 * The fixture MUST declare `interactions` explicitly. A missing symbol is a
 * fatal error, not "zero interactions" — silent substitution of an empty
 * tape is exactly the false-MATCH vector the rewrite was built to eliminate.
 *
 * For genuinely static fixtures, declare `interactions = []` — the empty
 * list is the explicit opt-out.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");

// [LAW:single-enforcer] One validator, one schema. Both sides converge here
// before the orchestrator can dispatch any xdotool calls.
const PYTHON_EXTRACT = `
import importlib.util, json, sys
name, path = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location(name, path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if not hasattr(module, "interactions"):
    raise SystemExit(
        f"fixture {name} does not declare 'interactions'. "
        "Static fixtures must declare 'interactions = []' explicitly."
    )
print(json.dumps(module.interactions))
`;

interface KeyStep { type: "key"; keys: string }
interface TypeStep { type: "type"; text: string }
interface HoverStep { type: "hover"; cell: [number, number] }
interface ClickStep { type: "click"; cell: [number, number]; button?: number }
interface WaitStep { type: "wait"; ms: number }
type Step = KeyStep | TypeStep | HoverStep | ClickStep | WaitStep;

async function loadPython(name: string): Promise<unknown> {
  const fixturePath = join(FIXTURES_DIR, `${name}.py`);
  if (!existsSync(fixturePath)) {
    throw new Error(`python fixture not found: ${fixturePath}`);
  }
  const { stdout } = await execFileAsync(
    "uv",
    ["run", "--project", join(__dirname), "python", "-c", PYTHON_EXTRACT, name, fixturePath],
    { env: process.env, maxBuffer: 1024 * 1024 },
  );
  return JSON.parse(stdout.trim());
}

async function loadJs(name: string): Promise<unknown> {
  const fixturePath = join(FIXTURES_DIR, `${name}.tsx`);
  if (!existsSync(fixturePath)) {
    throw new Error(`js fixture not found: ${fixturePath}`);
  }
  const fixtureModule: Record<string, unknown> = await import(fixturePath);
  if (!("interactions" in fixtureModule)) {
    throw new Error(
      `fixture ${name} does not export 'interactions'. ` +
      "Static fixtures must export 'interactions = []' explicitly.",
    );
  }
  return fixtureModule.interactions;
}

function validateAndEncode(side: string, name: string, raw: unknown): string {
  if (!Array.isArray(raw)) {
    throw new Error(`${side}/${name}: 'interactions' is ${typeof raw}, expected array`);
  }
  const lines: string[] = [];
  raw.forEach((step, i) => {
    if (typeof step !== "object" || step === null) {
      throw new Error(`${side}/${name}: step ${i} is not an object: ${JSON.stringify(step)}`);
    }
    const s = step as Partial<Step>;
    switch (s.type) {
      case "key": {
        if (typeof s.keys !== "string" || s.keys.length === 0) {
          throw new Error(`${side}/${name}: step ${i} 'key' missing 'keys' string`);
        }
        lines.push(`key\t${s.keys}`);
        return;
      }
      case "type": {
        if (typeof s.text !== "string") {
          throw new Error(`${side}/${name}: step ${i} 'type' missing 'text' string`);
        }
        if (s.text.includes("\t") || s.text.includes("\n")) {
          throw new Error(`${side}/${name}: step ${i} 'type' text contains tab/newline (TSV-unsafe)`);
        }
        lines.push(`type\t${s.text}`);
        return;
      }
      case "hover": {
        const cell = s.cell;
        if (!Array.isArray(cell) || cell.length !== 2 || !cell.every((n) => typeof n === "number")) {
          throw new Error(`${side}/${name}: step ${i} 'hover' missing 'cell: [col, row]'`);
        }
        lines.push(`hover\t${cell[0]}\t${cell[1]}`);
        return;
      }
      case "click": {
        const cell = s.cell;
        if (!Array.isArray(cell) || cell.length !== 2 || !cell.every((n) => typeof n === "number")) {
          throw new Error(`${side}/${name}: step ${i} 'click' missing 'cell: [col, row]'`);
        }
        const button = s.button ?? 1;
        if (typeof button !== "number" || !Number.isInteger(button)) {
          throw new Error(`${side}/${name}: step ${i} 'click' has non-integer 'button'`);
        }
        lines.push(`click\t${cell[0]}\t${cell[1]}\t${button}`);
        return;
      }
      case "wait": {
        if (typeof s.ms !== "number" || !Number.isFinite(s.ms) || s.ms < 0) {
          throw new Error(`${side}/${name}: step ${i} 'wait' missing non-negative 'ms' number`);
        }
        lines.push(`wait\t${s.ms}`);
        return;
      }
      default:
        throw new Error(`${side}/${name}: step ${i} has unknown type '${(s as { type?: string }).type}'`);
    }
  });
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  const side = process.argv[2];
  const name = process.argv[3];
  if ((side !== "python" && side !== "js") || name === undefined) {
    process.stderr.write("usage: extract-interactions.ts <python|js> <fixture>\n");
    process.exit(2);
  }
  const raw = side === "python" ? await loadPython(name) : await loadJs(name);
  process.stdout.write(validateAndEncode(side, name, raw));
}

main().catch((error) => {
  process.stderr.write(`extract-interactions fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
