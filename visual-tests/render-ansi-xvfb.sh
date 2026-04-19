#!/usr/bin/env bash

set -euo pipefail

frame_path="$1"
output_path="$2"
title="$3"

display=":99"
ready_path="$(mktemp)"
control_path="$(mktemp)"
rm -f "$ready_path"
touch "$control_path"

cleanup() {
  rm -f "$ready_path" "$control_path"
  if [[ -n "${xterm_pid:-}" ]]; then
    kill "$xterm_pid" >/dev/null 2>&1 || true
  fi
  if [[ -n "${xvfb_pid:-}" ]]; then
    kill "$xvfb_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

Xvfb "$display" -screen 0 1600x1200x24 -nolisten tcp >/tmp/textual-js-xvfb.log 2>&1 &
xvfb_pid="$!"
export DISPLAY="$display"

for _ in $(seq 1 100); do
  if xdpyinfo >/dev/null 2>&1; then
    break
  fi
  sleep 0.05
done

if ! xdpyinfo >/dev/null 2>&1; then
  echo "Timed out waiting for Xvfb display" >&2
  exit 1
fi

xterm \
  -geometry 80x24 \
  -fa "DejaVu Sans Mono" \
  -fs 14 \
  -bg "#121212" \
  -fg "#e0e0e0" \
  -cr "#121212" \
  +bc \
  -T "$title" \
  -e bash /work/visual-tests/display-ansi.sh "$frame_path" "$ready_path" "$control_path" &
xterm_pid="$!"

for _ in $(seq 1 100); do
  if [[ -e "$ready_path" ]]; then
    break
  fi
  sleep 0.05
done

if [[ ! -e "$ready_path" ]]; then
  echo "Timed out waiting for xterm render-ready signal" >&2
  exit 1
fi

window_id=""
for _ in $(seq 1 100); do
  window_id="$(xdotool search --name "$title" 2>/dev/null | head -n 1 || true)"
  if [[ -n "$window_id" ]]; then
    break
  fi
  sleep 0.05
done

if [[ -z "$window_id" ]]; then
  echo "Timed out locating xterm window: $title" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"
import -window "$window_id" "$output_path"
