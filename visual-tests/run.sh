#!/usr/bin/env bash
#
# Run the full visual comparison pipeline:
#   1. Capture textual-js ANSI frames
#   2. Render textual-js PNG screenshots in an isolated Xvfb terminal
#   3. Compare JS PNGs against committed Python PNG baselines
#
# Prerequisites:
#   - Node 18+ with project dependencies: npm install
#   - tsx available on PATH
#   - Docker available (for isolated Xvfb screenshots)
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

if ! command -v docker &>/dev/null; then
  echo "FATAL: docker is not installed." >&2
  echo "       Install Docker so the harness can capture screenshots in an isolated Xvfb display." >&2
  exit 1
fi

echo "=== Visual Comparison Pipeline ==="
echo ""

# [LAW:single-enforcer] The visual harness owns the terminal capability
# contract so both renderers run against one explicit truecolor environment.
export COLORTERM="truecolor"

echo "--- Step 1: textual-js ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/capture_js.ts "$FIXTURE"
else
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/capture_js.ts
fi
echo ""

echo "--- Step 2: Render JS PNG Screenshots ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/render_pngs.ts "$FIXTURE" --side=js
else
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/render_pngs.ts --side=js
fi
echo ""

echo "--- Step 3: Compare Against Python Baselines ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/compare.ts "$FIXTURE"
else
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/compare.ts
fi
