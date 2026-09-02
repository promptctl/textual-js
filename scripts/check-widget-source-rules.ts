// Architectural guards over `src/widgets/**`. Two invariants, one scanner:
// every rule below is a regex plus a message, so adding an invariant is adding
// a value rather than adding a script.
//
// --- Invariant 1: widgets paint through one bridge ---
//
// A widget paints by handing a Content to `renderContent`, which emits
// truecolour ANSI itself. Ink's <Text> resolves colour depth through chalk
// instead, and chalk's depth comes from terminal detection — inside the
// visual-test xterm it settles at level 1 and quantises every colour to the
// 16-colour ANSI palette, so #0178D4 arrives as #0000EE. The defect is
// invisible until a fixture happens to use a colour with no close ANSI
// neighbour, which is why it needs a mechanical check rather than review
// attention.
//
// The rules forbid naming the component rather than passing it a `color`: with
// no opening tag to parse, no `>` inside an attribute expression can slip a
// violation past the scan. Both ways of naming it are covered — a named import
// and a namespace binding. Ink's <Box> is untouched; layout is Ink's job,
// painting is the bridge's.
//
// --- Invariant 2: the typed style accessors (textual-style-accessor-typing-306) ---
//
// Widgets read CSS-resolved values through typed accessors on
// ResolvedStyles (`getColor`, `tryColor`, `getCustomColor`,
// `tryCustomColor`, `getEnum`, `tryEnum`). Three patterns that pre-date
// the typed accessors are forbidden in `src/widgets/` because each one
// silently masks a different class of bug:
//
//   1. `as never`                            — unsafe cast on a Map<string, unknown>
//   2. `customProperties.get(...) as ...`    — re-stating the type the call site already knows
//   3. `colorToInkValue(...) ?? "#hex"`      — duplicating a CSS default at the consumer
//
// This is the *mechanical* enforcement. Comments and LAW markers do not
// fail CI; this script does. Run via `npm run lint`.
//
// Scope: `src/widgets/**` only. Framework code (mobx makeAutoObservable
// type holes, csstree node casts) is addressed in a separate ticket.

import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const SCAN_ROOT = "src/widgets";

interface Pattern {
  name: string;
  regex: RegExp;
  message: string;
}

const PATTERNS: Pattern[] = [
  {
    name: "ink-text-import",
    // The module is deliberately not part of the match: `stripCommentsAndStrings`
    // blanks the specifier, and a `Text` component painted from anywhere else
    // bypasses the bridge just as thoroughly. `\bText\b` leaves `type TextProps`
    // alone — the type is how a widget hands style *to* `renderContent`.
    regex: /import\s*(?:type\s+)?\{[^}]*\bText\b[^}]*\}/g,
    message:
      "Importing a `Text` component is forbidden in src/widgets/. Ink's <Text> resolves colour depth through chalk, which quantises to 16 colours wherever terminal detection lands on level 1. Build a Content (`Content.assemble([text, \"#hex\"], ...)`) and render it through `renderContent`, the single visual-to-Ink bridge, which emits truecolour itself. Ink's `Box` is still yours for layout, and `type TextProps` is how you hand style to the bridge.",
  },
  {
    name: "widget-namespace-import",
    // Named imports are checkable one binding at a time; a namespace binding
    // grants every export at once, so `Ink.Text` reaches the same <Text> the
    // rule above forbids and no import line records it. check-framework-imports
    // rejects namespace imports for exactly this reason.
    // The optional leading binding is `import Default, * as Ink from "ink"`,
    // valid ES and the second spelling to get past a rule whose comment claimed
    // this class was closed.
    regex: /import\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?\*\s*as\s+[A-Za-z_$][\w$]*\s*from/g,
    message:
      "`import * as X from ...` is forbidden in src/widgets/. A namespace binding grants every export of the module, including a `Text` component, which puts it beyond the reach of a per-binding check. Import the named bindings you need — `Box` from \"ink\" is the usual one.",
  },
  {
    name: "as-never",
    regex: /\bas\s+never\b/g,
    message: "`as never` is forbidden in src/widgets/. Use a typed style accessor (getColor / getCustomColor / getEnum) instead of casting through getRule.",
  },
  {
    name: "custom-properties-cast",
    regex: /\.customProperties\.get\([^)]*\)\s*as\s+(?:string|String)(?:\s*\|\s*undefined)?/g,
    message: "`styles.customProperties.get(...) as string | undefined` is forbidden in src/widgets/. Use `styles.getCustomColor(...)` (required) or `styles.tryCustomColor(...)` (optional).",
  },
  {
    name: "get-rule-cast",
    regex: /\.getRule\([^)]*\)\s*as\s+(?!never\b)[A-Za-z_$"][^=;,)]*/g,
    message: "`styles.getRule(...) as ...` is forbidden in src/widgets/. Use a typed accessor (getColor / getCustomColor / getEnum / tryColor / tryCustomColor / tryEnum).",
  },
  {
    name: "color-fallback-hex",
    regex: /colorToInkValue\([^)]*\)\s*\?\?\s*"#[0-9a-fA-F]{3,8}"/g,
    message: "`colorToInkValue(...) ?? \"#hex\"` is forbidden in src/widgets/. Defaults belong in DEFAULT_CSS; getColor will throw if the cascade is broken — fix the cascade, not the call site.",
  },
];

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
  pattern: string;
  match: string;
  message: string;
}

function stripCommentsAndStrings(source: string): string {
  // Replace contents of // line comments, /* block comments */, and string
  // literals with spaces so the regex pass only inspects code. Preserves
  // line numbering by keeping newlines.
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      while (i < n && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
    } else if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += quote;
      i += 1;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < n) {
          out += "  ";
          i += 2;
          continue;
        }
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < n) {
        out += quote;
        i += 1;
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

function findViolations(filePath: string, contents: string): Violation[] {
  const violations: Violation[] = [];
  const sanitized = stripCommentsAndStrings(contents);
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(sanitized)) !== null) {
      const line = sanitized.slice(0, match.index).split("\n").length;
      violations.push({
        file: filePath,
        line,
        pattern: pattern.name,
        match: match[0].trim(),
        message: pattern.message,
      });
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  const absRoot = join(REPO_ROOT, SCAN_ROOT);
  try {
    await stat(absRoot);
  } catch {
    console.error(`check-widget-source-rules: cannot read ${SCAN_ROOT}`);
    process.exit(1);
  }
  for await (const filePath of walk(absRoot)) {
    const rel = relative(REPO_ROOT, filePath);
    const contents = readFileSync(filePath, "utf8");
    violations.push(...findViolations(rel, contents));
  }

  if (violations.length === 0) {
    console.log("check-widget-source-rules: OK");
    return;
  }

  console.error(
    `check-widget-source-rules: FAIL — ${violations.length} forbidden pattern${violations.length === 1 ? "" : "s"} in src/widgets/:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.pattern}]  ${v.match}`);
    console.error(`    -> ${v.message}\n`);
  }
  console.error(
    "Read src/styles/resolved-styles.ts for the typed accessor API. " +
      "Defaults belong in DEFAULT_CSS, not at the consumer.",
  );
  process.exit(1);
}

await main();
