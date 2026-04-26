# Styling and CSS Engine

## Overview

The TCSS (Textual CSS) engine provides a CSS-like styling language for terminal widgets. It uses **css-tree** for parsing and selector matching, with a framework layer on top for Textual-specific properties, cascade resolution, and translation to Ink style props.

TCSS is an **authoring and cascade layer**, not a rendering engine. The output of the TCSS pipeline is "what Ink props should this widget have, and what rich-js `Style` values should content segments carry." Ink and Yoga handle the actual layout and rendering.

// [LAW:single-enforcer] The TCSS cascade is the single enforcer of style resolution. No widget hand-computes its own styles. All style changes (class mutation, theme change, inline style, pseudo-class) funnel through the cascade.

## How TCSS Works End-to-End

```
TCSS Source                    Widget Registry
    │                              │
    ▼                              ▼
css-tree parse ──► AST        Selector matching
    │                              │
    ▼                              ▼
Variable substitution     Specificity calculation
    │                              │
    └──────────┬───────────────────┘
               ▼
        Cascade resolution
        (specificity + origin + !important)
               │
               ▼
        ResolvedStyles (MobX observable per widget)
               │
               ▼
        TCSS → Ink prop translation
               │
               ▼
        Widget re-renders via observer()
               │
               ▼
        Ink renders to terminal via Yoga
```

## TCSS Syntax

TCSS is a subset of CSS with Textual-specific extensions. It looks like CSS but targets terminal widgets:

```css
/* Type selector — matches all Button widgets */
Button {
  background: $primary;
  color: $foreground;
  min-width: 16;
  height: 3;
  padding: 0 2;
}

/* Class selector */
Button.-primary {
  background: $primary;
}

/* ID selector */
#save-button {
  dock: bottom;
}

/* Pseudo-class */
Button:focus {
  background: $accent;
  text-style: bold;
}

/* Descendant combinator */
Screen > Container Button {
  margin: 1 2;
}

/* Nested rules */
DataTable {
  background: $surface;

  &:focus {
    background: $panel;
  }

  & > .cell {
    padding: 0 1;
  }
}

/* Variables */
$sidebar-width: 30;
$highlight: rgb(255, 200, 0);

Sidebar {
  width: $sidebar-width;
  border: solid $highlight;
}

/* Transitions */
Button {
  background: $surface;
  transition: background 300ms ease-in-out;
}
```

## Style Property Registry

The framework defines a canonical set of TCSS style properties. This is the authoritative inventory — properties not in this registry are rejected during parsing.

// [LAW:one-source-of-truth] The property registry is the authoritative inventory of accepted style properties.

### Display and visibility

| Property | Values | Ink mapping | Description |
|----------|--------|-------------|-------------|
| `display` | `block`, `none` | `display` prop | Whether the widget renders |
| `visibility` | `visible`, `hidden` | `opacity: 0` + non-interactive | Whether the widget is visible (still occupies space) |
| `opacity` | `0.0`–`1.0` | `dimColor` or alpha | Widget opacity |

### Dimensions

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `width` | cells, `fr`, `%`, `auto`, `vw` | `width` prop |
| `height` | cells, `fr`, `%`, `auto`, `vh` | `height` prop |
| `min-width` | cells, `%`, `vw` | `minWidth` prop |
| `max-width` | cells, `%`, `vw` | `maxWidth` prop |
| `min-height` | cells, `%`, `vh` | `minHeight` prop |
| `max-height` | cells, `%`, `vh` | `maxHeight` prop |

### Box model

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `padding` | 1–4 values (top right bottom left) | `paddingTop/Right/Bottom/Left` props |
| `margin` | 1–4 values (top right bottom left) | `marginTop/Right/Bottom/Left` props |
| `box-sizing` | `border-box`, `content-box` | Affects dimension calculation |

### Borders

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `border` | `solid`, `double`, `round`, `heavy`, `thick`, `dashed`, `tall`, `wide`, `none` + color | `borderStyle`, `borderColor` props |
| `border-top/right/bottom/left` | Same as `border`, per-side | Per-side border props |
| `border-title-align` | `left`, `center`, `right` | Border title positioning |
| `border-subtitle-align` | `left`, `center`, `right` | Border subtitle positioning |

### Outline

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `outline` | Same as `border` | Drawn outside the border (no Ink equivalent — rendered manually) |
| `outline-top/right/bottom/left` | Same per-side | Per-side outline |

### Colors and text

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `color` | color value | `color` prop on `<Text>` |
| `background` | color value | `backgroundColor` prop on `<Box>` |
| `text-style` | `bold`, `italic`, `underline`, `strike`, `reverse`, `none` (combinable) | `bold`, `italic`, `underline`, `strikethrough` props on `<Text>` |
| `text-align` | `left`, `center`, `right`, `justify` | Text alignment within the widget |
| `text-wrap` | `wrap`, `nowrap`, `ellipsis` | Ink `wrap` prop on `<Text>` |
| `text-overflow` | `ellipsis`, `fold` | How text overflow is handled |
| `tint` | color with alpha | Color overlay |

### Layout

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `dock` | `top`, `bottom`, `left`, `right` | Widget is docked to an edge of its parent (framework-managed, not Ink) |
| `overflow` | `auto`, `scroll`, `hidden` | Scroll behavior |
| `align` | horizontal vertical | `alignItems`, `justifyContent` on `<Box>` |
| `content-align` | horizontal vertical | `alignSelf` or content positioning |
| `offset` | x y (cells or %) | Translation offset |
| `layers` | layer names | Stacking order |
| `layer` | layer name | Which layer this widget is on |

### Grid

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `grid-size` | columns rows | Grid dimensions |
| `grid-rows` | size list | Row sizes |
| `grid-columns` | size list | Column sizes |
| `grid-gutter` | horizontal vertical | Gap between cells |
| `row-span` | integer | How many rows this widget spans |
| `column-span` | integer | How many columns this widget spans |

### Scrollbar

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `scrollbar-color` | color | Scrollbar thumb color |
| `scrollbar-color-hover` | color | Scrollbar thumb hover color |
| `scrollbar-color-active` | color | Scrollbar thumb active color |
| `scrollbar-background` | color | Scrollbar track color |
| `scrollbar-background-hover` | color | Scrollbar track hover color |
| `scrollbar-background-active` | color | Scrollbar track active color |
| `scrollbar-size` | horizontal vertical | Scrollbar dimensions |

### Links

| Property | Values | Ink mapping |
|----------|--------|-------------|
| `link-color` | color | Link text color |
| `link-background` | color | Link background |
| `link-style` | text style | Link text decoration |
| `link-color-hover` | color | Link hover text color |
| `link-background-hover` | color | Link hover background |
| `link-style-hover` | text style | Link hover decoration |

### Transitions

| Property | Values | Description |
|----------|--------|-------------|
| `transition` | `<property> <duration> <easing> <delay>` | Animate property changes |

### Other

| Property | Values | Description |
|----------|--------|-------------|
| `hatch` | character color | Fill pattern |
| `overlay` | `screen` | Overlay rendering mode |
| `constrain` | `x`, `y`, `both`, `none` | Constrain widget to parent bounds |

### Animatable properties

The `ANIMATABLE` set enumerates properties eligible for transition animation: dimensions (`width`, `height`, `min-*`, `max-*`), `offset`, `padding`, `margin`, colors (`color`, `background`, `tint`, `opacity`), scrollbar colors, and link colors. Non-animatable properties snap to their new value immediately.

## Parsing Pipeline

TCSS parsing uses css-tree for tokenization and AST construction:

1. **Tokenize and parse**: input TCSS is parsed by css-tree into an AST.
2. **Variable substitution**: `$variable` references are replaced with the stored token stream, carrying provenance for error reporting. Variables may reference other variables. Unresolved variables throw `UnresolvedVariableError` with a suggestion.
3. **Nested rule expansion**: nested rule sets (using `&`) are expanded into flat rule sets with combined selectors.
4. **Scoping**: `DEFAULT_CSS` sources are scoped to their widget type — a scope type selector is prepended unless the first selector already matches the scope name.
5. **Emit rule sets**: produce (selectors, declaration block) pairs.

### Selector capabilities

| Selector type | Syntax | Example |
|---------------|--------|---------|
| Universal | `*` | `* { margin: 0; }` |
| Type | `TypeName` | `Button { ... }` |
| Class | `.className` | `.highlighted { ... }` |
| ID | `#idName` | `#save { ... }` |
| Pseudo-class | `:pseudoName` | `:focus { ... }` |
| Nested | `&` | `& :hover { ... }` |

| Combinator | Syntax | Description |
|------------|--------|-------------|
| Same | chained (no space) | `Button.primary:focus` — all must match one widget |
| Descendant | whitespace | `Screen Button` — Button anywhere under Screen |
| Child | `>` | `Container > Button` — Button is direct child of Container |

### Pseudo-classes

| Pseudo-class | Matches when |
|-------------|-------------|
| `:focus` | Widget has focus |
| `:blur` | Widget does not have focus |
| `:hover` | Widget is under the mouse pointer |
| `:disabled` | Widget's `disabled` state is true |
| `:enabled` | Widget's `disabled` state is false |
| `:dark` | Active theme has `dark: true` |
| `:light` | Active theme has `dark: false` |
| `:can-focus` | Widget has `canFocus: true` |
| `:focus-within` | Widget or a descendant has focus |
| `:first-child` | Widget is the first child of its parent |
| `:last-child` | Widget is the last child of its parent |
| `:first-of-type` | Widget is the first of its type among siblings |
| `:last-of-type` | Widget is the last of its type among siblings |
| `:even` | Widget is at an even index among siblings |
| `:odd` | Widget is at an odd index among siblings |
| `:empty` | Widget has no children |

Pseudo-class state is stored as MobX observables on the widget's registration. Changes trigger TCSS recalculation for the widget and any selectors that reference the changed pseudo-class.

### Specificity

Specificity is a `(id, class, type)` triple per selector, following CSS rules:
- Each ID selector (`#name`) adds 1 to the id component
- Each class selector (`.name`) and pseudo-class (`:name`) add 1 to the class component
- Each type selector (`TypeName`) adds 1 to the type component

For cascade resolution, specificity is extended to a 6-tuple: `(userVsDefault, important, id, class, type, tieBreaker)`.

## `!important` Handling

- The parser recognizes `!important` on any declaration.
- Important rules are promoted in the 6-tuple specificity: `important` is 1, so `!important` beats non-important regardless of selector specificity.
- Among `!important` rules, normal specificity and source origin still determine precedence.

## Selector Matching

Selector matching is performed via css-tree's matching capabilities, applied against the widget registry:

- The widget's CSS identity (type name, id, classes, pseudo-class state) is matched against each selector in the parsed stylesheet.
- Descendant combinator: selector may match any ancestor along the widget's parent chain (with backtracking).
- Child combinator: selector must match the immediate parent (no skipping).
- Same combinator (chained): all conditions must match the same widget.
- Match succeeds only when the final selector matches the target widget.

## Stylesheet Source Model

The stylesheet maintains ordered CSS sources:

- Sources are registered with metadata: content string, whether it is default CSS (lower origin priority), tie-breaker (insertion order), and scope (widget type for DEFAULT_CSS scoping).
- `parse()` parses sources in insertion order via css-tree, caching results and rejecting CSS that previously failed.
- `reparse()` builds a fresh parse with current variables, swaps rules on success; on failure the original is retained.

### Source types and precedence

| Source | Origin | Precedence |
|--------|--------|------------|
| Widget `DEFAULT_CSS` | Default | Lowest (scoped to widget type) |
| App `CSS` | User | Higher than default |
| Screen `CSS` | User | Higher than default (merged when screen is active) |
| Inline styles | Inline | Highest (set programmatically) |

### Cache invalidation

- Adding or mutating a source marks the stylesheet for reparse.
- Setting variables (theme change) clears parse and style caches. The next access triggers reparse.
- Class mutations and pseudo-class changes trigger per-widget style recalculation without full reparse (the stylesheet AST is unchanged, only matching results change).

## Style Application Algorithm

Style application resolves TCSS rules to per-widget `ResolvedStyles`:

1. **Candidate reduction**: intersect selector names with the widget's CSS identity (type, id, classes) to reduce the candidate rule set.
2. **Pseudo-class capability update**: update the widget's pseudo-class flags from the union of candidate rules' pseudo-classes. This tells the widget which pseudo-classes it needs to track.
3. **Cache check**: if the widget's pseudo-class state is cache-safe, reuse previously computed results.
4. **Specificity computation**: for each candidate rule, compute the 6-tuple specificity: `(userVsDefault, important, id, class, type, tieBreaker)`.
5. **Conflict resolution**: for each property, keep the value with the maximum specificity.
6. **`initial` fallback**: properties whose value resolves to `initial` are re-resolved: user `initial` falls back to the highest-specificity default value; default `initial` falls back to built-in defaults. This is property-sensitive fallback. For color-valued properties, the fallback result is still a concrete rich-js `Color` instance.
7. **Inline style merge**: inline styles (set programmatically) override cascade results.
8. **Store**: write the resolved styles to the widget's `ResolvedStyles` MobX observable. `ResolvedStyles` contains `box` (Ink `<Box>` props), `text` (Ink `<Text>` props), `style` (rich-js `Style` for content segments), and `components` (`Map<componentClassName, Style>` for per-component-class rich-js styling).
9. **Component classes**: for each component class the widget declares, resolve styles for a virtual widget with that class.

// [LAW:single-enforcer] All selector specificity conflict resolution, !important promotion, initial fallback, and final style value arbitration occur in the style application pipeline. No other site writes to a widget's styles as a result of CSS matching.

### TCSS → Ink prop translation

After cascade resolution, `ResolvedStyles` retain both the cascade's semantic output and the render-boundary translation:

```tsx
// Conceptual — inside useStyles() hook
function translateResolvedStyles(resolved: ResolvedStyles) {
  return {
    box: {
      width: resolved.width?.toInk(),
      height: resolved.height?.toInk(),
      minWidth: resolved.minWidth?.toInk(),
      // ... etc
      paddingTop: resolved.padding?.top,
      paddingRight: resolved.padding?.right,
      paddingBottom: resolved.padding?.bottom,
      paddingLeft: resolved.padding?.left,
      marginTop: resolved.margin?.top,
      // ... etc
      borderStyle: resolved.border?.style,
      borderColor: resolved.border?.color,
      display: resolved.display === 'none' ? 'none' : 'flex',
      flexDirection: resolved.layout === 'horizontal' ? 'row' : 'column',
      alignItems: resolved.align?.vertical,
      justifyContent: resolved.align?.horizontal,
    },
    text: {
      color: resolved.color?.toAnsi(),
      backgroundColor: resolved.background?.toAnsi(),
      bold: resolved.textStyle?.includes('bold'),
      italic: resolved.textStyle?.includes('italic'),
      underline: resolved.textStyle?.includes('underline'),
      strikethrough: resolved.textStyle?.includes('strike'),
      wrap: resolved.textWrap ?? 'wrap',
    },
    style: Style.fromResolvedTextStyles(resolved),
    components: new Map(
      resolved.componentClasses.map((name) => [
        name,
        Style.fromResolvedComponentStyles(resolved.componentStyles[name]),
      ]),
    ),
  };
}
```

`box` and `text` are consumed by compose-mode widgets. `style` and `components` are consumed by line-based widgets that produce rich-js `Content` / `Strip`s and need segment-level styling. Properties with no direct Ink equivalent (e.g., `dock`, `layers`, `hatch`, `overlay`) are stored on `ResolvedStyles` for the widget or framework to interpret. For example, `dock` is consumed by the screen's layout logic to position docked widgets before Ink's flexbox handles the remaining flow.

## Scalar Units and Values

### Length units

| Unit | Syntax | Resolution |
|------|--------|------------|
| Cells | unitless integer | Absolute terminal cells |
| Fraction | `fr` | Fraction of remaining space (like CSS Grid `fr`) |
| Percent | `%` | Percentage of container size |
| Width | `w` | Percentage of terminal width |
| Height | `h` | Percentage of terminal height |
| View Width | `vw` | Percentage of viewport width (same as `w`) |
| View Height | `vh` | Percentage of viewport height (same as `h`) |
| Auto | `auto` | Content-driven sizing |

- `fr` and `%` resolve relative to the container/viewport size at layout time.
- `ScalarOffset` composes two scalars for the `offset` property with independent horizontal/vertical units.
- A "cell" is a terminal column. Wide characters (CJK, emoji) occupy 2 cells; combining characters occupy 0. Cell counts come from rich-js `cellLength`, not `str.length`.

### Color values

Colors support:
- Hex: `#rrggbb`, `#rrggbbaa`, `#rgb`
- Functions: `rgb(r, g, b)`, `rgba(r, g, b, a)`, `hsl(h, s, l)`, `hsla(h, s, l, a)`
- Named colors: all CSS named colors
- Opacity suffix: `"<color> <percent>%"` — e.g., `red 50%`
- Theme variables: `$primary`, `$surface`, etc. — resolved from the active theme

Color conversions to/from HSL, HSV, and Lab are provided for contrast/blend operations used by theming (automatic foreground color calculation, hover tinting, etc.).
All color values resolve to rich-js `Color` instances during cascade resolution. Ink color props at the render boundary are produced via `Color.toAnsi()` respecting the active color depth and output filter pipeline. The string forms above are input syntax; `Color` is the internal representation.

### Auto-contrast (`color: auto`)

When a TCSS declaration uses `color: auto` or `background-tint: auto`, cascade resolution computes a contrasting foreground/tint from the widget's final resolved background. The calculation uses rich-js `Color.contrastRatio()` and `Color.luminance`, producing a concrete rich-js `Color` before the value is stored on `ResolvedStyles`.

## Theme Integration

A theme defines a named palette and converts to CSS variables:

```tsx
const darkTheme: Theme = {
  name: 'dark',
  dark: true,
  primary: '#0178d4',
  secondary: '#004578',
  accent: '#ffa62b',
  background: '#121212',
  surface: '#1e1e1e',
  panel: '#252526',
  foreground: '#cccccc',
  error: '#cf6679',
  warning: '#ffb74d',
  success: '#81c784',
  variables: {
    'scrollbar-background': '#333333',
  },
};
```

### Theme swap contract

1. New theme → CSS variable map (`Record<string, Color | string | number>`). Color fields are parsed into rich-js `Color` at registration; derived variables such as `$primary-lighten-2` and `$surface-darken-1` are computed via `Color.lighten()`, `Color.darken()`, and `Color.blend()`.
2. Stylesheet `setVariables` clears parse caches.
3. Next parse rebuilds rules with new variable values.
4. Stylesheet re-applies styles to all widgets in the active screen stack.
5. `theme_changed_signal` is published.

## Animation Integration

When animation is enabled during style application:

- Only properties in the `ANIMATABLE` set are eligible for transition.
- Transition parameters (duration, easing, delay) are sourced from the new styles' `transitions` map.
- An animation is scheduled if the resolved value changed or if an animation for that property is already in flight.
- Non-animatable or non-transitioned properties are written directly — the final value is always applied in the same pass.
- The Animator interpolates from old → new over the specified duration, updating the MobX observable on each frame. Color-valued properties interpolate via rich-js `Color.blend(from, to, t)` per animator tick; numeric properties use linear or easing-function numeric interpolation. `observer()` picks up each intermediate value and triggers a React re-render.

// [LAW:dataflow-not-control-flow] Whether a property animates is decided by data (transition map + animatable set), not by branching the write path — every modified property is always written (or scheduled) in the same loop.

## Query API

Query behavior is defined in `spec-src/02` (Widget Registry, Reactivity, and Query Semantics). The TCSS engine provides selector parsing and matching; the query API consumes these capabilities to filter the widget registry.

## Error Reporting

| Error | When | Details |
|-------|------|---------|
| `StylesheetParseError` | TCSS syntax error | Includes source location and syntax-highlighted snippet around error line |
| `UnresolvedVariableError` | `$name` reference not found | Includes a suggestion based on known variable names (fuzzy match) |
| `DeclarationError` | Invalid property or value | Captured per-declaration so parsing continues; all errors reported at once |

- When an error originates inside a substituted variable, the user is pointed at the reference site, not the variable definition.
- Invalid declarations do not prevent valid declarations in the same rule from being applied.
