# Docs Spec: CSS (TCSS) Overview

## Purpose
Describes the CSS overview page — the TCSS (Textual CSS) subset used to style widgets in textual-js, how stylesheets are loaded and merged, how selectors match widgets, and how specificity, variables, nesting, and programmatic styles work.

## Audience
App authors writing `.tcss` stylesheets, widget authors declaring default widget styles, and anyone debugging why a rule did or did not apply.

## Required sections
1. Introduction — TCSS is a CSS-like language (parsed via css-tree in textual-js) that applies a curated subset of CSS to widgets. Files use `.tcss`.
2. Rule Sets — selector + declaration block syntax, colon-separated property:value pairs terminated by semicolons, `/* ... */` comments.
3. The DOM — widgets form a tree (App → Screen → widgets → ...); selectors traverse this tree.
4. Loading Stylesheets
   - External via `cssPath` on the app or screen.
   - Default via a static `DEFAULT_CSS` on widgets/screens (lowest priority).
   - Inline via a `css` string on app/screen/widget.
   - Live reload when running in dev mode.
5. Selectors
   - Type selector — widget class name; matches subclasses; most-specific subclass wins on ties.
   - ID selector — `#id`, unique within a container, immutable after construction.
   - Class selector — `.name`, chainable (`.a.b`); classes are string tags (distinct from widget types).
   - Universal selector — `*`.
   - Pseudo-classes — state-based matchers set by the framework (list and describe each: `:blur`, `:dark`, `:disabled`, `:empty`, `:enabled`, `:even`, `:first-child`, `:first-of-type`, `:focus`, `:focus-within`, `:hover`, `:inline`, `:last-child`, `:last-of-type`, `:light`, `:odd`).
6. Combinators — descendant (space) and child (`>`).
7. Specificity — ID count → class count (pseudo-classes count as classes) → type count; `!important` overrides.
8. CSS Variables — `$name` definitions and references; variables may reference variables; variables only appear in declaration values, never in selectors.
9. The `initial` value — resets to default / DEFAULT_CSS-defined value.
10. Nesting — rule sets may nest, with `&` as the concatenating self-reference (no space) and implicit descendant when `&` is omitted.
11. Programmatic Styles — every widget exposes a `styles` object; assignments update the UI immediately via MobX reactivity.
12. Colors — every color form supported (named, hex RGB/RGBA with and without alpha, rgb/rgba/hsl functions, Color objects).
13. Dimensions and Box Model — `width`, `height`, `padding`, `border`, `margin` (with the "greatest wins, not sum" rule for adjacent margins).
14. Units — cell units, `auto`, `%`, `vw`, `vh`, `w`, `h`, `fr` with the fractional-allocation rule; min/max constraints.
15. Box Sizing — `border-box` (default) vs. `content-box`.
16. Border Types — reference the CSS types spec for the full list; note the preview tool if the textual-js CLI provides one.
17. Outline — like border but does not affect layout size.
18. Border Title / Subtitle — attributes rendered within the border, aligned via `border-title-align`/`border-subtitle-align`.

## Key concepts
- Stylesheets are merged in a defined order; priority ties are resolved first by source order, then by specificity within a source.
- Selectors match the live DOM; the DOM is a tree of App → Screen → widgets.
- Pseudo-classes are framework-controlled state flags; they are not editable directly by authors.
- CSS variables are resolved at parse/use time and can be defined at the top of the stylesheet or derived from the active theme.
- Nesting is syntactic sugar that expands to descendant or same-element selectors depending on the presence of `&`.
- The `styles` object is the runtime mirror of CSS rules; setting a property triggers a reactive re-render.

## Behaviors and contracts
- A subclass selector beats its base-class selector when both set the same property.
- Adjacent widget margins do not sum — the larger of the two is applied.
- `fr` allocates proportionally among siblings whose sum of `fr` values forms the denominator.
- `auto` sizes to content.
- `!important` wins regardless of specificity; use sparingly.
- Setting `classes` on a widget replaces the entire set; `addClass`/`removeClass`/`toggleClass`/`setClass` provide incremental updates.
- `initial` inside `DEFAULT_CSS` means "unstyled"; outside `DEFAULT_CSS` it means "reset to whatever `DEFAULT_CSS` says."

## Example requirements
Describe (do not inline) JSX/TypeScript and TCSS examples covering:
- A minimal `.tcss` file styling a header and button.
- An app/widget declaring `DEFAULT_CSS` as a static string.
- Using a CSS variable to reuse a border/color and deriving one variable from another.
- A nested rule with `&` versus the same rule without `&`.
- Assigning inline styles via `widget.styles.background = "darkblue"` inside an observer component handler.
- Using `fr` to split space between siblings.
All examples are TCSS + JSX/TypeScript; no Python.

## Cross-references
- `spec/docs-spec/css_types.md` — formal value-type grammar referenced by every property.
- `spec/docs-spec/dom_and_queries.md` — the DOM, IDs, classes, and selectors.
- `spec/docs-spec/design.md` — themes and variables.
- `spec/docs-spec/app.md` — CSS loading order on the app.
- `spec/spec-src/04-styling-and-css-engine.md` — authoritative CSS engine behavior in textual-js.
- `spec/spec-src/09-widget-base-contract.md` — widget defaults and `DEFAULT_CSS` contract.

## Notes for writers
- Do not write `CSS_PATH = "my_app.tcss"` inside a Python class. Use the JS equivalent: `cssPath` prop, or a static field on the component class.
- Do not reference Python `frozenset` when describing `classes`. Describe it as a read-only Set-like value.
- Do not write `add_class()`, `remove_class()`, etc. Use camelCase in examples (`addClass`, `removeClass`, `toggleClass`, `hasClass`, `setClass`).
- Type selectors match widget React component names. Stability requirements (preserving the displayName/class identity across bundling) belong in the widget-authoring spec; keep a one-line note referencing that.
- Live reload is enabled by `watchCss`/dev mode; describe only the user-facing behavior, not the file-watching implementation.
- The Python `textual borders` CLI may not exist in textual-js; if a preview command ships, name it; otherwise omit.
- Do not document Rich Color objects. Colors are plain strings or textual-js `Color` instances.
