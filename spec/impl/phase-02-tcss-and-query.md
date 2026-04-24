# Phase 2: TCSS Engine & Query API

## Preconditions

Phase 1 complete:
- React/Ink/MobX foundation working
- Widget registry with CSS identity (id, classes, typeName)
- MobX reactive pipeline with validate/watch/compute
- Test harness (runTest + Pilot) working
- All Phase 1 tests pass

## Goal

Introduce TCSS parsing via css-tree, selector matching against the widget registry, style cascade, and the query API — then translate resolved styles to Ink style props.

## Architectural Rationale

// [LAW:single-enforcer] css-tree + our cascade layer is the single enforcer of style resolution. No widget hand-rolls style logic. Widgets declare `DEFAULT_CSS` and the cascade produces resolved styles.

// [LAW:one-source-of-truth] Selector parsing and matching have one implementation (css-tree), shared by CSS application and the query API.

// [LAW:one-way-deps] TCSS cascade → resolved styles (MobX observables) → `observer()` triggers re-render → Ink receives style props. Styles flow downward. Ink never writes back to the cascade.

### Why css-tree

css-tree is a fast, spec-compliant CSS parser with AST construction, selector parsing, and specificity calculation. It handles tokenization, parsing, and selector matching — the hard parts of a CSS engine. We add a thin layer on top for:
- TCSS-specific properties (dock, scrollbar-*, Textual layout hints)
- Style cascade (DEFAULT_CSS < user CSS < inline)
- Translation from resolved CSS properties to Ink style props

### How TCSS integrates with Ink

Ink components accept style props directly (`<Box width={20} borderStyle="round">`). TCSS doesn't replace Ink's styling — it sits above it:

1. Widgets declare `DEFAULT_CSS` and users write TCSS stylesheets
2. css-tree parses the TCSS and matches selectors against the widget registry
3. The cascade resolves styles per widget (specificity, !important, variables)
4. Resolved styles are translated to Ink-compatible style props
5. The widget reads its resolved styles (MobX observable) and passes them to Ink components

This means TCSS is an **authoring and cascade layer**, not a replacement for Ink's rendering. The output of TCSS is "what Ink props should this widget have."

## Current State (before this phase)

**From Phase 1:**
- Widget registry tracks mounted widgets with CSS identity (id, classes, typeName)
- Registry has a version counter for cache invalidation
- MobX observables power reactive state
- `observer()` triggers React re-renders on observable changes

**What does NOT exist:**
- No CSS parser
- No selector matching
- No style cascade
- No ResolvedStyles or computed style object
- No query API
- Widgets have no `DEFAULT_CSS` processing (the static property exists but is unused)

## Scope

### Install css-tree

- Add `css-tree` as a runtime dependency
- Add `@types/css-tree` if available (or declare types)

### TCSS Parser

- Use css-tree to parse TCSS source into an AST
- Extend css-tree's parser (via its extension API or post-processing) to handle TCSS-specific properties:
  - Layout hints: `dock`, `overflow`, `scrollbar-size`, `scrollbar-color`
  - Textual units: `fr` (fractional), `w` and `h` (viewport-relative)
  - Textual pseudo-classes: `:focus-within`, `:disabled`, `:loading`
- Parse `DEFAULT_CSS` static property from each widget type
- Parse user-provided TCSS stylesheets

### Selector Matching

- Use css-tree's selector AST to match against widgets in the registry
- Match by: type name (component name), class (`.class`), ID (`#id`), pseudo-class (`:pseudo`)
- Combinators: descendant (space), child (`>`), sibling (`~`), adjacent (`+`)
- Parent chain for combinators: use the registry's parent references (derived from React tree)
- Specificity: use css-tree's specificity calculation

### Style Cascade

- Three layers per widget: `DEFAULT_CSS` (widget class default) < user CSS (app stylesheet) < inline styles (set programmatically)
- Resolve cascade per widget: highest specificity wins, `!important` overrides, later rules break ties
- CSS variables (`--var-name`): resolved from the cascade, scoped to the widget and its ancestors
- `initial` keyword: property-sensitive fallback
- Result: a `ResolvedStyles` MobX observable per widget

### ResolvedStyles → Ink Props Translation

- Map resolved TCSS properties to Ink's `<Box>` and `<Text>` style props:
  - `width`, `height`, `min-width`, `max-width` → Ink's width/height/minWidth/minHeight props
  - `margin`, `padding` → Ink's margin/padding props (Ink uses Yoga, supports all four sides)
  - `border` → Ink's borderStyle/borderColor
  - `background`, `color` → Ink's backgroundColor, color (via chalk)
  - `display: none` → Ink's display="none"
  - `text-align` → Ink's alignItems/justifyContent where applicable
- TCSS properties with no direct Ink equivalent are stored on ResolvedStyles for the widget to interpret (e.g., `dock` is consumed by the screen layout logic, not passed to Ink)

### Style-Backed Widget State

- `display` and `visible` become TCSS-backed: CSS rules can set them, class changes toggle them
- Class mutations (`.addClass()`, `.removeClass()`) trigger style recalculation via the cascade
- Inline style mutations trigger recalculation
- All style changes flow through the cascade — one path

### Pseudo-Classes

- `:focus` — widget has focus (managed by focus system in Phase 3, but the selector matching supports it now)
- `:hover` — widget is hovered (if applicable in terminal context)
- `:disabled` — widget is disabled
- `:loading` — widget is in loading state
- Pseudo-class state stored as MobX observables on the widget registration — changes trigger style recalculation

### Query API

- `query(selector)` on any widget → returns a `DOMQuery` object
- `query_one(selector)` → exactly one match or throws
- `query_exactly_one(selector)` → alias
- `query_children(selector)` → direct children only
- `query_ancestor(selector)` → searches ancestors
- `DOMQuery` provides: `.first()`, `.last()`, `.filter()`, `.exclude()`, `.results()`
- `InvalidQueryFormat` error on malformed selectors
- Implementation: parse selector with css-tree, match against widget registry
- Cache invalidation: query results are MobX computed values keyed on the registry version counter

### Widget hook integration

- `useStyles()` hook: returns the widget's resolved Ink-compatible styles as a MobX observable
- Widgets use this to get their TCSS-derived styles:

```tsx
const Button = observer(({ id, classes, children }) => {
  const styles = useStyles();
  return (
    <Box {...styles.box}>
      <Text {...styles.text}>{children}</Text>
    </Box>
  );
});
```

## Spec References

- `spec/spec-src/04-styling-and-css-engine.md` — CSS engine specification
- `spec/spec-src/02-dom-reactivity-and-query.md` — query API sections
- `spec/spec-tests/css_parsing.md` — CSS parsing test cases
- `spec/spec-tests/css_styles.md` — style application test cases
- `spec/spec-tests/css_scalars.md` — scalar value test cases
- `spec/spec-tests/css_nested.md` — nested CSS test cases
- `spec/spec-tests/dom.md` — DOM query test cases
- `spec/spec-tests/widget.md` — widget style portions

## Exit Criteria

1. TCSS parsing: parse source → AST → serialize back, verify round-trip equivalence.
2. Selector matching tests: type, class, ID, pseudo-class, all combinators.
3. Specificity ordering tests: correct cascade resolution.
4. ResolvedStyles → Ink props: a widget's `DEFAULT_CSS` produces correct Ink style props in a rendered test.
5. Query API tests: `query()`, `query_one()`, `query_children()`, `query_ancestor()`, `DOMQuery` chaining, `InvalidQueryFormat` error.
6. Class mutation triggers style recalculation — verified by test.
7. CSS variables resolve correctly through the cascade.
8. `useStyles()` hook returns correct styles and triggers re-render on change.
9. All Phase 1 tests still pass.
10. `npm run build` and `npm run lint` pass.

## What the Next Phase Expects

Phase 3 (Focus, Screens, Bindings) expects:
- TCSS cascade working — widgets have resolved styles
- Pseudo-classes (`:focus`, `:disabled`) supported in selectors — focus changes trigger style recalculation
- Query API working — focus chain can be built by querying focusable widgets
- Widget registry with parent references — for binding resolution (walk up the tree)
