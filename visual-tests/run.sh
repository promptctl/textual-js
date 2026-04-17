#!/usr/bin/env bash
#
# Run the full visual comparison pipeline:
#   1. Capture Python Textual screenshots (via uv)
#   2. Capture textual-js screenshots
#   3. Compare the text grids
#
# Prerequisites:
#   - uv (https://docs.astral.sh/uv/)
#   - Node 18+ with project dependencies: npm install
#   - tsx available on PATH
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

echo "=== Visual Comparison Pipeline ==="
echo ""

# Step 1: Capture Python Textual via uv
# uv reads visual-tests/pyproject.toml, creates/reuses a venv, installs
# textual, and runs the capture script. No manual environment management.
echo "--- Step 1: Python Textual (via uv) ---"
if [ -n "$FIXTURE" ]; then
  uv run --project visual-tests python visual-tests/capture_python.py "$FIXTURE"
else
  uv run --project visual-tests python visual-tests/capture_python.py
fi
echo ""

# Step 2: Capture textual-js
echo "--- Step 2: textual-js ---"
if [ -n "$FIXTURE" ]; then
  tsx visual-tests/capture_js.ts "$FIXTURE"
else
  tsx visual-tests/capture_js.ts
fi
echo ""

# Step 3: Compare
echo "--- Step 3: Compare ---"
if [ -n "$FIXTURE" ]; then
  tsx visual-tests/compare.ts "$FIXTURE"
else
  tsx visual-tests/compare.ts
fi
