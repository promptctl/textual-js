# AGENTS

## Verification Gates

Every change must pass all four gates before being committed. No gate may be skipped or silently worked around.

```bash
npm run build                  # Gate 1: TypeScript compilation
npm run lint                   # Gate 2: Type-check (--noEmit)
npm test                       # Gate 3: All Vitest suites pass
bash visual-tests/run.sh       # Gate 4: Visual comparison vs Python Textual
```

Gate 4 requires `tsx`, Docker, and ImageMagick's `magick` CLI on PATH. It compares JS screenshots against committed Python PNG baselines and must not regenerate Python screenshots. To intentionally refresh the Python baselines, run `npm run visual:update-python`, review the PNG changes, and commit them.

**New widget components require paired visual fixtures.** When adding a widget component (`src/widgets/*-component.tsx`), also create `visual-tests/fixtures/<name>.py` (Python Textual) and `visual-tests/fixtures/<name>.tsx` (textual-js) rendering the same layout.

## Implementation Entry Point

For phase-by-phase implementation, start with `spec/impl/PROMPT.md`. It contains the complete procedure.

See `CLAUDE.md` for the full verification protocol and project conventions.

## Worktree Reporting

Do not mention unrelated tracked, untracked, or otherwise pre-existing worktree changes in status updates, summaries, commit messages, or final responses. Raise only direct blockers to the requested task itself, without discussing general worktree state.

<!-- BEGIN LINKS INTEGRATION -->
## links Agent-Native Workflow

This repository is configured for agent-native issue tracking with `lit`.

Run `lit quickstart` to get instructions.

<!-- END LINKS INTEGRATION -->
