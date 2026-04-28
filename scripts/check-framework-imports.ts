// Architectural guard for the True North Phase 1 invariant:
// `TextualFramework` is a private collaborator owned by `App`. It must not
// be imported by name (or via `TextualFrameworkOptions`) outside the two
// directories that are allowed to know about it: `src/framework/` (where
// it lives) and `src/app/` (where `App` constructs and drives it).
//
// This is the *mechanical* enforcement of the rule — comments and LAW
// markers do not fail CI; this script does. Run via `npm run lint`.
//
// Forbidden symbol set: `TextualFramework`, `TextualFrameworkOptions`.
// Other imports from `app-framework.js` (e.g. `Screen`, `SimpleCommand`,
// `ActiveBinding`, `normalizeKeyName`) are *allowed* — those are subsidiary
// concepts, not the framework class itself.
//
// Allowlist (paths where the symbol may be imported):
//   - `src/framework/**`         — the framework module itself
//   - `src/app/**`               — App and TextualApp own and bridge it
//   - `src/styles/selectors.ts`  — Phase 7 deferred (audit §4.3)
//   - `src/styles/stylesheet.ts` — Phase 7 deferred (audit §4.3)

import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const FORBIDDEN_SYMBOLS = ["TextualFramework", "TextualFrameworkOptions"];
const SCAN_ROOTS = ["src", "tests"];

const ALLOWLIST_PATHS = new Set<string>([
  "src/styles/selectors.ts",
  "src/styles/stylesheet.ts",
]);

const ALLOWLIST_PREFIXES = ["src/framework/", "src/app/"];

function isAllowlisted(rel: string): boolean {
  const normalized = rel.split(sep).join("/");
  if (ALLOWLIST_PATHS.has(normalized)) return true;
  return ALLOWLIST_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(full);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

interface Violation {
  file: string;
  line: number;
  symbol: string;
  source: string;
}

function findViolations(filePath: string, contents: string): Violation[] {
  const violations: Violation[] = [];
  // Match `import ... from "...app-framework..."` import declarations,
  // possibly multi-line. The framework path is the only one we care about
  // for symbol enforcement; other framework-internal paths (e.g.
  // `framework/widget.js`) are not part of this guard.
  const importRe = /import(?:\s+type)?\s*(?:\{([^}]*)\}|([A-Za-z_$][\w$]*)|\*\s+as\s+([A-Za-z_$][\w$]*))?\s*from\s*["']([^"']+app-framework(?:\.js)?)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(contents)) !== null) {
    const namedBlock = match[1];
    const defaultBinding = match[2];
    const namespaceBinding = match[3];
    const source = match[4];
    const startIdx = match.index;
    const line = contents.slice(0, startIdx).split("\n").length;

    if (namedBlock !== undefined) {
      const names = namedBlock
        .split(",")
        .map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim())
        .filter((s): s is string => s !== undefined && s.length > 0);
      for (const name of names) {
        if (FORBIDDEN_SYMBOLS.includes(name)) {
          violations.push({ file: filePath, line, symbol: name, source });
        }
      }
    }

    if (defaultBinding !== undefined && FORBIDDEN_SYMBOLS.includes(defaultBinding)) {
      violations.push({ file: filePath, line, symbol: defaultBinding, source });
    }

    if (namespaceBinding !== undefined) {
      // Namespace imports give access to *every* export of app-framework,
      // including the forbidden ones. Treat as a violation.
      violations.push({
        file: filePath,
        line,
        symbol: `* as ${namespaceBinding}`,
        source,
      });
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  for (const root of SCAN_ROOTS) {
    const absRoot = join(REPO_ROOT, root);
    try {
      await stat(absRoot);
    } catch {
      continue;
    }
    for await (const filePath of walk(absRoot)) {
      const rel = relative(REPO_ROOT, filePath);
      if (isAllowlisted(rel)) continue;
      const contents = readFileSync(filePath, "utf8");
      violations.push(...findViolations(rel, contents));
    }
  }

  if (violations.length === 0) {
    console.log("check-framework-imports: OK");
    return;
  }

  console.error(
    `check-framework-imports: FAIL — ${violations.length} forbidden import${violations.length === 1 ? "" : "s"} of TextualFramework / TextualFrameworkOptions outside src/framework/ + src/app/:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  imports { ${v.symbol} } from "${v.source}"`);
  }
  console.error(
    "\nApp is the runtime root. Drive the runtime through the App instance " +
      "(or App[\"framework\"] for type annotations) instead of importing " +
      "TextualFramework directly. See design-docs/true-north-arch-refactor.md.",
  );
  process.exit(1);
}

await main();
