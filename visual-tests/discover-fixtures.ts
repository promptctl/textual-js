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

export function derivePairedFixtureNames(entries: string[], todoNames: ReadonlySet<string> = new Set()): string[] {
  const pythonFixtures = collectFixtureNames(entries, ".py");
  const jsFixtures = collectFixtureNames(entries, ".tsx");

  // [LAW:single-enforcer] Fixture todo membership is the only harness boundary
  // that suppresses unimplemented fixtures from the hard visual gate.
  return [...pythonFixtures]
    .filter((name) => jsFixtures.has(name) && !todoNames.has(name))
    .sort();
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
  const [entries, todos] = await Promise.all([
    readdir(join(fixturesDir)),
    discoverFixtureTodos(fixturesDir),
  ]);

  return derivePairedFixtureNames(entries, deriveFixtureTodoNames(todos));
}

export async function discoverPythonBaselineFixtures(fixturesDir: string): Promise<string[]> {
  const [entries, todos] = await Promise.all([
    readdir(join(fixturesDir)),
    discoverFixtureTodos(fixturesDir),
  ]);

  return derivePythonBaselineFixtureNames(entries, deriveFixtureTodoNames(todos));
}
