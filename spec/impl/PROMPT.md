# textual-js Phase Implementation Prompt

Use this prompt to launch a fresh agent on any phase. Replace `{NN}` with the phase number (01–07).

---

## Prompt

```
You are implementing Phase {NN} of the textual-js project — a terminal UI application framework built as a React component library on Ink, ported from Python's Textual.

## Your instructions

1. Read `spec/impl/phase-{NN}-*.md` — this is your phase file. It contains everything you need: preconditions, goal, scope, spec references, exit criteria. Follow it precisely.

2. Read `spec/impl/INDEX.md` — this is the project overview. It has the architectural principles, enforcement boundaries, and conformance tracker. Understand where your phase fits.

3. Read the spec references listed in your phase file (under "Spec References"). These are the behavioral specifications your implementation must satisfy. The spec-tests files (`spec/spec-tests/*.md`) are your primary source of test cases.

4. Read the source files listed in your phase file (under "Current State"). Understand what exists before you change anything.

5. Implement the scope described in your phase file. Write code and tests.

6. Verify every exit criterion in your phase file. Each one is machine-verifiable — run the check, don't assume it passes.

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
- WRONG: A widget stores `_width` as a field AND reads width from `RenderStyles`. Two sources, will diverge.
  RIGHT: `RenderStyles` owns width. The widget reads it from there. One source.
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
  RIGHT: The CSS engine produces `RenderStyles`. The reactive system on the widget detects the change and triggers refresh. No upward call from CSS to widget.
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

## How to work

- **Read before you write.** Understand the existing code, the spec, and the phase file before producing any implementation.

- **Tests are first-class deliverables.** Every behavior you implement gets a test. Use the spec-tests files as your test case source.

- **Keep it simple.** Don't add features, abstractions, or error handling beyond what the phase file asks for. Don't refactor surrounding code. Don't add comments to code you didn't write. Three similar lines of code is better than a premature abstraction.

- **Backward compatibility within the phase plan.** All prior phase tests must still pass when you're done. Run `npm test` and verify.

## Verification checklist (run before declaring done)

1. `npm run build` passes
2. `npm run lint` passes
3. `npm test` passes — all suites, including prior phases
4. Every exit criterion in your phase file is satisfied
5. Update the conformance tracker in `spec/impl/INDEX.md` for any spec-tests files you covered

## Key directories

- `src/` — implementation source
- `spec/impl/` — phase plan files (your instructions)
- `spec/spec-src/` — behavioral specifications (numbered 00–14)
- `spec/spec-tests/` — test case specifications (your test backlog)
```
