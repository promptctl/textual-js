#!/usr/bin/env bash
#
# Real black-box fixture render.
#
# Usage: render-fixture-xvfb.sh <side> <fixture-name> <output-png>
#   side = python | js
#
# Runs inside the visual-tests Docker image. Spawns Xvfb + xterm, launches the
# appropriate runner inside xterm, waits for the render to stabilize, injects
# declarative interactions via xdotool, then screenshots the final xterm
# window into <output-png>.
#
# There is no reconstructed ANSI on this path. The fixture is real library
# code; the terminal output is whatever the framework actually writes; the
# PNG is what xterm actually draws.

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: render-fixture-xvfb.sh <python|js> <fixture> <output.png>" >&2
  exit 2
fi

side="$1"
fixture="$2"
output_path="$3"

case "$side" in
  python|js) ;;
  *) echo "fatal: side must be 'python' or 'js' (got: $side)" >&2; exit 2 ;;
esac

visual_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "${visual_dir}/.." && pwd)"

display=":99"
title="textual-js visual fixture: ${fixture} ${side}"

# Temp work for stability polling (never mixed with committed snapshots).
work_dir="$(mktemp -d)"
prev_shot="${work_dir}/prev.png"
next_shot="${work_dir}/next.png"

xvfb_pid=""
xterm_pid=""

cleanup() {
  local code=$?
  if [[ -n "$xterm_pid" ]]; then
    kill "$xterm_pid" 2>/dev/null || true
    wait "$xterm_pid" 2>/dev/null || true
  fi
  if [[ -n "$xvfb_pid" ]]; then
    kill "$xvfb_pid" 2>/dev/null || true
    wait "$xvfb_pid" 2>/dev/null || true
  fi
  rm -rf "$work_dir"
  exit "$code"
}
trap cleanup EXIT

# ── Extract declarative interactions for this fixture ─────────────────────
# Scripting discipline: validate the JSON shape before using it; never let a
# broken fixture cause garbage xdotool calls.
interactions_json="$(tsx "${visual_dir}/extract-interactions.ts" "$side" "$fixture")"
if ! echo "$interactions_json" | python3 -c "import json,sys; data=json.load(sys.stdin); assert isinstance(data, list), 'not an array'" >/dev/null 2>&1; then
  echo "fatal: extract-interactions returned invalid JSON for ${side}/${fixture}: ${interactions_json}" >&2
  exit 1
fi
interaction_count="$(echo "$interactions_json" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")"

# ── Start Xvfb ────────────────────────────────────────────────────────────
Xvfb "$display" -screen 0 1600x1200x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
xvfb_pid="$!"
export DISPLAY="$display"

for _ in $(seq 1 100); do
  xdpyinfo >/dev/null 2>&1 && break
  sleep 0.05
done
xdpyinfo >/dev/null 2>&1 || { echo "fatal: Xvfb never came up" >&2; exit 1; }

# ── Build the runner command ──────────────────────────────────────────────
case "$side" in
  python)
    runner_command="uv run --project ${visual_dir} python ${visual_dir}/runner_py.py ${fixture}"
    ;;
  js)
    runner_command="tsx ${visual_dir}/runner_js.tsx ${fixture}"
    ;;
esac

# ── Launch xterm running the real fixture ─────────────────────────────────
# -u8 + LC_ALL=C.UTF-8 force UTF-8 decoding; +sb removes the scrollbar so
# cell-to-pixel math is unambiguous for mouse injection.
env -u NO_COLOR \
  COLORTERM=truecolor \
  TERM=xterm-direct \
  TEXTUAL_ANIMATIONS=none \
  TEXTUAL_COLOR_SYSTEM=truecolor \
  FORCE_COLOR=3 \
  xterm \
    -u8 \
    +sb \
    -xrm "XTerm*vt100.allowSendEvents: true" \
    -geometry 80x24 \
    -fa "DejaVu Sans Mono" \
    -fs 14 \
    -bg "#121212" \
    -fg "#e0e0e0" \
    -cr "#121212" \
    +bc \
    -T "$title" \
    -e bash -c "cd ${project_dir} && exec ${runner_command}" &
xterm_pid="$!"

# ── Locate the xterm window ───────────────────────────────────────────────
window_id=""
for _ in $(seq 1 200); do
  window_id="$(xdotool search --name "$title" 2>/dev/null | head -n 1 || true)"
  [[ -n "$window_id" ]] && break
  sleep 0.05
done
[[ -n "$window_id" ]] || { echo "fatal: xterm window never appeared for ${fixture}" >&2; exit 1; }

# Give xterm input focus. Xvfb has no window manager, so we use XSetInputFocus
# (windowfocus) rather than _NET_ACTIVE_WINDOW (windowactivate).
xdotool windowfocus --sync "$window_id"

# ── Measure cell geometry for hover/click targets ─────────────────────────
# xwininfo reports the inner drawable size (xterm +sb = no scrollbar).
read -r win_width win_height <<<"$(xwininfo -id "$window_id" | awk '/Width:/ {w=$2} /Height:/ {h=$2} END {print w, h}')"
cell_width="$(python3 -c "print(${win_width} / 80.0)")"
cell_height="$(python3 -c "print(${win_height} / 24.0)")"

# ── Stability polling ─────────────────────────────────────────────────────
# Three consecutive byte-identical screenshots → considered stable. Timeouts
# fail loudly rather than screenshotting a half-rendered frame.
shoot() {
  import -window "$window_id" "$1"
}

wait_for_stability() {
  # Force a minimum settle time before accepting any stability; otherwise a
  # pre-render blank frame can stabilize against itself. After the settle
  # window, require five consecutive byte-identical frames.
  local timeout_ms="$1"
  local min_settle_ms=1500
  local interval_ms=250
  local stable_needed=5
  local steps=$(( timeout_ms / interval_ms ))
  local settle_steps=$(( min_settle_ms / interval_ms ))
  local stable=0
  local prev_sha=""

  for step in $(seq 1 "$steps"); do
    sleep "$(python3 -c "print(${interval_ms}/1000.0)")"
    shoot "$next_shot"
    local sha
    sha="$(sha256sum "$next_shot" | awk '{print $1}')"

    if (( step < settle_steps )); then
      prev_sha="$sha"
      continue
    fi

    if [[ "$sha" == "$prev_sha" && -n "$prev_sha" ]]; then
      stable=$(( stable + 1 ))
      if (( stable >= stable_needed - 1 )); then
        cp "$next_shot" "$prev_shot"
        return 0
      fi
    else
      stable=0
    fi
    prev_sha="$sha"
  done

  echo "fatal: fixture ${side}/${fixture} never stabilized within ${timeout_ms}ms" >&2
  return 1
}

wait_for_stability 12000

# ── Drive interactions ────────────────────────────────────────────────────
if (( interaction_count > 0 )); then
  echo "$interactions_json" > "${work_dir}/interactions.json"
  for index in $(seq 0 $(( interaction_count - 1 ))); do
    action="$(python3 -c "
import json
step = json.load(open('${work_dir}/interactions.json'))[${index}]
print(step.get('type', ''))
")"
    case "$action" in
      key)
        keys="$(python3 -c "
import json
print(json.load(open('${work_dir}/interactions.json'))[${index}]['keys'])
")"
        xdotool windowfocus --sync "$window_id"
        xdotool key --window "$window_id" --clearmodifiers "$keys"
        wait_for_stability 3000
        ;;
      type)
        text="$(python3 -c "
import json
print(json.load(open('${work_dir}/interactions.json'))[${index}]['text'])
")"
        xdotool windowfocus --sync "$window_id"
        xdotool type --window "$window_id" --clearmodifiers --delay 5 -- "$text"
        wait_for_stability 3000
        ;;
      hover)
        read -r col row <<<"$(python3 -c "
import json
step = json.load(open('${work_dir}/interactions.json'))[${index}]
print(step['cell'][0], step['cell'][1])
")"
        px="$(python3 -c "print(int(${col} * ${cell_width} + ${cell_width}/2))")"
        py="$(python3 -c "print(int(${row} * ${cell_height} + ${cell_height}/2))")"
        # Force actual movement so xterm emits a motion event even if the
        # pointer is already near the target cell. Bump off, then in.
        xdotool mousemove --window "$window_id" 0 0
        xdotool mousemove --window "$window_id" "$px" "$py"
        wait_for_stability 3000
        ;;
      click)
        read -r col row button <<<"$(python3 -c "
import json
step = json.load(open('${work_dir}/interactions.json'))[${index}]
print(step['cell'][0], step['cell'][1], step.get('button', 1))
")"
        px="$(python3 -c "print(int(${col} * ${cell_width} + ${cell_width}/2))")"
        py="$(python3 -c "print(int(${row} * ${cell_height} + ${cell_height}/2))")"
        xdotool mousemove --window "$window_id" "$px" "$py"
        xdotool click "$button"
        wait_for_stability 3000
        ;;
      wait)
        ms="$(python3 -c "
import json
print(json.load(open('${work_dir}/interactions.json'))[${index}]['ms'])
")"
        sleep "$(python3 -c "print(${ms}/1000.0)")"
        wait_for_stability 3000
        ;;
      *)
        echo "fatal: unknown interaction type '${action}' in ${side}/${fixture}" >&2
        exit 1
        ;;
    esac
  done
fi

# ── Final screenshot ──────────────────────────────────────────────────────
mkdir -p "$(dirname "$output_path")"
shoot "$output_path"
