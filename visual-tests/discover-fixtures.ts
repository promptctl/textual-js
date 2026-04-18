import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

function collectFixtureNames(entries: string[], extension: ".py" | ".tsx"): Set<string> {
  return new Set(
    entries
      .filter((entry) => extname(entry) === extension)
      .map((entry) => basename(entry, extension)),
  );
}

export function derivePairedFixtureNames(entries: string[]): string[] {
  const pythonFixtures = collectFixtureNames(entries, ".py");
  const jsFixtures = collectFixtureNames(entries, ".tsx");

  // [LAW:one-source-of-truth] The fixture directory is the only source of
  // truth for active visual fixtures; the runnable set is derived from the
  // intersection of Python and JS fixture names.
  return [...pythonFixtures]
    .filter((name) => jsFixtures.has(name))
    .sort();
}

export async function discoverPairedFixtures(fixturesDir: string): Promise<string[]> {
  const entries = await readdir(join(fixturesDir));
  return derivePairedFixtureNames(entries);
}
