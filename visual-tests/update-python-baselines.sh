#!/usr/bin/env bash
#
# Regenerate committed Python reference PNGs for all paired visual fixtures.
# The hard gate does not run this script; it compares JS screenshots against
# the committed Python PNGs produced here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURE="${1:-}"

cd "$PROJECT_DIR"

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

if ! command -v docker &>/dev/null; then
  echo "FATAL: docker is not installed." >&2
  echo "       Install Docker so the harness can capture screenshots in an isolated Xvfb display." >&2
  exit 1
fi

echo "=== Python Visual Baseline Generation ==="
echo ""

# [LAW:single-enforcer] Baseline generation is the only task that refreshes
# committed Python reference screenshots.
export COLORTERM="truecolor"

echo "--- Step 1: Python Textual (via uv) ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" uv run --project visual-tests python visual-tests/capture_python.py "$FIXTURE"
else
  env -u NO_COLOR COLORTERM="$COLORTERM" uv run --project visual-tests python visual-tests/capture_python.py
fi
echo ""

echo "--- Step 2: Render Python PNG Baselines ---"
if [ -n "$FIXTURE" ]; then
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/render_pngs.ts "$FIXTURE" --side=python
else
  env -u NO_COLOR COLORTERM="$COLORTERM" tsx visual-tests/render_pngs.ts --side=python
fi
echo ""

echo "Done. Review and commit visual-tests/snapshots/python/*.png."
