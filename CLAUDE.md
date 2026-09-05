# CLAUDE.md — textual-js

A TypeScript port of Python's Textual, rendering through React/Ink. Every claim in this
file was checked against the repo. Check yours the same way before you add one — the
last version of this file carried two errors for months because each was inherited,
not verified.

Entry point for implementation work: `spec/impl/PROMPT.md`. Node >= 18.

---

## The oracle is Textual. Not rich-js. Not your reasoning about Textual.

`rich-js` is a rendering **dependency** of this port. It is not the behavioural
**oracle**. A supplier is not a judge. Textual's `Content` is a separate
implementation that shares ancestry with Rich's `Text` and has drifted from it, and
where they disagree, Textual is right by definition — Textual is what we are porting.

This is not hypothetical. An agent verified `Content.wrap` against Rich, found
agreement, and shipped a test literally named *"breaks where Rich breaks."* They
differ on five of eleven cases. At width 6:

```
Content("hello  world").wrap(6)  ->  ['hello', 'world']     # Textual
Text("hello  world").wrap(c, 6)  ->  ['hello ', 'world']    # Rich
```

Textual rstrips every divided line except the one that ends the paragraph. Rich does
not. The test passed. The port was wrong.

**Ask Textual directly. It costs one minute:**

```bash
cd visual-tests && uv run python -c \
  "from textual.content import Content; print([str(l) for l in Content('hello  world').wrap(6)])"
```

When the answer surprises you, read the method: `inspect.getsource(Content.wrap)` in
that same env.

The behaviour in this file was **verified against textual 8.2.3** — verified, not
pinned. `visual-tests/pyproject.toml` asks only for `textual>=1.0.0`, and
`visual-tests/uv.lock` is gitignored (`.gitignore:16`), so the version your env resolved
is not something the repo controls. If the oracle ever contradicts this file, establish
which one drifted before you believe either:

```bash
cd visual-tests && uv run python -c "import textual; print(textual.__version__)"
```

The moment this rule dies is quiet and reasonable. You will be mid-implementation,
`rich-js` will already be imported two lines up, its behaviour will be right there in
TypeScript you can read, and you will think: *"rich-js is the same lineage — I'll
match it and save the round trip."* That is the moment. The round trip is sixty
seconds; the divergence you just enshrined is a test that asserts the wrong answer
forever, and asserts it confidently. Run the Python.

---

## A green Gate 4 does not prove a primitive is faithful

It proves **that fixture cannot see the difference.**

The wrap bug above shipped through a zero-differing-pixel PNG match. The lorem text in
the fixture is left-aligned, so the extra trailing space painted as background —
invisible against the padding. Under centre or right alignment it would have been
obvious on sight.

So when a content primitive changes, the question is never "did the gates pass." It is
**"what would this fixture be physically incapable of showing me?"** Trailing
whitespace hides under left alignment. Colour errors hide when the colour has a close
ANSI neighbour. Off-by-one width hides at the edge of a region nothing paints. Find the
blind spot, then add the fixture that removes it.

Passing is evidence, not proof. Treat a green run on a primitive change as "no
contradiction found," and go looking for where the contradiction would be visible.

---

## The four gates

All four, in order, none skipped. Do not run Gate 4 over code failing 1–3.

```bash
npm run build          # 1. tsc
npm run lint           # 2. tsc --noEmit + two architectural scanners
npm test               # 3. vitest run
bash visual-tests/run.sh   # 4. real xterm PNGs vs committed Python baselines (npm run visual)
```

**Gate 2 is two things.** Beyond `tsc --noEmit` it runs
`scripts/check-framework-imports.ts` and `scripts/check-widget-source-rules.ts`. Those
scripts exist because `[LAW:]` comments do not fail CI and scripts do:

- `check-framework-imports` keeps `AppRuntime` / `AppRuntimeOptions` imported only
  inside `src/framework/**` and `src/app/**`. Other symbols from `_app-runtime.js` are
  fine; the framework class itself is App's private collaborator.
- `check-widget-source-rules` makes widgets paint by handing a `Content` to
  `renderContent`. Ink's `<Text>` resolves colour depth through chalk, and inside the
  visual-test xterm chalk settles at level 1 and quantises to the 16-colour palette —
  `#0178D4` silently arrives as `#0000EE`. The rule forbids *naming* `Text` at all
  rather than forbidding a `color` prop, so no `>` inside an attribute can slip past
  the scan.

**Gate 4 on this machine.** `run.sh` line 24 checks for exactly three tools:

```bash
for tool in tsx docker magick; do
```

`tsx`, `docker`, `magick`. Not `uv` — Gate 4 never invokes it.
`render-fixture-xvfb.sh` *is* in the call path (`render_pngs.ts:72` runs it inside the
container), but its `js` branch drives `tsx runner_js.tsx`. `uv` belongs to baseline
regeneration.

**There is no Docker on this machine.** Podman is installed and its VM runs, but
`run.sh` hardcodes the name `docker`. Two things are needed, not one — the shim, and
an empty registry config:

```bash
mkdir -p /tmp/shimbin && printf '#!/usr/bin/env bash\nexec podman "$@"\n' > /tmp/shimbin/docker && chmod +x /tmp/shimbin/docker
mkdir -p /tmp/emptydockercfg && printf '{}' > /tmp/emptydockercfg/config.json
DOCKER_CONFIG=/tmp/emptydockercfg PATH=/tmp/shimbin:$PATH bash visual-tests/run.sh <fixture>
```

`DOCKER_CONFIG` is not optional here. `~/.docker/config.json` on this machine declares
gcloud credential helpers; podman honours them, tries to authenticate against a
registry it has no business talking to, and dies with an **SSL certificate error**.
That error reads exactly like a network or TLS problem and is neither — it is the
credential helper. Pointing `DOCKER_CONFIG` at an empty config removes the helper from
podman's view without touching the real file, which docker/gcloud still own.

Scoped to the command. Do **not** install a `docker` shim onto the global PATH, into
`/usr/local/bin`, or into shell rc files — that is a machine-wide alias for a
container runtime, invisible to every later session, made to satisfy one script.
Ticket `textual-visual-tests-xf3` tracks teaching `run.sh` to accept either runtime;
until it lands, the shim goes on the command line.

**One capture environment, one file.** `visual-tests/capture-env` is a *file* of env
directives — `KEY=VALUE` per line, or `-KEY` to remove one — not a directory. It
exists because the PNG path and the cell-record path once disagreed:
`progress_indeterminate` showed an unhighlighted rail in its cell record and a full bar
in its PNG, because one path disabled Textual's animations and the other did not. Every
capture path applies it whole. A per-path subset is how the two drift apart again.

---

## The fast loop

The container PNG round trip is the confirmation, not the iteration:

```bash
npx tsx visual-tests/capture_js.ts <fixture>   # -> snapshots/js/<name>.txt, .ansi, .json
diff visual-tests/snapshots/js/<name>.txt visual-tests/snapshots/python/<name>.txt
```

Converge with `capture_js.ts`. Confirm once with `run.sh`.

---

## Baselines: read the bytes before you theorise

Each fixture has three committed representations of **one** frame under
`visual-tests/snapshots/python/`:

| | |
|---|---|
| `<name>.png` | what Gate 4 measures |
| `<name>.ansi` | the exact bytes Textual emitted — every SGR, every glyph |
| `<name>.txt` | their plain text |

When a diff appears, read these *first*. They are cheap ground truth and they disprove
whole classes of speculation in seconds:

```bash
# Which colours does the baseline actually use?
grep -oE $'\033\[[0-9;]*m' visual-tests/snapshots/python/footer_with_bindings.ansi | sort -u

# What is on the bottom row?
tail -n 1 visual-tests/snapshots/python/footer_with_bindings.txt
```

The failure mode this replaces: a diff appears and the investigation opens with a
theory about xterm truecolour, or terminfo, or Ink's colour emission — three paragraphs
of plausible pipeline reasoning over a missing constant in a widget source file. The
bytes are right there. Read them, then theorise.

`visual-tests/styled-grid.ts` exports `parseAnsiToStyledGrid` when a per-cell structure
is genuinely easier than the bytes. Derive it from the committed `.ansi`; never store a
second copy. A stored grid is a baseline that can disagree with the one Gate 4
measures.

Regenerate the three **together**: `bash visual-tests/update-python-baselines.sh
[fixture]` (`npm run visual:update-python`). Never refresh one alone — a `.png` newer
than its `.ansi` is two frames wearing one name.

---

## Ink is not a compositor

Five traps, each of which type-checks, renders, and is wrong:

- **`backgroundColor` belongs to `<Text>`, not `<Box>`.** A widget's background exists
  only where the widget emits a glyph. Anything Textual draws as a filled block must
  emit its *whole region* as content via `alignContentInBox` /
  `alignContentInPaddedBox` in `src/content/align.ts`. CSS `align` + `padding` will
  position the text correctly and leave the surrounding cells transparent.
- **`"1fr"` resolves to ONE CELL here.** `scalarToInkValue` defaults `fractionBasis = 1`
  (`src/styles/scalar.ts:164`), so `1 * 1 = 1`. Write `width: 100%`.
- **A widget's DEFAULT_CSS cannot style its children.** `resolveStylesForWidget`
  (`src/styles/stylesheet.ts:2008`) builds a widget's cascade from *its own type's*
  default stylesheets plus the screen's user CSS. Textual puts every mounted class's
  `DEFAULT_CSS` into one app stylesheet, so upstream's `Welcome #text { margin: 0 1 }`
  reaches the child Static; written here it parses, registers, matches nothing, and
  reports no error. Composed widgets pass geometry to their children through the
  render body, or through a class the child's own DEFAULT_CSS publishes — Button's
  `-full-width` is the port's spelling of `Welcome #close { width: 100% }`. Ticket
  `textual-style-cascade-apr`.
- **A `%` width reaches Ink as a string, not a number.** `makeScalarSpec`
  (`stylesheet.ts:1352`) parses but never normalizes, so `width: 100%` arrives as
  `"100%"` — which is right, because Ink then resolves it against the parent — but any
  widget reading `styles.box.width` as a number gets `undefined` and silently falls back.
  That is how a full-width Button painted its 16-cell `min-width` inside an 80-cell box.
  Read the measured region instead, *unless* the width is `auto`: an auto widget's box
  hugs the content, so its measurement is downstream of its own paint, and before
  `lifecycleReady` the unstyled scope stretches to the container and hands back a
  measurement that locks the widget at full width.
- **`Content.fromText` parses markup; `new Content` does not.** Choose on what the
  string *is*, never on the word "label". A caller's opaque text takes `new Content` —
  a Placeholder reading `[draft]` otherwise loses seven visible characters to an unknown
  tag (`src/widgets/placeholder.ts:191`). A prop documented to accept markup takes
  `fromText`: Button (`button.ts:21`) and ToggleButton (`toggle.ts:23`) do, and the
  `button_markup` fixture pair holds them to it. "Simplifying" those to `new Content`
  breaks a tested behaviour.

---

## Fixture parity is scope, not backlog

Every widget ships paired `visual-tests/fixtures/<name>.py` **and** `<name>.tsx` for
every on-screen behaviour in its spec-tests file. A `.py` with no `.tsx` is a gap in
work already claimed done — not a future task. This applies retroactively; stage
completion is gated on it; backfilling is in-scope.

The count today is 120 `.py` against 56 `.tsx`, so you will meet this. And when you do,
the reasonable voice arrives: *"that gap predates my ticket — I'll file it and move
on."* Refuse it. YAGNI is right about speculative features and says nothing here: this
is not a feature nobody asked for, it is the verification for a widget already shipped
and already declared complete. Filing it converts a known hole into a backlog item
nobody prioritises, and the stage stays green over it. Write the `.tsx`.

---

## Layout

| Path | |
|---|---|
| `src/` | `app` `bindings` `commands` `content` `events` `framework` `geometry` `services` `styles` `suggestions` `testing` `validation` `widgets` |
| `src/widgets/README.md` | the widget component pattern |
| `tests/` | Vitest |
| `visual-tests/` | the comparison harness; fixtures, snapshots, capture scripts |
| `spec/impl/` | `IMPLEMENTATION_ORDER.md`, `PROMPT.md`, `INDEX.md`, `phase-01-foundation.md` … `phase-07-animation-conformance.md` |
| `spec/spec-src/` | behavioural specifications |
| `spec/spec-tests/` | test case specifications |
