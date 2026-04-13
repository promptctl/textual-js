# CSS Overview

Textual uses a subset of CSS to apply styles to widgets. Stylesheets are lists of rule sets that declare how widgets should be displayed. CSS files use the `.tcss` extension.

## Rule Sets

A rule set consists of a selector followed by a block of declarations enclosed in curly braces. Each declaration is a property name and value separated by a colon, terminated by a semicolon.

```css
Header {
  dock: top;
  height: 3;
  background: blue;
  color: white;
}
```

Comments use `/* ... */` syntax and are ignored by the parser.

## The DOM

The DOM (Document Object Model) is the tree of widgets in a Textual application. The App contains a Screen, which contains child widgets, which may contain further children. CSS selectors traverse this tree to target specific widgets.

## Loading Stylesheets

### CSS_PATH

Set the `CSS_PATH` class variable on an App or Screen subclass to a relative path (string) pointing to a `.tcss` file. It may also be set to a list of paths; Textual combines rules from all supplied files.

```python
class MyApp(App):
    CSS_PATH = "my_app.tcss"
```

### DEFAULT_CSS

Widgets and screens can define a `DEFAULT_CSS` class variable containing inline CSS as a string. Default CSS has lower priority than CSS loaded from files or the app-level `CSS` class variable, so it can be overridden by the application author.

### CSS Class Variable

The `CSS` class variable on App, Screen, or Widget subclasses accepts an inline CSS string. This CSS is combined with any file-based CSS.

### Live Editing

Running an app with `textual run my_app.py --dev` enables live CSS reloading: changes to `.tcss` files are applied immediately without restarting the application.

## Selectors

### Type Selector

Matches widgets by their Python class name. Also matches subclasses, so a `Static` selector matches any widget whose class inherits from `Static`.

```css
Button {
  background: green;
}
```

When the same property is set by both a base-class selector and a subclass selector, the most specific (most-derived) subclass wins.

### ID Selector

Matches a widget by its `id` attribute (set via constructor, immutable after construction). Prefixed with `#`.

```css
#next {
  outline: red;
}
```

A widget's `id` must be unique within its container.

### Class-Name Selector

Matches widgets that have a given CSS class. Prefixed with `.`. CSS classes are distinct from Python classes; they are string tags assigned via the `classes` constructor parameter (space-separated for multiple classes).

```css
.success {
  background: green;
}
```

Class selectors may be chained to require multiple classes on the same widget:

```css
.error.disabled {
  background: darkred;
}
```

CSS classes can be modified at runtime via:

- `add_class()` -- adds one or more classes.
- `remove_class()` -- removes one or more classes.
- `toggle_class()` -- toggles a class on/off.
- `has_class()` -- checks if classes are set.
- `set_class()` -- sets or removes a class based on a boolean.
- `classes` -- a frozen set of current classes on the widget.

### Universal Selector

The `*` selector matches all widgets.

```css
* {
  outline: solid red;
}
```

### Pseudo-Classes

Pseudo-classes match widgets in a particular state. They are set automatically by Textual and appended to selectors with a colon.

```css
Button:hover {
  background: green;
}
```

Available pseudo-classes:

- `:blur` -- widget does not have input focus.
- `:dark` -- app is using a dark theme.
- `:disabled` -- widget is disabled.
- `:empty` -- widget has no displayed children.
- `:enabled` -- widget is enabled.
- `:even` -- widget is at an even index among siblings.
- `:first-child` -- first among siblings.
- `:first-of-type` -- first of its type among siblings.
- `:focus` -- widget has input focus.
- `:focus-within` -- widget contains a focused child.
- `:hover` -- mouse cursor is over the widget.
- `:inline` -- app is running in inline mode.
- `:last-child` -- last among siblings.
- `:last-of-type` -- last of its type among siblings.
- `:light` -- app is using a light theme.
- `:odd` -- widget is at an odd index among siblings.

## Combinators

### Descendant Combinator

Two selectors separated by a space. Matches the second selector only if it has an ancestor matching the first.

```css
#dialog Button {
  text-style: bold;
}
```

Multiple selectors can be chained:

```css
#dialog Horizontal Button {
  text-style: bold;
}
```

### Child Combinator

Two selectors separated by `>`. Matches the second selector only if it is a direct child of the first.

```css
#sidebar > Button {
  text-style: underline;
}
```

## Specificity

When multiple selectors match a widget and set the same property, Textual resolves conflicts using specificity, evaluated in order:

1. **ID count** -- the selector with more ID selectors wins.
2. **Class count** -- the selector with more class-name selectors wins. Pseudo-classes count as class names for specificity purposes.
3. **Type count** -- the selector with more type selectors wins.

### !important

Appending `!important` to a declaration value overrides normal specificity rules. That declaration wins regardless of selector specificity.

```css
Button:hover {
  background: blue !important;
}
```

Use sparingly; overuse makes stylesheets difficult to maintain.

## CSS Variables

Variables reduce repetition and improve consistency. They are prefixed with `$` and defined at the top level of a stylesheet.

```css
$border: wide green;

#foo {
  border: $border;
}
```

Variables can reference other variables:

```css
$success: lime;
$border: wide $success;
```

Variables can only be used in declaration values, not in selectors.

## The `initial` Value

All CSS properties support the special value `initial`, which resets the property to its default. Within `DEFAULT_CSS`, using `initial` treats the property as completely unstyled. Outside default CSS, `initial` resets to whatever the widget's `DEFAULT_CSS` defines.

```css
.dialog Button {
  background: initial;
}
```

## Nesting

Rule sets may be nested inside other rule sets. A nested rule inherits the selector from its enclosing rule set.

```css
#questions {
  .button {
    border: solid green;

    &.affirmative {
      background: darkgreen;
    }

    &.negative {
      background: darkred;
    }
  }
}
```

The above is equivalent to:

```css
#questions .button { border: solid green; }
#questions .button.affirmative { background: darkgreen; }
#questions .button.negative { background: darkred; }
```

### Nesting Selector (`&`)

The `&` character represents the selector of the enclosing rule set and concatenates (without a space) with the rest of the nested selector. Without `&`, a descendant combinator (space) is implied.

- `&.foo` inside `.button` produces `.button.foo` (same element must have both classes).
- `.foo` inside `.button` produces `.button .foo` (descendant relationship).

Nesting groups related rules, reduces selector repetition, and increases specificity.

## Programmatic Styles

Every widget exposes a `styles` object with attributes corresponding to CSS properties. Setting these attributes updates the display immediately.

```python
widget.styles.background = "darkblue"
widget.styles.border = ("heavy", "white")
```

### Colors

Color values may be specified as:

- Named constants: `"crimson"`, `"lime"`, `"palegreen"`, etc.
- Hex: `#f00`, `#9932CC`, `#9932CC7f` (with alpha).
- RGB: `rgb(255, 0, 0)`.
- RGBA: `rgba(192, 78, 96, 0.5)`.
- HSL: `hsl(0, 100%, 50%)`.
- `Color` objects for dynamic color construction.

Alpha (transparency) is supported via a fourth hex pair, the `rgba()` format, or the `a` parameter on `Color` objects. Alpha values range from 0 (transparent) to 1 (opaque). Translucent backgrounds blend with the color beneath; translucent text blends with the background.

### Dimensions

Widgets occupy a rectangular area controlled by:

- `width` / `height` -- explicit size.
- `padding` -- space inside the border around content. Accepts a single integer (all sides), a 2-tuple `(vertical, horizontal)`, or a 4-tuple `(top, right, bottom, left)`.
- `border` -- decorative border around padding and content.
- `margin` -- space outside the border. Margins of adjacent widgets overlap: when two widgets are next to each other, Textual uses the greater of the two margins, not the sum.

Together these form the box model.

#### Units

- Integer or float: cell units (columns/rows).
- `auto`: size to fit content. Widgets will wrap text and expand to accommodate it.
- `%`: percentage of parent dimension.
- `vw` / `vh`: percentage of terminal width/height.
- `w` / `h`: percentage of available (container) width/height.
- `fr`: fractional units. Textual divides available space by the sum of all `fr` values among siblings, then allocates proportionally. For example, siblings with `2fr` and `1fr` heights receive two-thirds and one-third of the space respectively.

Min/max constraints: `min-width`, `max-width`, `min-height`, `max-height`.

#### Box Sizing

- `border-box` (default): width/height includes padding and border; content area shrinks.
- `content-box`: width/height refers to content area only; padding and border add to total size.

### Border Types

Set via a tuple of `(type, color)`. Available types can be previewed with `textual borders` at the command line. Widgets also support `border_title` and `border_subtitle` attributes displayed within the border, aligned via `border-title-align` and `border-subtitle-align` (values: `left`, `right`, `center`).

### Outline

Similar to border but does not affect widget size; it overlaps the content area.
