# textual-js Phase Implementation Prompt

When this file is loaded into an agent's context, the agent must execute the instructions below directly. The agent's first action after reading this file must be to run the first command in Step 0.1. Everything that follows is for the agent.

---

## Begin work

This project is textual-js — a terminal UI application framework built as a React component library on Ink, ported from Python's Textual. You are going to identify the next incomplete phase and implement it.

Do not respond with a summary of this prompt. Do not generate "insight" commentary about the prompt's design. Do not ask the user which phase to work on. Do not ask any clarifying questions. Step 0 will give you all the information you need to identify the right phase yourself, and the steps after that will tell you what to do.

Your first action is to run the command in Step 0.1. Begin now.

## STEP 0 — Inventory the codebase

You have no context about this project. Do not assume you do. Execute the steps below in order. Do not write any code and do not begin planning until every step is complete.

Each step has the form: run a specific command, then read specific files. Use the Bash tool for the commands. Use the Read tool for the files. Read each file in full — do not pass an `offset` or `limit` parameter. Do not summarize files in your head as you go; just read them. Comprehension comes from having read everything, not from compressing each file into a sentence.

When you run a command, read its full output. If the output is truncated by the tool, re-run in a way that produces complete output — write to a file and read it, paginate, or narrow the query. Do not proceed on partial output.

If a command fails, stop and report it. Do not switch to a different tool to work around the failure. The procedure depends on these specific commands working: if `find src ...` fails because of a hook, environment, or permissions error, the correct response is to tell the user what failed and what needs fixing, not to substitute Glob and continue. A failed command and an empty result are different — check exit codes and stderr before assuming a command "returned nothing."

### Step 0.1 — Check for uncommitted work

Run: `git status`

Read the full output. If there are modified files (`M`), staged changes, or untracked files under `src/` or `tests/`, this is evidence of in-progress or completed-but-never-committed work from a prior session. Do not ignore it. Before starting any new work:

1. Read each modified or untracked source/test file to understand what it contains.
2. Run `npm run build`, `npm run lint`, and `npm test` to see whether the uncommitted work is in a passing state.
3. If it passes: commit it with a descriptive message before proceeding. These are deliverables, not drafts — treat them as your responsibility.
4. If it fails: investigate and fix the failures, then commit. Do not start new work on top of a broken uncommitted state.

Only proceed to Step 0.2 once the working tree is clean (no uncommitted changes under `src/` or `tests/`).

### Step 0.2 — Read the source

Run: `find src -type f \( -name "*.ts" -o -name "*.tsx" \) | sort`

The output is a list of file paths. Read every path in that list with the Read tool. If the list has 30 paths, you make 30 Read calls. Do not skip any path. Do not assume you can guess what an `index.ts` contains.

### Step 0.3 — Read the tests

Run: `find tests -type f \( -name "*.ts" -o -name "*.tsx" \) | sort`

Read every path in the output with the Read tool. Tests are the authoritative description of what behavior is currently guaranteed. A behavior with no test is not guaranteed, regardless of what any document says.

### Step 0.4 — Read the project metadata

Use the Read tool on each of these files:
- `README.md`
- `AGENTS.md`
- `package.json`
- `tsconfig.json`

### Step 0.5 — Read the implementation plan

Run: `find spec/impl -type f -name "*.md" | sort`

Read every path in the output with the Read tool. This includes `INDEX.md`, `IMPLEMENTATION_ORDER.md`, `PROMPT.md` (this file you are already reading — read it again from the file, fully, to ensure you have the current version), and every `phase-*.md`.

`INDEX.md` contains a Conformance Tracker section. Read it for context only. Do not modify it. If anything in the tracker contradicts what you find in the code or tests, the code and tests are correct.

### Step 0.6 — Read the architectural specifications

Run: `find spec/spec-src -type f -name "*.md" | sort`

Read every path in the output with the Read tool. These define the behavior the project is targeting.

### Step 0.7 — Read the test backlog

Run: `find spec/spec-tests -type f -name "*.md" | sort`

Read every path in the output with the Read tool. These are the test cases organized by feature area.

### Step 0.8 — Verify the current build state

Run each of these commands. Read the full output of each:
- `npm run build`
- `npm run lint`
- `npm test`
- `bash visual-tests/run.sh`

If any of the first three fail, the codebase is in a broken state. Do not start new work on a broken codebase. Investigate the failures first.

The visual comparison (`visual-tests/run.sh`) captures screenshots from Python Textual and textual-js for the same widget layouts and diffs them. It requires `uv` and `tsx` on PATH. If either is missing, the script will fail immediately — do not work around this by skipping the step. Install the tools. Read the comparison output: MATCH means identical rendering, DIFF with only border/slider character differences is expected in early stages, DIFF where text content diverges is a real bug to investigate before proceeding.

### Step 0.9 — Confirm completion

Step 0 is complete when you have made every Read tool call and every Bash command call listed in steps 0.1 through 0.8. If at any point you proceeded without completing a step, stop now and complete the missing step before continuing.

## STEP 1 — Identify the next phase to implement

You now have full knowledge of the codebase from Step 0. Use it to determine which phase to work on.

### Step 1.1 — Determine the active stage

The authoritative execution order is in `spec/impl/IMPLEMENTATION_ORDER.md`, which defines stages 0 through 11. Each stage lists the spec-tests files it must produce passing tests for, along with explicit behavioral requirements for any spec-tests file that is shared across stages.

Walk the stages in numeric order, starting from Stage 0. For each stage:

1. Look at the spec-tests files listed for that stage. Where a stage lists specific behavioral requirements (sections, bullets, or descriptions) from a shared spec-tests file, only those requirements apply to that stage — not the entire file.

2. For each spec-tests file (or subset of requirements), **read the spec-tests file** and identify the individual behaviors it describes.

3. For each behavior, check whether a test in `tests/` actually exercises that behavior — not just whether a file with a similar name exists. A test file with 3 tests for a spec-tests file describing 30 behaviors does not satisfy the stage.

4. A stage is complete only when **every behavior** required by that stage has a corresponding passing test. File existence is necessary but not sufficient.

5. If any required behavior lacks a test, that stage is the active stage. Stop walking.

The first stage with missing behavioral coverage is the active stage. Do not skip ahead to a later stage even if it looks easier.

### Step 1.2 — Map the active stage to a phase file

`spec/impl/IMPLEMENTATION_ORDER.md` has a section near the bottom titled "Suggested Mapping Back To The Existing Phase Files." Use that mapping to identify which `phase-NN-*.md` file covers the active stage. There may be more than one stage per phase file; you are working on one stage at a time, not the whole phase.

### Step 1.3 — Read the phase file

Read the `phase-NN-*.md` file identified in step 1.2 in full. Use it as the source of scope, spec references, and exit criteria for the active stage. If the phase file describes work from later stages too, ignore that work — you are implementing only the active stage.

When IMPLEMENTATION_ORDER.md and the phase file disagree on scope, IMPLEMENTATION_ORDER.md wins for which spec-tests behaviors belong to which stage. The phase file wins for architectural guidance and implementation patterns.

### Step 1.4 — Read the spec references

Read every `spec/spec-src/*.md` file referenced by the phase file or by the stage entry in `IMPLEMENTATION_ORDER.md` that you have not already read in step 0.6. These define the behavioral contracts your implementation must satisfy.

Read every `spec/spec-tests/*.md` file listed for the active stage that you have not already read in step 0.7. These are your test case sources.

## STEP 2 — Implement the active stage

1. Write code and tests for the active stage only. Do not pull work from later stages forward.

2. Tests are first-class deliverables. Every behavior you implement gets a test. Use the spec-tests files as your test case source. For each behavior described in the spec-tests file, write a test that exercises it. Do not write a test file that covers only the easy cases and declares victory.

3. Keep it simple. Do not add features, abstractions, or error handling beyond what the phase file asks for. Do not refactor surrounding code. Do not add comments to code you did not write.

4. All prior phase tests must still pass when you are done. Run `npm test` and verify.

5. Verify every exit criterion in the phase file that corresponds to the active stage. Each one is machine-verifiable — run the check, do not assume it passes.

## Architectural Laws

These laws are unconditional. Every decision you make must be consistent with them. When a law influences a decision, cite it in a comment: `// [LAW:<token>] reason`. When you must violate one, mark it: `// [LAW:<token>] exception: reason`.

### DATAFLOW, NOT CONTROL FLOW

Software structure mirrors data flow, not control flow. The same operations execute in the same order every invocation — variability lives in the values (nulls, empty collections, discriminated unions), never in whether operations execute. Side effects are unconditional; vary their behavior by varying their inputs, not by guarding their execution.

When you reach for an `if` that skips an operation, you're encoding variability in control flow — restructure so the operation always runs and the data decides what happens. This is the most commonly violated law because every language defaults to control flow. Fight the default.

Examples:
- WRONG: `if (options.repaint) { this.refresh(); }` — skips the operation based on a flag.
  RIGHT: `this.refresh({ repaint: options.repaint });` — always calls refresh, the data controls what happens inside.
- WRONG: `if (validator) { value = validator(value); }` — conditional validation.
  RIGHT: The validation step always runs. When no validator exists, the identity function is the validator. `value = this.validate(name, value);` where `validate` returns the value unchanged if no `validate_<name>` method exists.
- WRONG: `if (watchers.length > 0) { for (const w of watchers) { w(old, new); } }` — guards iteration.
  RIGHT: `for (const w of watchers) { w(old, new); }` — iterating an empty array is a no-op. The guard adds control flow that encodes "maybe there are watchers" when the data (empty array) already handles it.

### ONE SOURCE OF TRUTH

Every concept has exactly one authoritative representation. All others are derived and explicitly synchronized. If two representations can diverge, the architecture is broken. Never create a second source; find and use the canonical one.

Examples:
- WRONG: A widget stores `_width` as a field AND reads width from `ResolvedStyles`. Two sources, will diverge.
  RIGHT: `ResolvedStyles` owns width. The widget reads it from there. One source.
- WRONG: Query results are cached in a separate data structure that is updated "whenever we remember to."
  RIGHT: Query caches key their invalidation on `NodeList._updates` — the single version counter for tree mutations.
- WRONG: A watcher list is maintained both on the reactive descriptor and on the host instance.
  RIGHT: One list, one location. Everything else is a reference to it.

### SINGLE ENFORCER

Any cross-cutting invariant (auth, validation, timing, serialization) is enforced at exactly one boundary. Duplicate checks across callsites will drift. If enforcement exists elsewhere, remove the duplicate — don't add another.

Examples:
- WRONG: Each widget validates its own `display` property change. The stylesheet also validates it. Two enforcers.
  RIGHT: The stylesheet is the single enforcer of style resolution. `display` is style-backed. One boundary.
- WRONG: Both `Widget.mount()` and `App.pushScreen()` check for duplicate IDs.
  RIGHT: `NodeList._append()` is the single enforcer of the no-duplicate-ID invariant. It throws on duplicates. Nobody else checks.
- WRONG: Refresh scheduling happens in both the reactive setter and in class mutation methods.
  RIGHT: Reactive setters are the single enforcer of refresh scheduling. Class mutation triggers a reactive property change, which triggers refresh through the one path.

### ONE-WAY DEPENDENCIES

Architecture declares dependency direction. Cycles are forbidden. Upward calls are forbidden.

Examples:
- WRONG: `MessagePump` imports from `Widget` to check if the receiver is focusable.
  RIGHT: `MessagePump` knows nothing about widgets. `Widget` extends `MessagePump`. Dependency flows downward.
- WRONG: The CSS engine calls `widget.refresh()` directly after applying styles.
  RIGHT: The CSS engine produces `ResolvedStyles`. The reactive system on the widget detects the change and triggers refresh. No upward call from CSS to widget.
- WRONG: A layout strategy imports `App` to read the screen size.
  RIGHT: The layout strategy receives `size` as a parameter. It depends on geometry, not on App.

### ONE TYPE PER BEHAVIOR

If multiple things have identical behavior, they are instances of one type, not multiple types. Before creating FooA, FooB, FooC, ask: "What differs besides the name?" If the answer is "nothing" or "only configuration," create one Foo with instances/config.

Examples:
- WRONG: `VerticalScrollbar` and `HorizontalScrollbar` are separate classes with duplicated scroll logic.
  RIGHT: One `Scrollbar` class parameterized by orientation.
- WRONG: Each built-in widget reimplements disabled-state event suppression.
  RIGHT: Disabled-state gating is implemented once in the Widget base class. All widgets inherit it.
- WRONG: `Button.Pressed`, `Switch.Changed`, `Checkbox.Changed` each implement their own `canReplace` and `bubble` logic.
  RIGHT: They inherit from `Message`, which owns `canReplace` and `bubble`. They only declare their unique payload.

### GOALS MUST BE MACHINE-VERIFIABLE

Any goal you plan must have well-defined, concrete criteria by which a deterministic process can gauge success or failure. Every exit criterion in your phase file is testable — run the tests, check the output. Do not declare a phase complete based on "it looks right." Run `npm test`, `npm run build`, `npm run lint`. Check every exit criterion.

Examples:
- WRONG: "The reactive system works correctly." — not verifiable.
  RIGHT: "A test demonstrates: setting a reactive property → validator transforms value → watcher fires with transformed value → computed dependent updates." — run the test, it passes or fails.
- WRONG: "Bindings feel responsive." — subjective.
  RIGHT: "Binding resolution tests: focused widget bindings override screen bindings override app bindings." — deterministic.
- WRONG: "I've finished the CSS engine, test it and let me know." — offloads verification.
  RIGHT: "CSS parsing round-trips: parse TCSS source → AST → serialize back, verify equivalence. Test passes." — machine-checked.

### NO DEFENSIVE NULL GUARDS

Null checks are only valid at trust boundaries (external input, user data, network responses) or when a value explicitly represents optionality. If a value should never be null, the fix is making it not null — not adding a guard that silently skips the operation.

Examples:
- WRONG: `if (this._layout) { return this._layout.arrange(...); }` — `_layout` should never be null. If it is, that's a bug to fix, not to guard.
  RIGHT: `return this._layout.arrange(...);` — `_layout` is initialized in the constructor. It is always present.
- WRONG: `if (parent && parent.children) { parent.children._remove(this); }` — doubly defensive.
  RIGHT: `parent.children._remove(this);` — if `parent` exists, it has `children`. If `parent` doesn't exist, the caller shouldn't be calling remove.
- OK: `if (node.id !== undefined) { this._ids.set(node.id, node); }` — `id` is genuinely optional. This is data-driven branching, not a defensive guard.

### TESTS ASSERT BEHAVIOR, NOT STRUCTURE

Tests define *what* (contracts), never *how* (implementation). A test that can only pass by preserving deprecated code is encoding structure — update or delete it, never satisfy it by reintroducing removed code.

Examples:
- WRONG: `expect(widget['_reactiveStore'].get('count').value).toBe(5)` — tests internal storage structure.
  RIGHT: `expect(widget.count).toBe(5)` — tests the public behavioral contract.
- WRONG: `expect(spy).toHaveBeenCalledTimes(1)` on an internal method to verify refresh happened.
  RIGHT: Verify the observable outcome of refresh — the layout changed, the render output updated.
- WRONG: A test that imports and asserts on internal types that aren't part of the public API.
  RIGHT: A test that uses the public API and asserts on observable behavior.

## STEP 3 — Verify before declaring done

Run each of these and confirm the result before reporting completion:

1. `npm run build` — must pass.
2. `npm run lint` — must pass.
3. `npm test` — must pass. All suites, including those from prior stages.
4. `bash visual-tests/run.sh` — must run to completion. Read the comparison output. Any fixture where text content diverges (not just border characters) is a bug to fix before declaring done.
5. Walk through every exit criterion in the phase file that corresponds to the active stage. For each one, run the specific check the criterion describes. Do not declare a criterion satisfied unless you have run its check and seen it pass.
6. Retroactive check: re-verify that every behavior required by the active stage's spec-tests files has a passing test. If you find a gap you missed during implementation, fill it now.
7. If the active stage introduced new widget components, verify that each has a paired visual fixture in `visual-tests/fixtures/` (a `.py` and a `.tsx` file rendering the same layout). Missing fixtures are a gap — create them before declaring the stage complete.

## Files you must not modify

- `spec/impl/INDEX.md` — the conformance tracker is reference-only and agents do not maintain it.
- `README.md` — do not add a status section, progress badge, or "what's done" summary.
- Any file matching `*STATUS*.md`, `*PROGRESS*.md`, `*COMPLETE*.md`, `*CHANGELOG*.md`.

The authoritative ledger of what exists in this project is: the code under `src/` and the tests under `tests/`. A git log is not a source of truth — it only proves that a particular commit message was authored, never that the work it describes is correct, complete, or still present. Tracking documents accumulate drift and substitute for reading the actual code. Do not produce them.

## Key directories

- `src/` — implementation source
- `tests/` — unit and integration tests (Vitest)
- `visual-tests/` — cross-implementation visual comparison harness
- `visual-tests/fixtures/` — paired Python + JS fixture files
- `spec/impl/` — phase plan files (your instructions)
- `spec/spec-src/` — behavioral specifications (numbered 00–14)
- `spec/spec-tests/` — test case specifications (your test backlog)
