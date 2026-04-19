#!/usr/bin/env bash

set -euo pipefail

frame_path="$1"
ready_path="$2"
control_path="$3"

cat "$frame_path"
touch "$ready_path"

while [[ -e "$control_path" ]]; do
  sleep 0.1
done
