# Visual Comparison Harness

Compares the visual output of Python Textual and textual-js for the same widget layouts.

## How It Works

1. **Fixtures** — Each fixture exists as a pair: a Python Textual app (`*.py`) and a textual-js component (`*.tsx`) that render the same widget layout. The active fixture set is discovered from the paired filenames on disk.

2. **Capture** — Two capture scripts render each fixture headlessly at a fixed terminal size (80x24) and save the output:
   - Python (via `uv`): SVG screenshot + plain-text grid
   - JS: ANSI frame + plain-text grid

3. **Compare** — The comparison tool reads both plain-text grids and produces a cell-by-cell diff report with match percentages.

## Quick Start

```bash
# Full pipeline (all fixtures)
./visual-tests/run.sh

# Single fixture
./visual-tests/run.sh static_basic
```

`uv` resolves Python and `textual` automatically from `visual-tests/pyproject.toml`. There is no manual `pip install` step. If `uv` or `tsx` is missing, the pipeline fails immediately with an actionable error.

## Manual Steps

```bash
# Python only (via uv — installs textual automatically)
uv run --project visual-tests python visual-tests/capture_python.py

# JS only
tsx visual-tests/capture_js.ts

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
  snapshots/             # Captured output (git-ignored)
    python/
      static_basic.svg   # SVG screenshot
      static_basic.txt   # Plain text grid
    js/
      static_basic.ansi  # Raw ANSI frame
      static_basic.txt   # Plain text grid
  capture_python.py      # Python capture script
  capture_js.ts          # JS capture script
  compare.ts             # Diff tool
  run.sh                 # Pipeline orchestrator
```

## Adding a Fixture

1. Create `fixtures/<name>.py` with a Textual `App` class assigned to `app`.
2. Create `fixtures/<name>.tsx` with a default-exported React component.
3. Both should render the same widget layout.
4. Run `./visual-tests/run.sh <name>` to capture and compare.

## Comparison Output

```
Comparing 3 fixture(s)...

  static_basic: MATCH (100.0%)
  button_variants: DIFF (87.3% match, 42 cells differ)
    Python: 5 lines, JS: 5 lines
    [0:10] Python="▄" JS="╭"
    [0:11] Python="▄" JS="─"
    ...
  switch_states: DIFF (91.2% match, 15 cells differ)

Summary: 1 match, 2 diff, 0 skipped
```

Differences are expected in this early stage — Python Textual uses custom border characters and color schemes that differ from Ink's built-in rendering. The goal is convergence over time.

## Prerequisites

- **uv** — [Install](https://docs.astral.sh/uv/getting-started/installation/). Manages the Python environment and `textual` dependency automatically.
- **tsx** — `npm install -g tsx`. Runs the TypeScript capture and compare scripts.
- **Node 18+** with project dependencies (`npm install`).
