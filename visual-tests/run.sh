#!/usr/bin/env bash
#
# Run the full visual comparison pipeline:
#   1. Capture Python Textual screenshots
#   2. Capture textual-js screenshots
#   3. Compare the text grids
#
# Prerequisites:
#   - Python 3.11+ with textual installed: pip install textual
#   - Node 18+ with project dependencies: npm install
#
# Usage:
#   ./visual-tests/run.sh              # Run all fixtures
#   ./visual-tests/run.sh static_basic # Run one fixture

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURE="${1:-}"

cd "$PROJECT_DIR"

echo "=== Visual Comparison Pipeline ==="
echo ""

# Step 1: Capture Python Textual
echo "--- Step 1: Python Textual ---"
if command -v python3 &>/dev/null && python3 -c "import textual" 2>/dev/null; then
  if [ -n "$FIXTURE" ]; then
    python3 visual-tests/capture_python.py "$FIXTURE"
  else
    python3 visual-tests/capture_python.py
  fi
else
  echo "  SKIP: python3 or textual not found. Install: pip install textual"
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
