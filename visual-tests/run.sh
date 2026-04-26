#!/usr/bin/env bash
#
# Gate 4 (visual comparison) for textual-js.
#
# Pipeline:
#   1. Render textual-js PNGs inside Docker (real xterm, no reconstructed ANSI).
#   2. Compare rendered JS PNGs against committed Python baselines at AE == 0.
#
# Python baselines are not regenerated here. Use
# visual-tests/update-python-baselines.sh when those need refreshing.
#
# Usage:
#   bash visual-tests/run.sh              # all paired fixtures
#   bash visual-tests/run.sh button_variants   # single fixture

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURE="${1:-}"

cd "$PROJECT_DIR"

for tool in tsx docker magick; do
  if ! command -v "$tool" &>/dev/null; then
    echo "FATAL: $tool is not installed." >&2
    exit 1
  fi
done

echo "=== Visual Comparison Pipeline ==="
echo ""

echo "--- Step 1: render JS PNGs (real xterm in Docker) ---"
if [ -n "$FIXTURE" ]; then
  tsx visual-tests/render_pngs.ts "$FIXTURE" --side=js
else
  tsx visual-tests/render_pngs.ts --side=js
fi
echo ""

echo "--- Step 2: compare against Python baselines ---"
if [ -n "$FIXTURE" ]; then
  tsx visual-tests/compare.ts "$FIXTURE"
else
  tsx visual-tests/compare.ts
fi
