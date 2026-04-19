# Visual Comparison Harness

Compares the visual output of Python Textual and textual-js by capturing real PNG screenshots of the same fixture in a dedicated Ghostty window.

## How It Works

1. **Fixtures** — Each fixture exists as a pair: a Python Textual app (`*.py`) and a textual-js component (`*.tsx`) that render the same widget layout. The active fixture set is discovered from the paired filenames on disk.

2. **Frame capture** — Two capture scripts render each fixture headlessly at a fixed terminal size (80x24) and save the final ANSI frame:
   - Python (via `uv`): ANSI frame + diagnostic JSON/TXT
   - JS: ANSI frame + diagnostic JSON/TXT

3. **Window capture** — The harness opens a dedicated Ghostty window, paints each ANSI frame into that single window, and captures the window to PNG with macOS `screencapture`.

4. **Compare** — The comparison tool uses ImageMagick to diff the Python and JS PNGs pixel-for-pixel.

## Quick Start

```bash
# Full pipeline (all fixtures)
./visual-tests/run.sh

# Single fixture
./visual-tests/run.sh static_basic
```

`uv` resolves Python and `textual` automatically from `visual-tests/pyproject.toml`. There is no manual `pip install` step. If `uv`, `tsx`, `magick`, or Ghostty is missing, the pipeline fails immediately with an actionable error.

## Manual Steps

```bash
# Python only (via uv — installs textual automatically)
uv run --project visual-tests python visual-tests/capture_python.py

# JS only
tsx visual-tests/capture_js.ts

# Render real PNG screenshots
tsx visual-tests/render_pngs.ts

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
      static_basic.ansi  # ANSI frame
      static_basic.png   # Window screenshot PNG
      static_basic.txt   # Plain text grid
    js/
      static_basic.ansi  # Raw ANSI frame
      static_basic.png   # Window screenshot PNG
      static_basic.txt   # Plain text grid
    diff/
      static_basic.png   # Pixel diff image when screenshots differ
  capture_python.py      # Python capture script
  capture_js.ts          # JS capture script
  render_pngs.ts         # Ghostty window screenshot renderer
  find-window.swift      # Resolve the real macOS window id for Ghostty capture
  compare.ts             # PNG diff tool
  run.sh                 # Pipeline orchestrator
```

## Adding a Fixture

1. Create `fixtures/<name>.py` with a Textual `App` class assigned to `app`.
2. Create `fixtures/<name>.tsx` with a default-exported React component.
3. Both should render the same widget layout.
4. Run `./visual-tests/run.sh <name>` to capture and compare.

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

- **uv** — [Install](https://docs.astral.sh/uv/getting-started/installation/). Manages the Python environment and `textual` dependency automatically.
- **tsx** — `npm install -g tsx`. Runs the TypeScript capture and compare scripts.
- **Ghostty** — Required so the harness can render and capture exactly one terminal window with truecolor support.
- **ImageMagick** — Provides the `magick` CLI for pixel diffs.
- **Node 18+** with project dependencies (`npm install`).
