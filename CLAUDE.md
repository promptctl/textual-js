# CLAUDE.md — Project Instructions for textual-js

These instructions apply to every agent working in this repository.

## Verification Requirements

Every change — code, tests, widget components, styling — must pass all four verification gates before being committed or declared complete. No gate may be skipped.

### Gate 1: Build

```bash
npm run build
```

Must exit 0. TypeScript compilation with no errors.

### Gate 2: Lint

```bash
npm run lint
```

Must exit 0. Type-checking with `--noEmit`.

### Gate 3: Unit and integration tests

```bash
npm test
```

Must exit 0. All suites pass, including tests from prior stages. A stage is never complete if prior-stage tests regress.

### Gate 4: Visual comparison against Python Textual

```bash
bash visual-tests/run.sh
```

This pipeline captures screenshots from both Python Textual and textual-js for the same widget layouts, then diffs them cell by cell. It requires `uv` and `tsx` on PATH. The pipeline will fail immediately and loudly if either tool is missing — do not work around this, install the tools.

**What the visual comparison tells you:**

- A **MATCH** means textual-js renders identically to Python Textual for that fixture.
- A **DIFF** with a high match percentage (>90%) and only border/slider character differences is expected in early stages — Ink uses different box-drawing characters than Textual's custom renderer.
- A **DIFF** where text content diverges (wrong words, missing widgets, broken layout) is a real bug. Investigate before committing.
- **Every widget — old or new — must have a paired visual fixture** (`visual-tests/fixtures/<name>.py` + `<name>.tsx`) for every behavior its spec-tests file describes that is observable on screen. A widget without complete `.tsx` pairs is incomplete, regardless of whether its unit tests pass.

**The visual comparison must never be silently skipped.** If `uv` or `tsx` is unavailable, that is a setup problem to fix, not a gate to bypass.

### Verification order

Run the gates in order. Do not run Gate 4 on code that fails Gates 1–3. The full sequence:

```bash
npm run build && npm run lint && npm test && bash visual-tests/run.sh
```

## Visual Test Fixtures

Every widget component (a `.tsx` file in `src/widgets/` that renders via React/Ink) must ship with a paired `.py` and `.tsx` fixture for every observable behavior in its spec-tests file. This applies retroactively: a `.py` fixture without a matching `.tsx` is a gap, not a future task.

For each fixture pair:

1. `visual-tests/fixtures/<widget_name>.py` — a Python Textual app rendering the widget in the target configuration.
2. `visual-tests/fixtures/<widget_name>.tsx` — a textual-js component rendering the same layout.
3. Run `bash visual-tests/run.sh <widget_name>` and inspect the comparison output.
4. Commit both fixtures alongside the widget implementation.

### Stage completion is gated on fixture parity

A stage is **not complete** until every widget it covers has paired `.py` + `.tsx` fixtures for every fixture variant the stage's spec-tests file describes. This explicitly applies to:

- **Stage 5** (foundational widgets: Static, Label, Link, Rule, Sparkline, ProgressBar, LoadingIndicator, Header, Footer, Digits, Placeholder, etc.) — not done until every shipped widget's `.py` fixtures have matching `.tsx` files.
- **Stage 6** (Button, Input, MaskedInput, Switch, Checkbox, RadioButton, RadioSet, Toggle, etc.) — same rule.
- **Stage 7** (whatever interactive/composite widgets it covers per IMPLEMENTATION_ORDER.md) — same rule.
- **Stage 8 onward** — same rule applies to every future stage.

Backfilling missing `.tsx` pairs for already-shipped widgets is in-scope work, not optional cleanup. Any agent picking up the next ticket must check fixture parity for prior stages before declaring them done and advancing.

### Diagnosing visual diffs: read the Python baseline JSON first

Every Python fixture has a paired `visual-tests/snapshots/python/<name>.json` that records the **exact** fg/bg/style of every cell. This is the cheap ground truth. Before postulating any rendering-pipeline cause (xterm truecolor, Ink color emission, terminfo quirks, scroll/erase behavior), open this file and confirm what color/character/style is actually expected — it disproves whole classes of speculation in seconds and almost always points at a typo or missing constant in the JS widget source.

Examples of cheap inspections:

```bash
# What unique fg/bg pairs does the Python baseline use?
python3 -c "
import json
data = json.load(open('visual-tests/snapshots/python/footer_with_bindings.json'))
seen = set()
for row in data['rows']:
    for cell in row:
        seen.add((cell.get('foreground'), cell.get('background')))
for fg, bg in sorted(seen, key=str):
    print(f'fg={fg} bg={bg}')
"

# What text does the bottom row contain?
python3 -c "
import json
data = json.load(open('visual-tests/snapshots/python/footer_with_bindings.json'))
print(repr(''.join(c['text'] for c in data['rows'][-1])))
"
```

When writing a fixture-todos diagnosis, include specific `file:line` pointers and the verified expected vs actual color/character. Vague "JS X does not Y" entries rot fast and invite symptom-blaming on the next investigation.

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/` | Implementation source |
| `tests/` | Unit and integration tests (Vitest) |
| `visual-tests/` | Cross-implementation visual comparison harness |
| `visual-tests/fixtures/` | Paired Python + JS fixture files |
| `spec/impl/` | Phase plan files and implementation prompt |
| `spec/spec-src/` | Behavioral specifications (00–14) |
| `spec/spec-tests/` | Test case specifications (test backlog) |

## Implementation Entry Point

For phase-by-phase implementation, start with `spec/impl/PROMPT.md`. It contains the complete procedure for identifying the next stage and implementing it.

## Tool Requirements

- **Node 18+** with project dependencies (`npm install`)
- **uv** — manages Python environment for visual tests ([install](https://docs.astral.sh/uv/getting-started/installation/))
- **tsx** — runs TypeScript scripts for visual capture/compare (`npm install -g tsx`)
