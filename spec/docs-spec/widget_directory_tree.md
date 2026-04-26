# Docs Spec: DirectoryTree Widget

## Purpose
Document the `DirectoryTree` widget — a focusable tree view that displays a filesystem path and lets the user expand directories, select files, and filter entries — so readers can embed a file browser in a textual-js app and react to file/directory selection.

## Audience
App authors building file browsers, pickers, or project explorers; widget authors who may subclass or customize directory trees (icons, filtering).

## Required sections
1. Overview — what `DirectoryTree` is, its relationship to the generic `Tree` widget, and common use cases.
2. Importing and mounting — how to import and provide a root `path`.
3. Props / options — `path`, plus standard widget props.
4. Node data (`DirEntry`) — the shape attached to every tree node (`path`, `loaded`).
5. Reactive attributes — `path`, `showRoot`, `showGuides`, `guideDepth`, and what happens when `path` changes at runtime.
6. Messages / events — `FileSelected` and `DirectorySelected`, when each fires, and the distinction between selection and expansion.
7. Icons — the three customizable icon strings for expanded folders, collapsed folders, and files.
8. Filtering — overriding/providing a `filterPaths` function to hide entries (e.g., dotfiles).
9. Loading behavior — asynchronous loading via a background worker, load queue, and one-time-per-node loading.
10. Key methods — `reload`, `reloadNode`, `clearNode`, `resetNode`, `renderLabel`.
11. Sorting — directories first, then case-insensitive alphabetical.
12. Error handling — filesystem errors silently yield empty directories.
13. Styling / component classes — folder, file, extension, hidden, plus inherited tree classes.
14. Examples — basic usage, filtered dotfile-hiding subclass, handling selection events, runtime path change.

## Key concepts
- A tree rooted at a filesystem path whose children are discovered lazily.
- `DirEntry` is the typed payload attached to each node.
- Selection vs. expansion: `Enter`/click on a directory posts `DirectorySelected`; expanding loads children without posting selection.
- Filtering hook (`filterPaths`) runs inside the loader, so it can remove entries before they ever enter the tree.
- Reloading preserves expansion state and highlighted position where possible.
- Icon constants are customizable via subclassing or configuration.

## Behaviors and contracts
- Setting `path` at runtime resets the root node, reloads content, moves cursor to line 0, scrolls to top.
- Directory expansion queues a load; the loader worker runs exclusively and drains the queue sequentially.
- Each node is loaded only once (tracked by `DirEntry.loaded`); force refresh requires `reload` or `reloadNode`.
- Sort order within each directory: directories before files, then alphabetical by lowercased name.
- `NodeExpanded` on directory = load children (no selection event). `NodeExpanded` on file = `FileSelected`. `NodeSelected` on directory = `DirectorySelected`. `NodeSelected` on file = `FileSelected`.
- Filesystem errors (permission denied, missing paths) are caught silently; the affected directory appears empty.
- Loading is cancellable — a new `path` assignment orphans any in-flight loader.
- `FileSelected` / `DirectorySelected` both include `node`, `path`, and a `control` reference to the tree widget.

## Example requirements
All examples are JSX/TypeScript using Ink primitives.
- Basic: mount a `DirectoryTree` with a root path prop.
- Handling `FileSelected` via the framework's event dispatch (the `on` mechanism).
- A custom filtered tree that hides dotfiles — express this as a wrapper component or a `filterPaths` prop/override, not a Python subclass.
- Runtime `path` change via setting an observable state field.
- Customizing icons via a prop or subclass-equivalent pattern.

## Cross-references
- Related docs specs: `spec/docs-spec/widget_tree.md` (parent widget), `spec/docs-spec/widget_list_view.md`.
- Related behavioral specs: `spec/spec-src/07-workers-timers-and-signals.md` (background workers), `spec/spec-src/10-widget-catalog.md`, `spec/spec-src/03-message-event-and-dispatch.md`, `spec/spec-src/08-drivers-io-and-platform-behavior.md` (filesystem access).

## Notes for writers
- Do not document `pathlib.Path` / `Path.iterdir()` as user-facing APIs. In textual-js, paths are strings (or a platform-appropriate path type) and directory reading happens through the Node-compatible filesystem interface used by the driver.
- Do not describe `async def` workers; describe asynchronous loading as running in a worker (see workers spec) and returning awaitable promises.
- The override pattern for `filterPaths` should be described as providing a function (prop) or extending a component, not Python inheritance with `def filter_paths`.
- `AwaitComplete` / `AwaitMount` / `AwaitRemove` translate to `Promise` semantics — document as promises users can `await`.
- Do not mention Python exceptions (`OSError`, `WorkerFailed`, `WorkerCancelled`) by name; describe the behavior ("errors during directory read are treated as an empty directory").
- `PATH` class variable is a Python injection seam; for textual-js, document it as an optional override for path construction (useful for virtual filesystems in tests) without invoking Python class semantics.
