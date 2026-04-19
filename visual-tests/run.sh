#!/usr/bin/env bash
#
# Run the full visual comparison pipeline:
#   1. Capture Python Textual ANSI frames (via uv)
#   2. Capture textual-js ANSI frames
#   3. Render real PNG screenshots in a dedicated iTerm2 window
#   4. Compare the PNGs
#
# Prerequisites:
#   - uv (https://docs.astral.sh/uv/)
#   - Node 18+ with project dependencies: npm install
#   - tsx available on PATH
#   - Ghostty installed (for single-window screenshots)
#   - ImageMagick's magick CLI on PATH
#
# uv resolves Python + textual automatically from visual-tests/pyproject.toml.
# There is no manual pip install step.
#
# Usage:
#   ./visual-tests/run.sh              # Run all fixtures
#   ./visual-tests/run.sh static_basic # Run one fixture

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURE="${1:-}"

cd "$PROJECT_DIR"

# ── Preflight: fail immediately if tools are missing ──

if ! command -v uv &>/dev/null; then
  echo "FATAL: uv is not installed." >&2
  echo "       Install it: https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 1
fi

if ! command -v tsx &>/dev/null; then
  echo "FATAL: tsx is not installed." >&2
  echo "       Install it: npm install -g tsx" >&2
  exit 1
fi

if ! command -v magick &>/dev/null; then
  echo "FATAL: magick is not installed." >&2
  echo "       Install ImageMagick so PNG screenshots can be compared." >&2
  exit 1
fi

if ! command -v screencapture &>/dev/null; then
  echo "FATAL: screencapture is not installed." >&2
  echo "       This visual harness currently requires macOS window capture." >&2
  exit 1
fi

if ! command -v osascript &>/dev/null; then
  echo "FATAL: osascript is not installed." >&2
  echo "       This visual harness currently requires AppleScript automation." >&2
  exit 1
fi

if ! osascript -e 'id of application "Ghostty"' &>/dev/null; then
  echo "FATAL: Ghostty is not installed." >&2
  echo "       Install Ghostty so the harness can capture a single terminal window." >&2
  exit 1
fi

echo "=== Visual Comparison Pipeline ==="
echo ""

# [LAW:single-enforcer] The visual harness owns the terminal capability
# contract so both renderers run against one explicit truecolor environment.
export COLORTERM="truecolor"

# Step 1: Capture Python Textual via uv
# uv reads visual-tests/pyproject.toml, creates/reuses a venv, installs
# textual, and runs the capture script. No manual environment management.
echo "--- Step 1: Python Textual (via uv) ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" uv run --project visual-tests python visual-tests/capture_python.py "$FIXTURE"
else
  env -u NO_COLOR COLORTERM="$COLORTERM" uv run --project visual-tests python visual-tests/capture_python.py
fi
echo ""

# Step 2: Capture textual-js
echo "--- Step 2: textual-js ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/capture_js.ts "$FIXTURE"
else
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/capture_js.ts
fi
echo ""

# Step 3: Render PNG screenshots
echo "--- Step 3: Render PNG Screenshots ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/render_pngs.ts "$FIXTURE"
else
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/render_pngs.ts
fi
echo ""

# Step 4: Compare
echo "--- Step 4: Compare PNGs ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/compare.ts "$FIXTURE"
else
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/compare.ts
fi
