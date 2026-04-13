# Style

## Overview

**Module:** `textual.style`

The `Style` class represents visual styling in Textual's rendering pipeline (the Visual interface). It is a frozen dataclass holding color, text decoration, link, and meta information. Styles compose via addition: `style_a + style_b` merges attributes, with the right-hand side taking precedence for most fields while backgrounds alpha-composite.

This is distinct from Rich's `Style` -- it is Textual's own style type optimized for the framework's rendering needs.

---

## `Style`

Frozen dataclass decorated with `@rich.repr.auto()`.

### Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `background` | `Color \| None` | `None` | Background color. |
| `foreground` | `Color \| None` | `None` | Foreground (text) color. |
| `bold` | `bool \| None` | `None` | Bold text. `None` means unset (inherit). |
| `dim` | `bool \| None` | `None` | Dim text. |
| `italic` | `bool \| None` | `None` | Italic text. |
| `underline` | `bool \| None` | `None` | Single underline. |
| `underline2` | `bool \| None` | `None` | Double underline. |
| `reverse` | `bool \| None` | `None` | Reverse video. |
| `strike` | `bool \| None` | `None` | Strikethrough. |
| `blink` | `bool \| None` | `None` | Blinking text. |
| `link` | `str \| None` | `None` | Hyperlink URL. |
| `_meta` | `bytes \| None` | `None` | Pickled meta dictionary. Private field. |
| `auto_color` | `bool` | `False` | Whether foreground auto-adjusts for contrast against background. |

### Properties

| Property | Type | Description |
|---|---|---|
| `hash` | `int` | Cached hash of style attributes. |
| `style_definition` | `str` | Human-readable style string that can round-trip through `Style.parse`. |
| `markup_tag` | `str` | Normalized identifier for matching opening/closing tags in markup. |
| `rich_style` | `RichStyle` | Converts to a Rich `Style` object. Foreground is composited against background. Cached. |
| `without_color` | `Style` | Same style with `background` and `foreground` set to `None`. Cached. |
| `background_style` | `Style` | Style containing only the background color and meta. Cached. |
| `has_transparent_foreground` | `bool` | `True` if foreground is `None` or fully transparent (`a == 0`). |
| `meta` | `Mapping[str, Any]` | Deserialized meta dictionary. Empty dict if `_meta` is `None`. Cached. |

### Dunder Methods

| Method | Behavior |
|---|---|
| `__hash__` | Delegates to `self.hash`. |
| `__eq__` | Compares by hash value. |
| `__bool__` | `False` if the style is null (all simple attributes are `None`). |
| `__str__` | Returns `style_definition`. |
| `__add__(other)` | Combines two styles. LRU-cached (4096 entries). `None` right-hand side returns self. |
| `__radd__` | Same as `__add__` (commutative identity with `None`). |

### Addition Semantics

When two styles are combined via `+`:

- **Background:** Alpha-composites (`self.background + other.background`). If self background is `None` or fully transparent, uses other's background directly.
- **Foreground:** Right-hand side wins if non-`None` and non-transparent.
- **Boolean attributes** (bold, dim, italic, etc.): Right-hand side wins if not `None`.
- **Link:** Right-hand side wins if not `None`.
- **Meta:** Dictionaries are merged (`{**self.meta, **other.meta}`). If only one side has meta, that side's raw bytes are used directly.

### Class Methods

#### `Style.null()`

Returns the module-level `NULL_STYLE` singleton -- a `Style()` with all defaults.

#### `Style.parse(text_style, variables=None)`

Parses a style from a string representation.

| Parameter | Type | Description |
|---|---|---|
| `text_style` | `str` | Style encoded as text (e.g. `"bold italic #ff0000 on #000000"`). |
| `variables` | `dict[str, str] \| None` | CSS variable mappings. `None` attempts to retrieve from the active app. |

**Returns:** `Style`

Uses the active app's stylesheet parser when an app is available, otherwise falls back to `textual.markup.parse_style`.

#### `Style.from_rich_style(rich_style, theme=None)`

Builds a `Style` from a Rich `Style` object.

| Parameter | Type | Description |
|---|---|---|
| `rich_style` | `RichStyle` | A Rich Style. |
| `theme` | `TerminalTheme \| None` | Optional terminal theme for color conversion. |

**Returns:** `Style`

#### `Style.from_styles(styles)`

Creates a `Style` from a Textual `StylesBase` object (e.g. `widget.styles`).

| Parameter | Type | Description |
|---|---|---|
| `styles` | `StylesBase` | A Textual styles object. |

**Returns:** `Style`

Extracts background, foreground (with auto-color support), and all text decoration attributes.

#### `Style.from_meta(meta)`

Creates a `Style` containing only meta information.

| Parameter | Type | Description |
|---|---|---|
| `meta` | `Mapping[str, Any]` | Dictionary of meta information. |

**Returns:** `Style` with only `_meta` set.

#### `Style.combine(styles)`

Combines an iterable of styles by summing them left to right.

| Parameter | Type | Description |
|---|---|---|
| `styles` | `Iterable[Style]` | Styles to combine. Must be non-empty. |

**Returns:** `Style`

### Instance Methods

#### `rich_style_with_offset(x, y)`

Returns a Rich `Style` with offset meta `{"offset": (x, y)}` merged in. Used for text selection.

| Parameter | Type | Description |
|---|---|---|
| `x` | `int` | X coordinate. |
| `y` | `int` | Y coordinate. |

**Returns:** `RichStyle`

---

## Module-Level Constants

### `NULL_STYLE`

A `Style()` instance with all defaults. Used as the canonical null/empty style throughout the framework.
