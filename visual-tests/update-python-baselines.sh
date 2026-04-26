#!/usr/bin/env bash
#
# Regenerate committed Python reference PNGs for all active fixtures and
# explicitly tracked future fixtures in fixture-todos.json.
#
# Fixtures run inside Docker: real xterm renders real Textual output; PNGs
# are what xterm actually draws. Host has no focus changes — everything
# happens on Xvfb :99 inside the container.
#
# The visual gate compares textual-js PNGs against the baselines produced
# here; it does not call this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURE="${1:-}"

cd "$PROJECT_DIR"

for tool in tsx docker; do
  if ! command -v "$tool" &>/dev/null; then
    echo "FATAL: $tool is not installed." >&2
    exit 1
  fi
done

echo "=== Python Visual Baseline Generation ==="
echo ""

if [ -n "$FIXTURE" ]; then
  tsx visual-tests/render_pngs.ts "$FIXTURE" --side=python
else
  tsx visual-tests/render_pngs.ts --side=python
fi

echo ""
echo "Done. Review and commit visual-tests/snapshots/python/*.png."
