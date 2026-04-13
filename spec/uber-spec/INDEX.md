# Textual Uber-Spec

Read these files as one spec set:

1. [runtime-and-lifecycle.md](./runtime-and-lifecycle.md)
2. [dom-reactivity-and-dispatch.md](./dom-reactivity-and-dispatch.md)
3. [styling-layout-and-rendering.md](./styling-layout-and-rendering.md)
4. [input-actions-and-commands.md](./input-actions-and-commands.md)
5. [widgets.md](./widgets.md)
6. [text-editing-and-supporting-subsystems.md](./text-editing-and-supporting-subsystems.md)

This spec set describes intended stable framework behavior at a high level.
It is not a transcript of internal implementation details, temporary bugs, or incidental omissions.

## Summary

Textual is an asyncio-driven TUI framework whose stable user-facing behavior is organized around:

- `App` as the runtime root
- `Screen` stacks and screen modes
- `Widget` trees and DOM-style query/identity
- queue-driven message and event dispatch
- CSS styling, layout, rendering, and compositor pipelines
- input, bindings, actions, workers, timers, signals, and command palette
- text editing, validation, suggestions, notifications, themes, and renderables
