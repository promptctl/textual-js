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
#
# ── Test-mode contract (the knobs that make rendering deterministic) ──────
# These are the only places the harness deviates from "production" behavior;
# every knob has an owner and a load-bearing reason. Adding a knob means
# adding a row here and a comment at the call site.
#
#   visual-tests/capture-env
#                          Every environment variable the fixture runs under,
#                          and the reason for each. Owned by that file, not by
#                          this one — capture_python.py applies the same file,
#                          which is what keeps the PNG and the cell record on the
#                          same frame. Add environment knobs there.
#   xterm -bg "#121212"    Truecolor background; matches the Screen CSS
#                          painted by both sides so empty cells agree.
#   xterm -cr "#121212"    Cursor color = bg, hiding the block cursor that
#                          would otherwise overlay the focused widget.
#   xterm +bc              Disable hardware cursor blink. Same anti-blink
#                          rationale as TEXTUAL_ANIMATIONS=none.
#   xterm -u8              Force UTF-8 decoding (combined with C.UTF-8 locale
#                          baked into the Docker image).
#   xterm +sb              Remove scrollbar so cell-to-pixel math (used for
#                          mouse injection) starts at x=0.
#   xterm -xrm "XTerm*vt100.allowSendEvents: true"
#                          Lets xdotool synthesize keyboard events into this
#                          xterm. This is a security footgun in a long-lived
#                          xterm; here the xterm lives ~5–15s in a sealed
#                          Xvfb, so the blast radius is the test container.
#   xterm -xrm "XTerm*vt100.translations: #override <Key>F13: redraw()"
#                          Binds a repaint to a key no fixture binds, so the
#                          final screenshot is taken of a window redrawn from
#                          xterm's screen buffer rather than of whatever the
#                          writer's byte chunking happened to rasterise. See
#                          the repaint step near the end of this script.

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
interactions_tsv="${work_dir}/interactions.tsv"

# [LAW:no-defensive-null-guards] PIDs default to 0 (unused init) so cleanup
# is unconditional — `kill 0` is harmless if the process never started.
xvfb_pid=0
xterm_pid=0

cleanup() {
  local code=$?
  # Cleanup is the one place where ignoring kill failures is justified: the
  # processes may already have exited, and we have no recourse if they
  # haven't. We do NOT use this pattern anywhere else.
  if (( xterm_pid != 0 )); then
    kill "$xterm_pid" 2>/dev/null || true
    wait "$xterm_pid" 2>/dev/null || true
  fi
  if (( xvfb_pid != 0 )); then
    kill "$xvfb_pid" 2>/dev/null || true
    wait "$xvfb_pid" 2>/dev/null || true
  fi
  rm -rf "$work_dir"
  exit "$code"
}
trap cleanup EXIT

# ── Side-keyed dispatch (single source of truth for per-side variation) ───
# [LAW:one-source-of-truth] Every other piece of code in this script treats
# `side` as opaque; only this table knows what each side actually is.
case "$side" in
  python) runner_command="uv run --project ${visual_dir} python ${visual_dir}/runner_py.py ${fixture}" ;;
  js)     runner_command="tsx ${visual_dir}/runner_js.tsx ${fixture}" ;;
esac

# ── Extract & validate declarative interactions (TSV pre-pass) ────────────
# [LAW:single-enforcer] One validator, one schema. extract-interactions.ts
# fails loud on a missing 'interactions' export, malformed steps, or unknown
# action types — the orchestrator never sees garbage.
tsx "${visual_dir}/extract-interactions.ts" "$side" "$fixture" > "$interactions_tsv"

# ── Start Xvfb ────────────────────────────────────────────────────────────
Xvfb "$display" -screen 0 1600x1200x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
xvfb_pid="$!"
export DISPLAY="$display"

for _ in $(seq 1 100); do
  xdpyinfo >/dev/null 2>&1 && break
  sleep 0.05
done
# Final check shows xdpyinfo's actual error (not /dev/null) so a stuck Xvfb
# leaves a useful stderr trail.
if ! xdpyinfo >/dev/null; then
  echo "fatal: Xvfb never came up on ${display}" >&2
  exit 1
fi

# ── Load the shared capture environment ──────────────────────────────────
# [LAW:one-source-of-truth] visual-tests/capture-env is the only statement of
# what environment a fixture is captured under; both this path and
# capture_python.py apply it whole, so the PNG and the cell record describe the
# same frame. Read into an array rather than exported, so it reaches the xterm
# child without leaking into the orchestration around it.
capture_env=()
capture_env_unset=()
capture_env_line=0
# `trim` is the whole reason this loader can agree with capture_python.py's
# line.strip()/key.strip()/value.strip(): every piece of a directive goes through
# it, so no amount of incidental spacing changes what either path applies.
trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  printf '%s' "${s%"${s##*[![:space:]]}"}"
}

capture_env_fatal() {
  echo "fatal: ${visual_dir}/capture-env:${capture_env_line}: $1" >&2
  exit 1
}

# The `echo` closes the classic `read` gotcha: a final line with no trailing
# newline populates `line` but returns non-zero, so the loop body never runs for
# it. capture_python.py reads through splitlines() and is immune. The last line
# here is the `-NO_COLOR` directive, so the divergence that bug would produce is
# colour silently surviving in the real-terminal capture and nowhere else.
while IFS= read -r line; do
  capture_env_line=$(( capture_env_line + 1 ))
  line="$(trim "$line")"
  [[ -z "$line" || "$line" == \#* ]] && continue

  # A leading `-` removes the variable; see the format note in capture-env.
  if [[ "$line" == -* ]]; then
    name="$(trim "${line#-}")"
    # [LAW:no-silent-failure] `-NO_COLOR=1` would otherwise be stored whole and
    # unset a variable of that literal name, leaving the real NO_COLOR set with
    # nothing reported. The removal branch gets the same refusal as the
    # assignment branch, because it can fail the same way.
    [[ -n "$name" && "$name" != *=* ]] || capture_env_fatal "expected -KEY, got '${line}'"
    capture_env_unset+=("$name")
    continue
  fi

  # [LAW:no-silent-failure] `env` execs the first argument that is not KEY=VALUE,
  # so a malformed line here would surface as `env: <garbage>: No such file or
  # directory` from a process three layers down. capture_python.py rejects the
  # same line naming file:line, and a file both paths must "apply whole" has to
  # fail the same way on both.
  [[ "$line" == *=* ]] || capture_env_fatal "expected KEY=VALUE or -KEY, got '${line}'"
  key="$(trim "${line%%=*}")"
  value="$(trim "${line#*=}")"
  [[ -n "$key" ]] || capture_env_fatal "expected KEY=VALUE or -KEY, got '${line}'"
  capture_env+=("${key}=${value}")
done < <(cat "${visual_dir}/capture-env"; echo)

# [LAW:no-silent-failure] An empty environment would render every fixture under
# whatever the ambient shell happens to hold, producing baselines nobody can
# reproduce, and the PNGs would look plausible either way.
if (( ${#capture_env[@]} == 0 )); then
  echo "fatal: ${visual_dir}/capture-env declared no variables" >&2
  exit 1
fi

# ── Launch xterm running the real fixture ────────────────────────────────
# `env -u` args are built from capture-env's `-KEY` directives, not hardcoded, so
# a variable that must be absent is declared in the same one file as every
# variable that must be set. [LAW:one-source-of-truth]
env_unset_args=()
for name in ${capture_env_unset[@]+"${capture_env_unset[@]}"}; do
  env_unset_args+=(-u "$name")
done

env ${env_unset_args[@]+"${env_unset_args[@]}"} \
  "${capture_env[@]}" \
  xterm \
    -u8 \
    +sb \
    -xrm "XTerm*vt100.allowSendEvents: true" \
    -xrm "XTerm*vt100.translations: #override <Key>F13: redraw()" \
    -geometry 80x24 \
    -fa "DejaVu Sans Mono" \
    -fs 14 \
    -bg "#121212" \
    -fg "#e0e0e0" \
    -cr "#121212" \
    +bc \
    -T "$title" \
    -e bash -c "cd ${project_dir} && sleep 0.5 && exec ${runner_command}" &
xterm_pid="$!"

# ── Locate the xterm window ──────────────────────────────────────────────
window_id=""
for _ in $(seq 1 200); do
  window_id="$(xdotool search --name "$title" 2>/dev/null | head -n 1 || true)"
  [[ -n "$window_id" ]] && break
  sleep 0.05
done
[[ -n "$window_id" ]] || { echo "fatal: xterm window never appeared for ${fixture}" >&2; exit 1; }

# Give xterm input focus. Xvfb has no window manager, so we use XSetInputFocus
# (windowfocus) rather than _NET_ACTIVE_WINDOW (windowactivate).
# Race: xterm appears in xdotool search before its X subwindows are ready
# for focus. Retry a few times before treating as fatal.
for _ in $(seq 1 20); do
  xdotool windowfocus --sync "$window_id" 2>/dev/null && break
  sleep 0.1
done
# Final attempt with stderr visible — fail loud if still bad.
xdotool windowfocus --sync "$window_id"

# ── Measure cell geometry for hover/click targets ────────────────────────
# xwininfo reports the inner drawable size (xterm +sb = no scrollbar).
# awk does the float math; no per-call python startup cost.
read -r win_width win_height <<<"$(xwininfo -id "$window_id" | awk '/Width:/ {w=$2} /Height:/ {h=$2} END {print w, h}')"

cell_to_px() {
  # cell_to_px <col> <row> → "<px_x> <px_y>"
  awk -v w="$win_width" -v h="$win_height" -v c="$1" -v r="$2" \
      'BEGIN { cw=w/80; ch=h/24; printf "%d %d\n", c*cw + cw/2, r*ch + ch/2 }'
}

# ── Stability polling ────────────────────────────────────────────────────
# `wait_for_stability` writes the SHA of the stable frame into `last_stable_sha`
# so callers can assert that a subsequent action actually changed the screen.
last_stable_sha=""

shoot() {
  import -window "$window_id" "$1"
}

# wait_for_stability <timeout_ms> <reject_sha>
#
# Polls screenshots every 250ms. A stable frame requires both:
#   (a) stable_needed consecutive identical SHAs, AND
#   (b) the SHA differs from reject_sha.
#
# (b) closes the "stable but wrong frame" class of bug. Before the runner
# produces content, xterm shows a blank window that is itself perfectly
# stable across frames — without the reject_sha guard, the detector locks
# in on this pre-content frame, and the final screenshot captures blank
# xterm instead of fixture output. By passing the pre-render (or
# pre-interaction) SHA as reject_sha, we force the detector to wait for an
# actual screen transition before counting stability.
wait_for_stability() {
  local timeout_ms="$1"
  local reject_sha="$2"
  local min_settle_ms=1500
  local interval_ms=250
  local stable_needed=5
  local steps=$(( timeout_ms / interval_ms ))
  local settle_steps=$(( min_settle_ms / interval_ms ))

  # [LAW:verifiable-goals] A timeout shorter than the settle window would
  # never reach a stable frame at all. Refuse loud rather than report
  # spurious stabilization (or, on steps=0, silently fall through).
  local min_steps=$(( settle_steps + stable_needed - 1 ))
  if (( steps < min_steps )); then
    echo "fatal: wait_for_stability timeout (${timeout_ms}ms) below minimum (${min_steps} * ${interval_ms}ms)" >&2
    return 1
  fi

  # reject_sha == "" is the "settle-only" mode, used by the `wait`
  # interaction which is definitionally post-render and has no change
  # requirement. The initial-render and post-interaction callers must
  # always pass a real SHA so the detector cannot lock in on the wrong
  # pre-frame.
  local stable=0
  local prev_sha=""

  for step in $(seq 1 "$steps"); do
    sleep "$(awk -v ms="$interval_ms" 'BEGIN { printf "%.3f", ms/1000 }')"
    shoot "$next_shot"
    local sha
    sha="$(sha256sum "$next_shot" | awk '{print $1}')"

    if (( step < settle_steps )); then
      prev_sha="$sha"
      continue
    fi

    if [[ "$sha" == "$prev_sha" && -n "$prev_sha" && "$sha" != "$reject_sha" ]]; then
      stable=$(( stable + 1 ))
      if (( stable >= stable_needed - 1 )); then
        cp "$next_shot" "$prev_shot"
        last_stable_sha="$sha"
        return 0
      fi
    else
      stable=0
    fi
    prev_sha="$sha"
  done

  echo "fatal: fixture ${side}/${fixture} never diverged from baseline ${reject_sha:0:12} within ${timeout_ms}ms" >&2
  return 1
}

# [LAW:single-enforcer] The 0.5s sleep in the xterm command guarantees
# the runner has not yet imported or rendered when we capture this blank.
# Any "stable" frame equal to this baseline means the runner never drew —
# never a real fixture render. wait_for_stability rejects that outcome.
shoot "$next_shot"
blank_xterm_sha="$(sha256sum "$next_shot" | awk '{print $1}')"

wait_for_stability 12000 "$blank_xterm_sha"

# ── Drive interactions ───────────────────────────────────────────────────
# Each interaction reads its row from the TSV with no further parsing. After
# every interaction (except `wait`), the new stable SHA must differ from the
# pre-action SHA — otherwise the keystroke / click never landed and we'd be
# screenshotting a stale frame as if the interaction succeeded.
#
# `set -e` propagates xdotool failures; we don't need per-call `|| exit`.
assert_screen_changed() {
  local action_desc="$1"
  local pre_sha="$2"
  if [[ "$last_stable_sha" == "$pre_sha" ]]; then
    echo "fatal: ${side}/${fixture}: ${action_desc} produced no screen change" >&2
    return 1
  fi
}

if [[ -s "$interactions_tsv" ]]; then
  step_index=0
  while IFS=$'\t' read -r action arg1 arg2 arg3; do
    pre_sha="$last_stable_sha"
    case "$action" in
      key)
        xdotool windowfocus --sync "$window_id"
        xdotool key --window "$window_id" --clearmodifiers "$arg1"
        wait_for_stability 6000 "$pre_sha"
        assert_screen_changed "key '${arg1}'" "$pre_sha"
        ;;
      type)
        xdotool windowfocus --sync "$window_id"
        xdotool type --window "$window_id" --clearmodifiers --delay 5 -- "$arg1"
        wait_for_stability 6000 "$pre_sha"
        assert_screen_changed "type '${arg1}'" "$pre_sha"
        ;;
      hover)
        read -r px py <<<"$(cell_to_px "$arg1" "$arg2")"
        # Bump the pointer off-target then onto the cell so xterm always
        # emits a motion event, even if the cursor was already nearby.
        xdotool mousemove --window "$window_id" 0 0
        xdotool mousemove --window "$window_id" "$px" "$py"
        wait_for_stability 6000 "$pre_sha"
        assert_screen_changed "hover (${arg1},${arg2})" "$pre_sha"
        ;;
      click)
        read -r px py <<<"$(cell_to_px "$arg1" "$arg2")"
        xdotool mousemove --window "$window_id" "$px" "$py"
        xdotool click "$arg3"
        wait_for_stability 6000 "$pre_sha"
        assert_screen_changed "click (${arg1},${arg2}) button=${arg3}" "$pre_sha"
        ;;
      wait)
        sleep "$(awk -v ms="$arg1" 'BEGIN { printf "%.3f", ms/1000 }')"
        # `wait` runs only after initial render has already stabilized, so
        # the settle-only mode (empty reject_sha) cannot accidentally lock
        # in on a pre-render blank frame.
        wait_for_stability 6000 ""
        # `wait` may legitimately produce no screen change (it's a settle
        # request, not an action). Skip the assert.
        ;;
      *)
        echo "fatal: unknown interaction type '${action}' at index ${step_index}" >&2
        exit 1
        ;;
    esac
    step_index=$(( step_index + 1 ))
  done < "$interactions_tsv"
fi

# ── Repaint from the screen buffer, then screenshot ──────────────────────
# xterm rasterises each contiguous chunk of printable bytes it receives as one
# draw call, so identical screen contents look different depending on how the
# writer chunked them. rich emits one write per styled run; Ink coalesces cells
# of equal style first. Same buffer, same colours, and a one-pixel seam at the
# last column of every cell followed by a same-coloured cell — a fact about the
# byte stream, not about anything on screen, which any repaint erases.
#
# redraw() repaints the window from xterm's own screen buffer: a pure function of
# the buffer and the font that knows nothing about who wrote it. Both sides land
# on the same rasterisation, so the gate measures the terminal's contents rather
# than the writer's chunking. It cannot hide a real defect — a difference in any
# cell's character, colour or style is a different buffer, and repaints differently.
#
# Unconditional and identical on both sides; repainting only where a fixture
# "needs" it would reintroduce the asymmetry this removes.
# [LAW:dataflow-not-control-flow]
#
# F13 because no fixture binds it, so the keystroke cannot be read as input.
# Settling goes through the same owner as every other step, in settle-only mode:
# the repaint is post-render by definition and may reproduce the identical frame.
# [LAW:no-ambient-temporal-coupling]
xdotool windowfocus --sync "$window_id"
xdotool key --window "$window_id" --clearmodifiers F13
wait_for_stability 6000 ""

# ── Final screenshot ─────────────────────────────────────────────────────
mkdir -p "$(dirname "$output_path")"
shoot "$output_path"
