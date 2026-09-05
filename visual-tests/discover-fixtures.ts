import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

export interface FixtureTodo {
  name: string;
  stage: string;
  component: string;
  reason: string;
}

function collectFixtureNames(entries: string[], extension: ".py" | ".tsx"): Set<string> {
  return new Set(
    entries
      .filter((entry) => extname(entry) === extension)
      .map((entry) => basename(entry, extension)),
  );
}

function assertFixtureTodos(value: unknown): FixtureTodo[] {
  if (!Array.isArray(value)) {
    throw new Error("fixture-todos.json must contain an array");
  }

  return value.map((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as Partial<FixtureTodo>).name !== "string" ||
      typeof (entry as Partial<FixtureTodo>).stage !== "string" ||
      typeof (entry as Partial<FixtureTodo>).component !== "string" ||
      typeof (entry as Partial<FixtureTodo>).reason !== "string"
    ) {
      throw new Error(`fixture-todos.json entry ${index} must include name, stage, component, and reason strings`);
    }

    return entry as FixtureTodo;
  });
}

export function deriveFixtureTodoNames(todos: readonly FixtureTodo[]): Set<string> {
  return new Set(todos.map((todo) => todo.name));
}

// A fixture the harness can compare: both sides of the pair exist on disk.
//
// [LAW:one-source-of-truth] Todo membership does not enter this: a fixture is
// comparable when it has two files, and the filesystem is the only map of that.
// The todo list answers a different question — see `deriveKnownDiffFixtureNames`.
export function derivePairedFixtureNames(entries: string[]): string[] {
  const pythonFixtures = collectFixtureNames(entries, ".py");
  const jsFixtures = collectFixtureNames(entries, ".tsx");

  return [...pythonFixtures].filter((name) => jsFixtures.has(name)).sort();
}

/**
 * Todo-listed fixtures that nonetheless have a `.tsx`, so the gate compares
 * them and does not fail on the difference.
 *
 * [LAW:single-enforcer] The todo list is the one boundary that keeps a fixture
 * out of the hard visual gate. It used to hold a single state — *not built* —
 * and suppress those fixtures from rendering, comparison and capture alike. A
 * widget can also be built, paired, and still differ for a reason recorded and
 * scheduled: `welcome_default` renders its body as plain text until the Markdown
 * widget lands in Stage 10. Suppressing that outright would hide the rows that
 * *do* match, and `capture_js.ts` would report the fixture as missing.
 *
 * [LAW:one-source-of-truth] The two states are not stored, they are derived: an
 * entry with no `.tsx` cannot be compared and is unimplemented; an entry with
 * one is a known diff. Storing a `kind` field beside the files would be a second
 * map of a fact the directory already holds, free to disagree with it.
 */
export function deriveKnownDiffFixtureNames(
  entries: string[],
  todoNames: ReadonlySet<string>,
): Set<string> {
  return new Set(derivePairedFixtureNames(entries).filter((name) => todoNames.has(name)));
}

export function derivePythonBaselineFixtureNames(entries: string[], todoNames: ReadonlySet<string> = new Set()): string[] {
  const pythonFixtures = collectFixtureNames(entries, ".py");
  const jsFixtures = collectFixtureNames(entries, ".tsx");
  const names = new Set<string>();

  // [LAW:one-source-of-truth] The fixture directory and fixture-todos.json are
  // the canonical inputs; baseline generation derives active pairs plus
  // explicitly tracked future Python fixtures from those sources.
  for (const name of pythonFixtures) {
    const hasActivePair = jsFixtures.has(name) && !todoNames.has(name);
    const hasTodoBaseline = todoNames.has(name);

    if (hasActivePair || hasTodoBaseline) {
      names.add(name);
    }
  }

  return [...names]
    .sort();
}

export async function discoverFixtureTodos(fixturesDir: string): Promise<FixtureTodo[]> {
  const todoPath = join(fixturesDir, "..", "fixture-todos.json");
  const rawTodos = await readFile(todoPath, "utf8");

  return assertFixtureTodos(JSON.parse(rawTodos));
}

export async function discoverPairedFixtures(fixturesDir: string): Promise<string[]> {
  return derivePairedFixtureNames(await readdir(join(fixturesDir)));
}

export async function discoverKnownDiffFixtures(fixturesDir: string): Promise<Set<string>> {
  const [entries, todos] = await Promise.all([
    readdir(join(fixturesDir)),
    discoverFixtureTodos(fixturesDir),
  ]);

  return deriveKnownDiffFixtureNames(entries, deriveFixtureTodoNames(todos));
}

export async function discoverPythonBaselineFixtures(fixturesDir: string): Promise<string[]> {
  const [entries, todos] = await Promise.all([
    readdir(join(fixturesDir)),
    discoverFixtureTodos(fixturesDir),
  ]);

  return derivePythonBaselineFixtureNames(entries, deriveFixtureTodoNames(todos));
}
