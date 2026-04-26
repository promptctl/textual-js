# Integration notes for spec-src/06-input-bindings-actions-and-commands.md

## Critical context

- **Rich-js role**: Binding `description` and command palette result display use rich-js `Content` for styled output. uFuzzy match ranges become highlighted `Segment`s in `Content`.
- **Terminal-UI reality**: Command palette results need styled match-highlighting; Footer renders binding descriptions as styled content.

## Gaps to fix

### 1. Binding description type

**Where**: `Binding` interface.
**Current state**: `description?: string`.
**Why insufficient**: Footer renders descriptions with styling (key in one style, description in another). Descriptions should allow markup for per-binding styling (e.g., highlighting danger actions).
**Required change**: Change `description?: string` to `description?: string | Content`. Plain strings render with ambient Footer style; markup strings are parsed via rich-js; `Content` is used directly. Same for `tooltip?`.

### 2. Command palette Hit.matchDisplay

**Where**: `Hit` interface in "Provider contract".
**Current state**: `matchDisplay: string; // Display text with highlight markup`.
**Why insufficient**: "Highlight markup" is vague. uFuzzy returns `{ ranges: number[][] }` (arrays of [start, end] ranges per haystack item). The framework converts these into rich-js `Content` with a component class (`command-palette--hit-match`) applied to each highlighted range.
**Required change**: Change `matchDisplay: string` to `matchDisplay: Content`. Add note: "Providers may return plain `Content` (no highlights) or `Content` with match segments tagged via the `command-palette--hit-match` component class. Hit highlights are typically produced by the framework from uFuzzy's match ranges during search; providers producing hits without uFuzzy may tag ranges manually."

### 3. uFuzzy → rich-js Content conversion

**Where**: "Runtime behavior" subsection, after the uFuzzy mention.
**Current state**: "Fuzzy matching uses uFuzzy: the query is matched against command names, and highlight ranges from uFuzzy are used to render matched characters in the result display."
**Why insufficient**: Doesn't specify the conversion mechanism.
**Required change**: Expand: "uFuzzy returns match ranges as `[start, end]` pairs per command. The framework converts each command's (name, ranges) pair to a rich-js `Content` by splitting the name into segments: characters inside a range get the `command-palette--hit-match` component class applied; characters outside use the ambient style. The resulting `Content` is stored as the `Hit.matchDisplay`. The component class resolves to a rich-js `Style` via the TCSS cascade (bold by default, themeable)."

### 4. SystemCommand and DiscoveryHit display types

**Where**: `SystemCommand` interface and `DiscoveryHit` interface.
**Current state**: `name: string`, `helpText: string`, `display: string`.
**Why insufficient**: Should allow markup.
**Required change**: Change `name`, `helpText`, `display` types to `string | Content`. Strings without markup syntax render as plain text; markup strings parse via rich-js.

### 5. "No matches found" entry display

**Where**: "No matches countdown" subsection.
**Current state**: "a disabled 'No matches found' entry is appended".
**Why insufficient**: The entry needs styling (dimmed / italic / themed).
**Required change**: Add: "The entry's display is a rich-js `Content` using a component class (e.g., `command-palette--no-matches`) that TCSS can target for dim/italic styling. The entry has no `command` callback."

## Do not change

- Binding interface fields other than `description`/`tooltip` (key, action, show, priority, system, id, group)
- `makeBindings` expansion rules
- BindingsMap methods
- Binding chain and Phase 0 / Phase 1 / Phase 2 dispatch
- Keymap overrides and clash handling
- Action parsing and dispatch (parseAction, runAction, dispatchAction, SkipAction)
- Key normalization and aliases
- Widget-level key handler dispatch (`key_<name>`)
- Built-in app actions table
- Input event routing summary
- Provider, Hit.score/command/helpText fields (only matchDisplay type needs updating)
- Runtime behavior beyond the uFuzzy conversion detail
- `runOnSelect`, `noMatchesTimeout` palette options
