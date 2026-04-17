# AGENTS

## Verification Gates

Every change must pass all four gates before being committed. No gate may be skipped or silently worked around.

```bash
npm run build                  # Gate 1: TypeScript compilation
npm run lint                   # Gate 2: Type-check (--noEmit)
npm test                       # Gate 3: All Vitest suites pass
bash visual-tests/run.sh       # Gate 4: Visual comparison vs Python Textual
```

Gate 4 requires `uv` and `tsx` on PATH. If missing, the script fails immediately with an install link. Do not bypass this by skipping the gate — install the tools.

**New widget components require paired visual fixtures.** When adding a widget component (`src/widgets/*-component.tsx`), also create `visual-tests/fixtures/<name>.py` (Python Textual) and `visual-tests/fixtures/<name>.tsx` (textual-js) rendering the same layout.

## Implementation Entry Point

For phase-by-phase implementation, start with `spec/impl/PROMPT.md`. It contains the complete procedure.

See `CLAUDE.md` for the full verification protocol and project conventions.

<!-- BEGIN LINKS INTEGRATION -->
## links Agent-Native Workflow

This repository is configured for agent-native issue tracking with `lit`.

Run `lit quickstart` to get instructions.

<!-- END LINKS INTEGRATION -->
