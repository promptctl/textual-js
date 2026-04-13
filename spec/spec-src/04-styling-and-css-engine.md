# Styling and CSS Engine

## CSS Subsystem Modules

Primary modules:

- parsing/tokenization: `css.tokenizer`, `css.tokenize`, `css.parse`, `css._styles_builder`.
- selector model/matching: `css.model`, `css.match`.
- query APIs: `css.query`.
- runtime style objects: `css.styles`, `css._style_properties`, `css.scalar`, `css.transition`.
- stylesheet orchestration: `css.stylesheet`.
- theming and design tokens: `theme`, `design`, `color`.
- render-line caching: `_styles_cache`.

## Style Rule Surface

`RulesMap` (a `TypedDict` in `css.styles`) defines the canonical set of runtime style keys.

- Current key count: `89` (see `RULE_NAMES = list(RulesMap.__annotations__.keys())`).
- Categories: display/visibility/layout; color/background/tint/text_style/opacity/text_opacity;
  padding/margin/offset/position; borders (top/right/bottom/left + border_title/subtitle align,
  color, background, style, auto_color); outlines (top/right/bottom/left); keyline; box_sizing
  and width/height/min/max; dock/split; overflow_x/y; layers/layer; transitions; tint; scrollbar
  color/background/corner/gutter/size/visibility triples; align/content_align; grid size, rows,
  columns, gutter, row_span, column_span; text_align/text_wrap/text_overflow/expand/line_pad;
  link color/background/style (normal + hover, with auto_color variants); hatch; overlay;
  constrain_x/y; pointer.
- `StylesBase.ANIMATABLE` enumerates the subset of keys eligible for transition animation
  (dimensions, offset, padding/margin, colors, opacities, tint, scrollbar colors, link colors,
  text_wrap/text_overflow, line_pad, position).

// [LAW:one-source-of-truth] `RulesMap` is the authoritative inventory of accepted style properties.
`RULE_NAMES_SET` is derived from it and used for validation/lookup.

## Parsing Pipeline

`css.parse.parse(scope, css, read_from, variables, variable_tokens, is_default_rules, tie_breaker)`:

1. tokenize input CSS via `css.tokenize.tokenize` (tokenizer state machines defined in `css.tokenize`),
2. substitute `$variable` references via `substitute_references`, carrying `ReferencedBy`
   provenance on substituted tokens for error reporting,
3. iterate tokens and emit `RuleSet` objects via `parse_rule_set`.

Selector capabilities (see `css.model` / `css.parse.SELECTOR_MAP`):

- selector types: `UNIVERSAL` (`*`), `TYPE`, `CLASS` (`.name`), `ID` (`#name`), `NESTED` (`&`),
- combinators: `SAME` (no whitespace — chained qualifiers on one node), `DESCENDENT` (whitespace),
  and `CHILD` (`>`). There is no general sibling combinator,
- pseudo-classes attach to the preceding selector and bump its class-specificity component by 1
  per pseudo (see `Selector._add_pseudo_class`). Pseudo-class names are validated against
  `constants.VALID_PSEUDO_CLASSES`: `ansi`, `blur`, `can-focus`, `dark`, `disabled`, `enabled`,
  `focus-within`, `focus`, `hover`, `inline`, `light`, `nocolor`, `first-of-type`, `last-of-type`,
  `first-child`, `last-child`, `odd`, `even`, `empty`,
- nested rule expansion: nested rule sets are re-emitted with each outer selector list combined
  with each inner selector list; an inner selector beginning with `&` (the `NESTED` type) merges
  pseudo-classes and specificity into the outer terminal selector (`parse_rule_set.combine_selectors`),
- a non-empty `scope` argument prepends a scope type selector unless the first selector already
  matches the scope name; used to isolate `Widget.DEFAULT_CSS` to its widget type,
- inline declaration parsing via `parse_declarations` (no selector context).

Specificity is a `Specificity3 = (id, class, type)` triple per selector, summed per selector list
by `SelectorSet._total_specificity` / `SelectorSet.from_selectors`.

Variable semantics (`substitute_references`):

- `$name: …` definitions are captured and later `$name` references are replaced by the stored
  token stream,
- variables may reference other variables; substituted tokens carry `ReferencedBy` for error
  provenance,
- unresolved variables raise `UnresolvedVariableError` with a suggestion computed from the known
  variable names.

Theme variables (`theme.Theme` / `design.ColorSystem`) are supplied to `Stylesheet` via
`set_variables`, which clears the parse cache and style-parse cache and invalidates cached
variable tokens. Theme changes therefore force full reparse on next `parse()`.

## `!important` Handling

- The tokenizer recognises `!important` (`css.tokenize` `important` token).
- `_styles_builder` strips the trailing `important` token and records the rule name in
  `Styles.important` (a `set[str]`).
- `Styles.extract_rules` promotes important rules by injecting `1` into the second component of
  the 6-tuple `Specificity6 = (user_vs_default, important, id, class, type, tie_breaker)`, so
  `!important` beats non-important regardless of user/default origin but is still ordered against
  other `!important` rules by source origin and selector specificity.

## Selector Matching

`css.match._check_selectors(selectors, css_path_nodes)` walks selectors against the ancestor path
of the target node:

- `DESCENDENT` combinator: selector may match any descendant along the path (stack-based search
  with backtracking),
- `CHILD`/`SAME` combinators: selector must match the immediately next path node (no skipping),
- match succeeds only when the final selector matches the target node (the last entry in
  `css_path_nodes`),
- `_check_universal` treats the universal selector as excluding nodes carrying the
  `-textual-system` class.

`css.match.match(selector_sets, node)` is the public entry point used outside of rule application.

## Stylesheet Source Model

`css.stylesheet.Stylesheet` maintains ordered CSS sources keyed by `CSSLocation = (path_or_id, classvar_name)`:

- source value: `CssSource(content, is_defaults, tie_breaker, scope)`,
- `read(path)` / `read_all(paths)` load files; `add_source(css, read_from, is_default_css, tie_breaker, scope)`
  registers dynamic CSS (inline or `DEFAULT_CSS`),
- `has_source(path, class_var)` probes registration,
- `parse()` parses sources in insertion order, caching rule lists in `_parse_cache` (LRU 64),
  rejecting CSS that previously failed via `_invalid_css`, and raising `StylesheetParseError`
  wrapping a renderable `StylesheetErrors` when any rule has errors,
- `reparse()` builds a fresh `Stylesheet` with current variables, parses it, and swaps `_rules`
  and `source` on success; on failure the original stylesheet is retained and the invalid CSS is
  recorded to avoid infinite reparse loops,
- `rules_map` is a lazily built `selector_name -> [RuleSet]` index rebuilt from `_rules`,
- `parse_style` caches parsed visual styles (LRU 4096) via `textual.markup.parse_style`.

Cache invalidation contracts:

- `add_source` and any mutation of `source` set `_require_parse = True` and clear `_rules_map`.
- `set_variables` clears `_invalid_css`, `_parse_cache`, `_style_parse_cache`, and invalidates
  cached variable tokens; it does not itself reparse — the next `parse()` / `rules` access does.
- `parse()` and `reparse()` reset `_rules_map` to `None` so it is lazily rebuilt on next access.

## Style Application Algorithm

`Stylesheet.apply(node, *, animate=False, cache=None)`:

1. Reduce candidate rules by intersecting `rules_map` keys with `node._selector_names` and keep
   only those rules (iterated in reverse insertion order to preserve stable ordering after the
   subsequent specificity sort).
2. Update pseudo-class capability flags on the node from the union of candidate rules'
   pseudo-classes: `_has_hover_style`, `_has_focus_within`, `_has_order_style` (covers
   `first-of-type`, `last-of-type`, `first-child`, `last-child`, `empty`), and `_has_odd_or_even`.
3. If a shared `cache` is provided and the node's applicable pseudo-classes are disjoint from
   `_EXCLUDE_PSEUDO_CLASSES_FROM_CACHE` (`first-of-type`, `last-of-type`, `first-child`,
   `last-child`, `odd`, `even`, `focus-within`, `empty` — all positional/sibling-dependent),
   build a cache key of `(parent, id-if-in-rules, classes, pseudo_classes_cache_key, css_type_name)`
   and reuse a previously computed `RulesMap` via `replace_rules` + `_process_component_classes`.
4. For each candidate rule, yield per-selector-set specificities from `_check_rule`, then
   `Styles.extract_rules` emits `(key, Specificity6, value)` triples that include the
   user-vs-default bit, `!important` bit, `Specificity3` from the selector, and tie-breaker.
5. Conflict resolution: for each key, keep the value with the maximum `Specificity6`.
6. `initial` handling: rules whose value is the sentinel `None` are tracked in `initial` (user)
   or `initial_defaults` (`DEFAULT_CSS`). Keys that resolve to `None` after max-specificity are
   re-resolved against the opposite origin: user `initial` falls back to highest-specificity
   default value, default `initial` falls back to highest-specificity default or ultimately to
   `_DEFAULT_STYLES` (the singleton module-level `Styles()`).
7. Store the resolved `RulesMap` in the cache (if any) and invoke `replace_rules(node, rules, animate=animate)`.
8. `_process_component_classes(node)`: for each component class name the node declares, create a
   virtual `DOMNode` with that class, apply the stylesheet to it, capture its resolved
   `RenderStyles` in `node._component_styles`, and `node.refresh()` when any component style
   changed vs. the previous snapshot.

`replace_rules(node, rules, animate)` is the sole arbiter of the final write:

- computes the union of previously set base rule keys and new rule keys,
- when `animate=True`, consults the node's `Animator` via `is_animatable(key)` and
  `_get_transition(key)`; if a transition is defined and the render-time value changed (or an
  animation is already in flight), schedules an animation towards the new value; otherwise
  writes the value directly via `setattr` on `node.styles.base`,
- when `animate=False`, writes every modified key directly,
- always calls `node.notify_style_update()` after writing, which is the downstream trigger for
  `StylesCache` invalidation and layout refresh.

// [LAW:single-enforcer] All selector specificity conflict resolution, `!important` promotion,
`initial` fallback, and final style value arbitration occur in `Stylesheet.apply` /
`Styles.extract_rules` / `Stylesheet.replace_rules`. No other site writes to `node.styles.base`
as a result of CSS matching.

`Stylesheet.update(root, animate)` / `update_nodes(nodes, animate)` iterate descendants with a
shared cache dict; scrollbar sub-widgets for scrollable widgets are applied with the same cache.

## Scalar Units and Values

`css.scalar.Unit` enumerates the supported length units:

- `CELLS` (unitless integer cells), `FRACTION` (`fr`), `PERCENT` (`%`), `WIDTH` (`w`),
  `HEIGHT` (`h`), `VIEW_WIDTH` (`vw`), `VIEW_HEIGHT` (`vh`), `AUTO` (the `auto` keyword).
- `Scalar.parse(token, percent_unit)` yields a `Scalar(value, unit, percent_unit)`; the
  `percent_unit` determines whether `%` resolves against width or height.
- Resolution functions (`_resolve_cells`, `_resolve_fraction`, `_resolve_width`, `_resolve_height`,
  `_resolve_view_width`, `_resolve_view_height`) reduce a `Scalar` to cells against a container
  size, viewport size, and fraction unit.
- `ScalarOffset` composes two scalars for `offset` with independent horizontal/vertical units.

## Color Model

`textual.color.Color` is a `NamedTuple(r, g, b, a, ansi, auto)` with constructors for rgb/rgba,
`from_hsl` / `from_hsv`, ANSI palette colors, and the `"transparent"` / named color table. Color
parsing accepts `#rrggbb`, `#rrggbbaa`, `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, named
colors, and an `"<color> <percent>%"` opacity suffix. Conversions to/from `HSL`, `HSV`, and
`Lab` are provided for contrast/blend operations used by theming and auto-color.

## Theme Integration

`theme.Theme` defines a named palette (primary, secondary, accent, background, surface, panel,
warning, error, success, foreground, plus boolean `dark`) and converts to `design.ColorSystem`
via `Theme.to_color_system`. `ColorSystem.generate()` produces the CSS variable map that is
pushed into `Stylesheet.set_variables`, which then drives reparse. `App.register_theme` /
`App.theme = name` is the ingress for theme swaps. Theme swap contract:

1. new theme -> `ColorSystem` -> CSS variable dict,
2. `Stylesheet.set_variables` clears parse caches,
3. next `parse()` / `reparse()` rebuilds rules with the new values,
4. `Stylesheet.update(app, animate=...)` re-applies styles to the DOM.

## Animation Integration

When `animate=True` in `replace_rules`:

- only keys in `StylesBase.ANIMATABLE` are eligible,
- transition parameters (duration / easing / delay) are sourced from the new styles' `transitions`
  map via `Styles._get_transition(key)`,
- an animation is scheduled if the rendered value changed or if an animation for that key is
  already in flight (`animator.is_being_animated(base, key)`),
- non-animatable or non-transitioned keys are written directly, so the final value is always
  applied in the same pass.

// [LAW:dataflow-not-control-flow] Whether a key animates is decided by data (transition map +
animatable set), not by branching the write path — every modified key is always written (or
scheduled) in the same loop.

## Render-Line Cache (`_styles_cache.StylesCache`)

Per-widget render cache responsible for producing bordered/padded strip output:

- `_cache: dict[int, Strip]` keyed by line index,
- `_dirty_lines: set[int]` of lines requiring re-render,
- `set_dirty(*regions)` marks specific regions dirty; calling with no arguments calls `clear()`
  which empties the cache and width,
- `is_dirty(y)` is the read hook used by the compositor,
- invalidation is driven by `DOMNode.notify_style_update` (the terminal call in
  `Stylesheet.replace_rules`), widget resize, and explicit refresh.

// [LAW:single-enforcer] The StylesCache is the sole owner of per-line rendered strips for a
widget; all invalidation flows through `set_dirty` / `clear`.

## Query API (Selector-Based DOM Filtering)

`css.query.DOMQuery` provides:

- lazy node materialization driven by `parse_selectors` (LRU-cached to 1024 entries),
- chained `filter` / `exclude` producing new queries with combined selectors,
- singleton accessors (`first`, `last`, `only_one`) and typed narrowing (`results`, typed by
  widget class) with `NoMatches`, `TooManyMatches`, `WrongType` exceptions,
- bulk operations (`add_class`, `remove_class`, `set_class`, `toggle_class`, `refresh`, `remove`,
  `set`) that delegate to each matched widget.

Exceptions define invalid query/shape/type conditions (`InvalidQueryFormat`, `NoMatches`,
`TooManyMatches`, `WrongType`).

## Error Reporting

`StylesheetParseError` wraps `StylesheetErrors`, which renders:

- source location (file path or widget class var like `Widget.DEFAULT_CSS`),
- syntax-highlighted snippets (`rich.syntax.Syntax`, `scss` lexer) around error lines, using the
  `referenced_by` token location when an error originates inside a substituted variable so the
  user is pointed at the reference site,
- an aggregated error count line.

`UnresolvedVariableError` is raised during substitution with a `get_suggestion`-based hint.
`DeclarationError` from `_styles_builder` is captured per-declaration and attached to the
owning `RuleSet.errors` so parsing continues and reports all errors at once.
