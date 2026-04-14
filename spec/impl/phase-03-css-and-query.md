# Phase 3: CSS Engine, Selectors & Query API

## Preconditions

Phases 1–2 complete:
- Test harness (`runTest()` + `Pilot`) exists and works
- Descriptor-backed reactive pipeline with validators, computed, init dispatch
- All prior tests pass

## Goal

Introduce the style system and DOM query API that the layout, widget, and input contracts all depend on.

## Architectural Rationale

// [LAW:single-enforcer] The stylesheet becomes the single enforcer of style resolution. Without it, widgets will accumulate hand-rolled style logic that drifts from the intended cascade.

// [LAW:one-source-of-truth] Selector parsing and matching have one implementation shared by CSS application and `query()`. No duplicate selector semantics.

// [LAW:one-way-deps] Styles flow downward: stylesheet → RenderStyles per node. Nodes never write back to the stylesheet.

## Current State (before this phase)

**`src/dom-node.ts`** has CSS identity infrastructure:
- `id`, `cssClasses` (Set<string>), `cssTypeName` (constructor name), `cssPath` (array from root to self)
- Class mutation: `addClass()`, `removeClass()`, `toggleClass()`, `hasClass()`
- `refresh()` seam with `repaint`/`layout` options
- No query methods exist

**`src/widget.ts`** has:
- `static DEFAULT_CSS = ""` — declared but unused (no CSS parser exists)
- `display` and `visible` as plain boolean fields — not style-backed
- No `RenderStyles` or computed style object

**`src/reactive.ts`** (Phase 2 output):
- Descriptor-backed reactive with validators and computed properties
- Style properties will be built on this system

**No CSS-related files exist** — no parser, no tokenizer, no selector matching, no stylesheet, no RenderStyles.

## Scope

### CSS Tokenizer and Parser

- Tokenize Textual CSS (TCSS) — a CSS subset with Textual extensions
- Parse into a stylesheet AST: rule sets with selectors and declaration blocks
- Support: type selectors, class selectors (`.class`), ID selectors (`#id`), pseudo-class selectors (`:pseudo`), combinators (descendant ` `, child `>`, sibling `~`, adjacent `+`)
- Support: property declarations with values, `!important`, CSS variables (`--var-name`), `initial` keyword

### Selector Matching

- Match a selector against a `DOMNode` using its `cssTypeName`, `cssClasses`, `id`, and `cssPath`
- Specificity calculation per CSS spec (ID > class > type)
- Combinator evaluation using the node's ancestor chain

### RenderStyles

- Per-widget computed style object
- Properties for: box model (`width`, `height`, `min-width`, `max-width`, `min-height`, `max-height`, `margin`, `padding`, `border`), colors, text style, layout hints (`dock`, `display`, `visibility`, `overflow`, `align`, `content-align`), and layout dimensions (`fr`, `%`, `auto`, fixed units)
- Built on the reactive system from Phase 2 — style property changes trigger refresh/layout

### Stylesheet Application

- Parse `DEFAULT_CSS` and `CSS` static class variables from Widget subclasses
- Apply cascade: specificity + rule origin (default < user < inline)
- Produce `RenderStyles` per node
- `initial` keyword: property-sensitive fallback to default-rule values or built-in defaults (not blanket class-default reset — per uber-divergence)
- Cache invalidation keyed on `NodeList._updates` and class mutations

### Style Split

- Each node has three style layers: base CSS (from `DEFAULT_CSS`), user CSS (from `CSS` and external stylesheets), inline styles (set programmatically)
- Merged render styles are the computed result of the cascade

### Style-Backed Widget Attributes

- Move `display` and `visible` from plain boolean fields on Widget to the style system
- Class mutation and inline style mutation flow through the stylesheet/application path
- Writing class or style changes produces deterministic refresh/layout invalidation through one path

### Query API

- `query(selector)` on DOMNode — returns a `DOMQuery` object
- `query_one(selector)` — returns exactly one match or throws
- `query_exactly_one(selector)` — alias/variant of `query_one`
- `query_children(selector)` — matches only direct children
- `query_ancestor(selector)` — searches ancestors
- `DOMQuery` provides: `.first()`, `.last()`, `.filter()`, `.exclude()`, `.results()`
- `InvalidQueryFormat` error on malformed selectors
- Query cache invalidation keyed on `NodeList._updates`

## Spec References

- `spec/spec-src/04-styling-and-css-engine.md` — CSS engine specification
- `spec/spec-src/02-dom-reactivity-and-query.md` — query API sections
- `spec/spec-tests/css_parsing.md` — CSS parsing test cases
- `spec/spec-tests/css_styles.md` — style application test cases
- `spec/spec-tests/css_scalars.md` — scalar value test cases
- `spec/spec-tests/css_nested.md` — nested CSS test cases
- `spec/spec-tests/dom.md` — DOM query test cases
- `spec/spec-tests/widget.md` — widget style portions

## Uber-Divergence Resolutions

| Issue | Resolution |
|-------|-----------|
| CSS `initial` | Property-sensitive fallback to default-rule values or built-in defaults, not blanket class-default reset |
| Widget ID uniqueness | DOM/screen-wide (HTML semantics) — relevant for `#id` selectors |

## Exit Criteria

1. CSS parsing round-trips: parse TCSS source → AST → serialize back, verify equivalence.
2. Selector matching tests cover: type, class, ID, pseudo-class, descendant, child, sibling combinators.
3. Specificity ordering tests verify correct cascade resolution.
4. Query API tests cover: `query()`, `query_one()`, `query_children()`, `query_ancestor()`, `DOMQuery` chaining, `InvalidQueryFormat` errors.
5. `NodeList._updates` is the only cache invalidation signal consumed by query caches.
6. Writing class or inline style changes produces deterministic refresh/layout invalidation through one path — verified by test.
7. `display` and `visible` are style-backed — verified by test showing CSS rules change display/visibility.
8. All prior phase tests still pass.
9. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 4 (Layout & Compositor) expects:
- `RenderStyles` per widget with box model properties (`width`, `height`, `min-*`, `max-*`, `margin`, `padding`, `border`, `dock`)
- Style values supporting `fr`, `%`, `auto`, and fixed units
- Stylesheet application working — layout strategies will read dimensions from `RenderStyles` instead of hard-coding them
- `display` as a style-backed property, since layout filters on display state
