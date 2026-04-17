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
- A **new widget component** must have a paired visual fixture (`visual-tests/fixtures/<name>.py` + `<name>.tsx`) before the stage is considered complete.

**The visual comparison must never be silently skipped.** If `uv` or `tsx` is unavailable, that is a setup problem to fix, not a gate to bypass.

### Verification order

Run the gates in order. Do not run Gate 4 on code that fails Gates 1–3. The full sequence:

```bash
npm run build && npm run lint && npm test && bash visual-tests/run.sh
```

## Visual Test Fixtures

When implementing a new widget component (a `.tsx` file in `src/widgets/` that renders via React/Ink):

1. Create `visual-tests/fixtures/<widget_name>.py` — a Python Textual app that renders the widget in a representative configuration.
2. Create `visual-tests/fixtures/<widget_name>.tsx` — a textual-js component that renders the same layout.
3. Run `bash visual-tests/run.sh <widget_name>` and inspect the comparison output.
4. Commit both fixtures alongside the widget implementation.

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
