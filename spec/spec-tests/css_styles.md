# CSS Styles

This spec describes the behavior of CSS styles in Textual, covering style properties, initial values, inheritance, importance/specificity, programmatic changes, and the styles cache.

### Styles Object

A `Styles` object holds a collection of CSS rule values. It supports the following operations:

- **has_rule(name)**: Returns whether a rule has been explicitly set. Setting a property to a value makes `has_rule` return `True`; setting it to `None` or calling `clear_rule` makes it return `False`.
- **clear_rule(name)**: Removes a rule, making `has_rule` return `False` for that property.
- **get_rules()**: Returns a dict of all currently set rules. An empty `Styles` returns `{}`.
- **set_rule(name, value)**: Sets a rule by name and value.
- **reset()**: Clears all rules, returning the object to its initial empty state. After reset, `get_rules()` returns `{}` and properties like `text_style` return their null/default values (e.g., `Style.null()`).
- **merge(other_styles)**: Copies all rules from another `Styles` into this one, combining both sets.
- **merge_rules(dict)**: Merges rules from a plain dictionary.
- **parse(css, read_from)**: Parses a CSS string into the styles object.

### RenderStyles

`RenderStyles` composes a base `Styles` and an inline `Styles` on top of a `DOMNode`. Properties resolve by checking inline first, then base. For example, setting `border_top` on the base and `border_left` on the inline yields the base value for top and the inline value for left when reading the composite `border` property.

### Style Properties and Accepted Types

#### Opacity (`text_opacity`, `opacity`)

- Default value: `1.0`.
- Accepts floats, integers, and percentage strings (e.g., `"25%"` becomes `0.25`).
- Values are clamped to `[0.0, 1.0]`: negative values become `0.0`, values above `1.0` become `1.0`.
- Invalid types (e.g., non-numeric strings like `"invalid value"`) raise `StyleValueError`.

#### Size dimensions (`width`, `height`)

- Accept `None` (clears the value), `int`, `float`, numeric strings (e.g., `"20"`), and `Scalar` objects.
- Numeric values are normalized to `Scalar` with `Unit.CELLS` and `Unit.WIDTH` as the percent unit.
- Percentage-unit scalars are normalized: the unit becomes `Unit.WIDTH` and the value becomes a float.
- Invalid types (`complex`, `Decimal`, `list`, `tuple`, `dict`, non-numeric strings, scientific notation strings) raise `StyleValueError`.

#### Text style (`text_style`, `link_style`)

- Accepts style strings like `"bold"`, `"not bold"`, `"bold underline italic"`.
- Setting to `"none"` clears the style (sets it to `Style.null()`).
- Mixing `"none"` with other style tokens (e.g., `"bold none underline italic"`) raises `StyleValueError`.

#### Border and outline

- Border types `"none"` and `"hidden"` normalize to an empty string. For example, setting `border_left` to `("none", "red")` stores `("", Color.parse("red"))`.

#### CSS serialization

The `css` property on `Styles` serializes set rules to a CSS string. Properties are output in a canonical order. For example, setting `opacity: 50%; text-opacity: 20%; background: green; color: red; tint: dodgerblue 20%` produces the output with background, color, opacity, text-opacity, and tint in alphabetical order, with values normalized (percentages to decimals, colors to hex/rgba).

### Initial Values

The `initial` keyword resets a property to its default value, ignoring any inherited or previously set value from parent widget DEFAULT_CSS.

- **Background default**: `rgba(0,0,0,0)` (fully transparent black). Setting `background: initial` on a subclass that inherited `background: red` restores the transparent default.
- **Color with `initial`**: When a widget hierarchy defines `color` at multiple levels, `initial` resets to the value from the widget's own DEFAULT_CSS chain. If `Base` sets `color: magenta` in DEFAULT_CSS, and app CSS sets `CustomWidget2 { color: initial; }`, the resolved color is `magenta` (from the DEFAULT_CSS of the base class), not some global default. A sibling `CustomWidget3` with `color: blue` gets blue.

### Inheritance

#### DEFAULT_CSS class inheritance

Each widget class can define `DEFAULT_CSS`. Subclasses accumulate DEFAULT_CSS from their ancestry. When a subclass defines DEFAULT_CSS that targets the same selector as a parent, the resolution of overlapping styles between parent and child DEFAULT_CSS is a known open issue (marked xfail: "Overlapping styles should prioritize the most recent widget in the inheritance chain").

#### Text style inheritance

Text styles (`text-style`) are inherited by child widgets in the DOM tree. When a parent changes its text style (e.g., via a pseudo-class like `:focus`), children reflect the change:

- A parent with `text-style: bold` passes `bold` to children.
- When the parent gains focus and its style becomes `text-style: bold reverse`, the child's `rich_style` gains both `bold` and `reverse`.

### Importance and Specificity

The `!important` flag on a CSS declaration overrides more-specific selectors. A less-specific selector with `!important` beats a more-specific selector without it. This works for compound properties that expand to multiple sub-properties:

- **border / outline**: `border: round green !important` overrides a more-specific `Container.more-specific { border: solid red; }` on all four sides (top, right, bottom, left).
- **align / content-align**: `align: right bottom !important` overrides `align: center middle` from a more-specific selector. Same for `content-align`.
- **offset**: `offset: 17 23 !important` overrides `offset: 0 0`.
- **overflow**: `overflow: hidden hidden !important` overrides `overflow: scroll scroll`.
- **padding**: `padding: 10 20 30 40 !important` overrides `padding: 1 2 3 4`. Padding order is top, right, bottom, left.
- **scrollbar-size**: `scrollbar-size: 23 42 !important` overrides `scrollbar-size: 1 2`. The first value is horizontal, the second is vertical.

### Programmatic Style Changes

Setting style attributes programmatically on `widget.styles` triggers layout updates for affected children. The following grid-related properties cause children to resize when changed:

- `grid_size_rows`
- `grid_size_columns`
- `grid_gutter_vertical`
- `grid_gutter_horizontal`
- `grid_rows` (string value, e.g., `"1fr 3fr"`)
- `grid_columns` (string value, e.g., `"1fr 3fr"`)

The following alignment properties cause children to reposition when changed:

- `align_horizontal` (e.g., `"right"`)
- `align_vertical` (e.g., `"bottom"`)
- `align` (tuple, e.g., `("right", "bottom")`)

Changes are applied via `setattr(widget.styles, property_name, value)` and take effect after the next frame (verified with `await pilot.pause()`).

### Style Parsing

The `Style.parse` method parses markup strings into `Style` objects. Supported tokens:

- **Empty string**: produces an empty `Style()`.
- **Text decorations**: `bold`/`b`, `italic`/`i`, `underline`/`u`, `reverse`/`r`. Can be combined: `"bold italic"`.
- **Negation**: `"not bold"` produces `bold=False`. Can mix: `"not bold italic"` means bold is off, italic is on.
- **Foreground color**: `"rgb(10, 20, 30)"` or `"rgba(10, 20, 30, 0.5)"`. Alpha can also be specified with a percentage suffix: `"rgb(10, 20, 30) 50%"`.
- **Background color**: Prefixed with `on`: `"on rgb(10, 20, 30)"`, with optional alpha percentage: `"on rgb(10, 20, 30) 50%"`.
- **Click meta**: `@click=action` syntax attaches click handlers. The action value can be bare (`app.bell`), single-quoted (`'app.bell'`), double-quoted (`"app.bell"`), or include parentheses (`app.bell()`, `app.notify('hello')`). Brackets are allowed inside quoted arguments. Click meta can combine with text decorations: `"@click=app.notify('hello') bold"`.

### Styles Cache

`StylesCache` is a rendering cache that avoids re-rendering content lines that have not changed. It provides:

- **set_dirty(region)**: Marks lines within the given `Region` as dirty. Only lines within the region's y-range are affected. For `Region(3, 4, 10, 2)`, lines 4 and 5 are dirty; lines 3 and 6 are not.
- **is_dirty(y)**: Returns whether a given line index is dirty.
- **render(...)**: Renders styled content with border, padding, and outline applied. Accepts styles, size, base/background colors, a content line callback, and an optional crop region. Behavior:
  - **Border rendering**: A `("heavy", "white")` border wraps content in heavy box-drawing characters.
  - **Padding rendering**: `padding: 1` adds one cell of space on each side around the content.
  - **Combined border and padding**: Border is outermost, padding is between border and content.
  - **Outline rendering**: Outline overlays on top of content (unlike border, which adds space). A 3x3 area with a heavy outline shows box-drawing characters overlapping the content edges.
  - **Crop**: A crop `Region` extracts a sub-rectangle from the rendered output.
  - **Caching behavior**: On first render, the content callback is invoked for each content line. On subsequent renders with unchanged styles/size/colors, the callback is NOT invoked (lines are served from cache). After `set_dirty` marks specific lines, only those lines trigger the content callback on the next render; all other lines remain cached. The y-indices passed to the content callback are content-relative (0-based within the content area), not output-relative. For example, with padding and border, `set_dirty(Region(0, 2, 7, 2))` causes the callback to be invoked with content indices `[0, 1]` — the first two content lines that map to rows 2 and 3 of the full output.

## Constraints

- Setting a style property to `None` clears the rule (equivalent to `clear_rule`).
- `reset()` must clear all rules, restoring the object to its empty initial state.
- Opacity values must clamp to `[0.0, 1.0]`; no error is raised for out-of-range numeric values.
- Invalid types for numeric properties must raise `StyleValueError`, never silently coerce.
- The `"none"` text style token cannot be combined with other tokens; doing so must raise `StyleValueError`.
- Border types `"none"` and `"hidden"` must normalize to empty string, not be stored literally.
- `!important` must override more-specific selectors for all compound properties (border, outline, align, content-align, offset, overflow, padding, scrollbar-size).
- `initial` must reset to the DEFAULT_CSS-inherited value, not a hard-coded global default.
- Programmatic style changes must trigger child layout/position recalculation.
- `StylesCache` must not invoke the content callback for lines that have not been dirtied since the last render.
- `StylesCache.set_dirty` must only affect lines within the y-range of the provided region.
- Text style inheritance must propagate dynamically: when a parent's style changes (e.g., via pseudo-class), children must reflect the update.
