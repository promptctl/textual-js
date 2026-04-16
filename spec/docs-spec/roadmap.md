# Docs Spec: Roadmap

## Purpose
Describes the roadmap docs page that communicates forward-looking intent for textual-js features and widgets, distinguishing shipped behavior from planned work without making delivery commitments.

## Audience
Contributors, evaluators, and users deciding whether textual-js fits their use case. This page is for readers who want to see "where is this going" rather than "how does it behave today".

## Required sections
1. Scope statement — the roadmap is a planning artifact, not a behavioral runtime contract.
2. Status legend — how checked vs. unchecked items are interpreted.
3. Features roadmap — cross-cutting capabilities (accessibility, themes, command palette, devtools, configuration, etc.).
4. Widget roadmap — catalog of widgets and per-widget sub-features (variants, lazy loading, extended capabilities).
5. Usage guidance — how to read the page, where to find shipped-behavior specs instead.

## Key concepts
- Roadmap is intent tracking, not a promise of delivery.
- Shipped behavior is documented in guide/reference/API docs, not inferred from checked roadmap entries.
- Per-item nesting allows a widget to be "shipped" while specific sub-features remain planned.

## Behaviors and contracts
- The page must clearly state it does not constitute a commitment or ETA.
- The page must direct readers to guide/reference/API docs for authoritative "what works today" information.
- Checked status reflects current framework state; updates land alongside the work being marked complete.

## Example requirements
No code examples. This is a prose + checklist page. If any example is used, it must reference textual-js APIs (JSX/TypeScript with Ink primitives), never Python, and only to illustrate what a checked-off capability looks like in practice.

## Cross-references
- `spec/docs-spec/api_app.md` — shipped app surface.
- `spec/docs-spec/api_command.md` — command palette (shipped).
- Widget guide index — authoritative list of shipped widgets.
- Any `spec/docs-spec/widget_*` pages referenced under specific widget entries.

## Notes for writers
- Drop any items that are Python-runtime-specific and have no textual-js meaning (e.g., "Export to `attrs` / PyDantic" — replace with JS serialization targets only if they are actually planned; otherwise omit rather than translate).
- "Reactive state abstraction" is already implemented via MobX in textual-js; either mark accordingly or remove as obsolete before publishing.
- "Configuration (`.toml`)" should be re-evaluated for a JS ecosystem (likely JSON / JSONC / a config module) — do not copy the `.toml` wording verbatim without confirming intent.
- Do not mention Python class hierarchies, decorators, or asyncio under any roadmap entry.
- When in doubt about whether an entry still applies, leave it unchecked and flag for review rather than fabricating a translation.
