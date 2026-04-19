#!/usr/bin/env bash

set -euo pipefail

frame_path="$1"
ready_path="$2"
control_path="$3"
title="$4"

cleanup() {
  printf '\033[0m\033[?7h\033[?25h\033[?1049l'
}

trap cleanup EXIT

# [LAW:single-enforcer] The terminal preamble lives in one helper so Python
# and JS frames are both rendered into the same capture window contract.
printf '\033]0;%s\007' "$title"
printf '\033[?1049h\033[?7l\033[?25l\033[2J\033[3J\033[H'
cat "$frame_path"
touch "$ready_path"

while [[ -e "$control_path" ]]; do
  sleep 0.1
done
