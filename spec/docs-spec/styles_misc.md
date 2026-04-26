# Docs Spec: Miscellaneous Styles Index (Routing)

## Purpose
Describes a routing/index docs page that points readers to the canonical style pages for topics historically grouped together (`background`, `tint`, `hatch`, `keyline`, `overflow`, `pointer`). Not a contract page; it exists to avoid duplication and to guide navigation.

## Audience
Readers browsing the style reference who land on the "misc" topic and need to be directed to the authoritative page for each property family.

## Required sections
1. Purpose (why this page exists and what it does NOT contain)
2. Canonical spec table (topic -> canonical docs page)
3. Resolution rule (when in doubt, use the canonical page; do not duplicate contract text here)

## Key concepts
- This page is intentionally thin: it avoids restating property contracts so that each property family has exactly one authoritative documentation page.
- Topics redirected from this index:
  - `background`, `background-tint`, `tint`, `hatch` -> background/tint docs page
  - `keyline` -> keyline docs page
  - `overflow`, `overflow-x`, `overflow-y`, `scrollbar-gutter`, `scrollbar-size`, `scrollbar-visibility` -> overflow docs page
  - `pointer` -> pointer docs page

## Behaviors and contracts
- The index must not restate contracts or examples for any linked topic; all behavior belongs on the canonical page.
- Future additions of new "misc" style topics should either get their own canonical page and be added to this index, or fold into an existing canonical page.

## Example requirements
- No code examples. This is a navigational index only.
- A short TCSS one-liner per topic showing the property name, ONLY as a breadcrumb/teaser, with the rest deferred to the canonical page.

## Cross-references
- `spec/docs-spec/styles_keyline.md`
- `spec/docs-spec/styles_overflow.md`
- `spec/docs-spec/styles_pointer.md`
- Background/tint/hatch canonical docs spec (to be added if not already present at `spec/docs-spec/styles_background_tint.md`).

## Notes for writers
- Keep this page short. The one-source-of-truth law applies: do not duplicate behavior contracts here.
- If the table grows, consider whether this routing page is still useful or whether topics should be subsumed into a larger style reference.
- Applicability to textual-js: fully applicable. The index is a navigational aid and maps directly regardless of underlying language runtime. No Python-specific content to strip.
