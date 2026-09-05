# Visual Comparison Harness

Compares textual-js PNG screenshots against committed Python Textual baseline PNGs for the same fixture, using an isolated Xvfb terminal window inside Docker.

## How It Works

1. **Fixtures** — Each active fixture exists as a pair: a Python Textual app (`*.py`) and a textual-js component (`*.tsx`) that render the same widget layout. The comparison set is every such pair on disk; `fixture-todos.json` no longer removes pairs from it.

   What a todo entry means depends on whether the `.tsx` exists, and the directory is the only place that fact is stored:

   | `.py` | `.tsx` | in `fixture-todos.json` | |
   |---|---|---|---|
   | ✓ | — | ✓ | **Unimplemented.** Nothing to compare. Its Python baseline is still rendered by `visual:update-python`. |
   | ✓ | ✓ | ✓ | **Known diff.** Compared and printed with its pixel count, but excluded from the failing total — the entry's `reason` says why it differs and when it clears. |
   | ✓ | ✓ | — | **Gated.** Any difference fails the gate. |

   A missing PNG is never excused by a todo entry; only a *difference* is.

2. **Python baselines** — `npm run visual:update-python` renders Python Textual fixtures and commits `visual-tests/snapshots/python/*.png` as reviewed reference artifacts. The default gate does not regenerate these files. Python-only future fixtures are rendered only when listed in `fixture-todos.json`.

3. **JS capture** — `visual-tests/run.sh` renders textual-js fixtures headlessly at a fixed terminal size (80x24), starts an Xvfb display inside Docker, opens an `xterm` window in that isolated display, displays each JS ANSI frame, and captures that terminal window to PNG.

4. **Compare** — The comparison tool uses ImageMagick to diff committed Python baseline PNGs against freshly generated JS PNGs pixel-for-pixel.

## Quick Start

```bash
# Full pipeline (all fixtures)
./visual-tests/run.sh

# Single fixture
./visual-tests/run.sh static_basic

# Refresh all Python reference PNGs after intentionally changing baselines
npm run visual:update-python
```

The hard gate requires `tsx`, Docker, and ImageMagick's `magick` CLI. Python baseline generation additionally requires `uv`, which resolves Python and `textual` automatically from `visual-tests/pyproject.toml`. There is no manual `pip install` step.

## Manual Steps

```bash
# Refresh committed Python baselines (via uv — installs textual automatically)
npm run visual:update-python

# JS only
tsx visual-tests/capture_js.ts

# Render JS PNG screenshots
tsx visual-tests/render_pngs.ts --side=js

# Compare
tsx visual-tests/compare.ts
```

## Directory Structure

```
visual-tests/
  pyproject.toml         # Python deps (textual) — resolved by uv
  fixtures/              # Paired fixture files
    static_basic.py      # Python Textual version
    static_basic.tsx     # textual-js version
    button_variants.py
    button_variants.tsx
    switch_states.py
    switch_states.tsx
  snapshots/
    python/
      static_basic.png   # Committed Python baseline PNG
    js/
      static_basic.ansi  # Raw ANSI frame
      static_basic.png   # Generated textual-js PNG
      static_basic.txt   # Plain text grid
    diff/
      static_basic.png   # Pixel diff image when screenshots differ
  capture_python.py      # Python capture script
  capture_js.ts          # JS capture script
  Dockerfile             # Isolated screenshot environment
  render-ansi-xvfb.sh    # Display one ANSI frame in xterm and screenshot it
  render_pngs.ts         # Docker/Xvfb screenshot renderer
  compare.ts             # PNG diff tool
  fixture-todos.json     # Unimplemented fixtures, and known diffs held out of the gate
  run.sh                 # Pipeline orchestrator
  update-python-baselines.sh # Explicit Python baseline refresh task
```

## Adding a Fixture

1. Create `fixtures/<name>.py` with a Textual `App` class assigned to `app`.
2. If the textual-js implementation is not ready yet, add `<name>` to `fixture-todos.json` with the target stage, component, and reason.
3. Run `npm run visual:update-python -- <name>` to generate and review the Python baseline PNG.
4. Commit `visual-tests/snapshots/python/<name>.png`.
5. When implementing the textual-js side, create `fixtures/<name>.tsx` with a default-exported React component that renders the same widget layout.
6. Remove `<name>` from `fixture-todos.json`; this makes the fixture part of the hard visual gate. If it is implemented but still expected to differ for a reason you can name and schedule, rewrite the entry's `reason` instead of removing it — the pair is then compared and reported as `KNOWN DIFF`.
7. Run `./visual-tests/run.sh <name>` to capture JS and compare.

## Comparison Output

```
Comparing 3 PNG fixture pair(s)...

  static_basic: MATCH (764x566, 0 differing pixels)
  button_variants: DIFF (918 differing pixels, diff: snapshots/diff/button_variants.png)
  switch_states: DIFF (size mismatch: Python 764x566, JS 780x566)

Summary: 1 match, 2 diff, 0 skipped
```

Open the `snapshots/diff/*.png` files to inspect mismatches visually.

## Prerequisites

- **tsx** — `npm install -g tsx`. Runs the TypeScript capture and compare scripts.
- **Docker** — Required so the harness can render and capture a terminal window in an isolated Xvfb display without touching the active desktop session.
- **ImageMagick** — Provides the `magick` CLI for pixel diffs.
- **uv** — [Install](https://docs.astral.sh/uv/getting-started/installation/). Required only when refreshing Python baselines.
- **Node 18+** with project dependencies (`npm install`).
