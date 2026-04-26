# textual-js

Terminal UI application framework built as a React component library on Ink. Ported from Python's [Textual](https://github.com/Textualize/textual).

Widgets are React function components wrapped in MobX `observer()`. Styling uses TCSS (a CSS-like DSL parsed by css-tree) that resolves to Ink props. Layout is handled by Ink (Yoga flexbox). Terminal I/O is handled by Ink.

## Status

Groundwork in place. Implementation has not started.

- Dependencies declared (`package.json`).
- TypeScript + JSX configured (`tsconfig.json`).
- Spec set complete under `spec/`.
- `src/` contains geometry value types only — the rest is built in Phase 1 onward.

## For implementing agents

**Start here:** `spec/impl/PROMPT.md` and `spec/impl/INDEX.md`.

### Source of truth

| Location | Purpose |
|----------|---------|
| `spec/impl/` | Phase plan files (01 through 07) — the executable blueprint |
| `spec/impl/PROMPT.md` | Standard prompt for launching a fresh agent on any phase |
| `spec/impl/INDEX.md` | Phase map, architectural principles, conformance tracker |
| `spec/spec-src/` | Authoritative behavioral specifications (00–14 + 99) |
| `spec/spec-tests/` | Executable test backlog — spec-tests file per feature area |
| `spec/docs-spec/` | Specifications for user-facing documentation pages (to be written after implementation) |

### Architecture in one paragraph

The framework depends on: **React** (component model + reconciliation), **Ink** (terminal rendering + Yoga flexbox layout + stdin handling), **MobX** (reactive state + dependency tracking + `intercept`/`observe`/`computed`), **css-tree** (TCSS parsing + selector matching + specificity), **rich-js** (rich text markup, renderables like Bar/Gradient/StyledText, wide-character text measurement), **uFuzzy** (command palette fuzzy search), **marked** (markdown parsing), **Shiki** (syntax highlighting in TextArea). Everything else — the widget catalog, screen stack, focus manager, binding/action system, command palette, workers, signals, notifications, themes, text editing — is built on top of those.

## Phases

| Phase | Title | File |
|-------|-------|------|
| 1 | React/Ink + MobX Foundation | `spec/impl/phase-01-foundation.md` |
| 2 | TCSS Engine & Query API | `spec/impl/phase-02-tcss-and-query.md` |
| 3 | Focus, Screens, Bindings & Actions | `spec/impl/phase-03-focus-screens-bindings.md` |
| 4 | Workers, Signals, Notifications, Themes & Commands | `spec/impl/phase-04-app-services.md` |
| 5 | Core Widget Catalog | `spec/impl/phase-05-core-widgets.md` |
| 6 | Advanced Widgets & Text Editing | `spec/impl/phase-06-advanced-widgets.md` |
| 7 | Animation & Conformance Closure | `spec/impl/phase-07-animation-conformance.md` |

Phases execute serially. Each has preconditions, scope, spec references, and machine-verifiable exit criteria.

## Scripts

```bash
npm install                    # Install dependencies
npm run build                  # Compile TypeScript to dist/
npm run lint                   # Type-check (no emit)
npm test                       # Run Vitest suites
npm run test:watch             # Run Vitest in watch mode
npm run clean                  # Remove dist/
bash visual-tests/run.sh       # Visual comparison: textual-js vs committed Python baselines
npm run visual:update-python   # Regenerate committed Python visual baselines
```

### Visual comparison harness

`visual-tests/run.sh` captures textual-js screenshots for paired widget fixtures in an isolated Docker/Xvfb terminal, then diffs those PNGs against committed Python baseline PNGs. Requires `tsx`, Docker, and ImageMagick's `magick` CLI on PATH. Python baselines are intentionally regenerated only via `npm run visual:update-python`, which uses `uv` to run Python Textual. See `visual-tests/README.md` for details.

```bash
bash visual-tests/run.sh              # All fixtures
bash visual-tests/run.sh static_basic # Single fixture
```

## License

MIT
