# Content and Strip

## Overview

Content and Strip are the two core rendering primitives in Textual. `Content` represents styled text (analogous to Rich's `Text` but immutable), while `Strip` represents a single horizontal line of rendered output (a list of Rich `Segment` objects). Together they form the rendering pipeline: widget content flows from markup strings or `Content` objects, through wrapping/formatting, into `Strip` instances that the compositor sends to the terminal.

## Content Class

**Module:** `textual.content`

`Content` is an immutable container for text with style spans. It extends `Visual` (the abstract base for all Textual visual objects). Because it is immutable, all mutation methods return new `Content` instances, enabling aggressive caching.

### Construction

| Constructor | Description |
|---|---|
| `Content(text, spans=None, cell_length=None)` | Plain text, no markup processing. Square brackets are literal. |
| `Content.from_markup(markup, **variables)` | Parses content markup tags into styled spans. Supports template variables via `$name` syntax (safe against injection). |
| `Content.from_text(value, markup=True)` | Accepts `str`, `Content`, or Rich `Text`. Converts as needed. |
| `Content.from_rich_text(text, console=None)` | Converts a Rich `Text` object into `Content`, translating Rich styles to Textual styles. |
| `Content.styled(text, style, cell_length=None)` | Creates content with the entire text wrapped in a single style. |
| `Content.blank(width, style=None)` | Creates content of `width` spaces with optional style. |
| `Content.empty()` | Returns the shared empty content singleton. |
| `Content.assemble(*parts, end="")` | Efficiently concatenates strings, `Content` objects, and `(text, style)` tuples into one `Content`. |

### Key Properties

| Property | Type | Description |
|---|---|---|
| `plain` | `str` | The raw text with no style information. |
| `cell_length` | `int` | Display width in terminal cells (computed on demand, cached). |
| `spans` | `Sequence[Span]` | Style spans applied to character ranges. Read-only. |
| `markup` | `str` | Inverse of `from_markup` -- reconstructs markup string from text+spans. |
| `without_spans` | `Content` | Same text with all spans removed. |
| `first_line` | `Content` | Text up to the first newline. |

### Manipulation Methods

All return new `Content` instances.

| Method | Description |
|---|---|
| `stylize(style, start=0, end=None)` | Apply a style over a character range. Appended after existing spans (takes priority). |
| `stylize_before(style, start=0, end=None)` | Apply a style over a character range, inserted before existing spans (lower priority). |
| `append(content)` | Append text or content. |
| `append_text(text, style="")` | Append a styled string. |
| `join(lines)` | Join an iterable of `Content`/`str`, using self as separator (like `str.join`). |
| `truncate(max_width, ellipsis=False, pad=False)` | Crop to cell width, optionally adding ellipsis or padding. |
| `pad_left(count, char=" ")` | Prepend padding characters. |
| `pad_right(count, char=" ")` | Append padding characters. |
| `pad(left, right, char=" ")` | Pad both sides. |
| `center(width, ellipsis=False)` | Center-align within a given width. |
| `right(width, ellipsis=False)` | Right-align within a given width. |
| `right_crop(amount=1)` | Remove characters from the end. |
| `extend_right(count, char=" ")` | Extend with chars using the style of the last character. |
| `extend_style(spaces)` | Add spaces with the style of the last character. |
| `rstrip(chars=None)` | Strip trailing characters. |
| `rstrip_end(size)` | Strip only trailing whitespace beyond a given size. |
| `expand_tabs(tab_size=8)` | Replace tabs with spaces, respecting tab stops. |
| `split(separator="\n", include_separator=False, allow_blank=False)` | Split into lines preserving styles. |
| `divide(offsets)` | Cut at character offsets, returning N+1 pieces. |
| `fold(width)` | Hard-fold into lines of at most `width` cells (no word wrapping). |
| `wrap(width, align="left", overflow="fold")` | Word-wrap with alignment and overflow handling. |
| `add_spans(spans)` | Append additional `Span` objects. |
| `simplify()` | Merge adjacent spans with identical styles (in-place optimization, safe because output is unchanged). |
| `highlight_regex(pattern, style, maximum_highlights=None)` | Apply a style to all regex matches. |

### Equality and Ordering

- `==` and `<` compare by **plain text only**, ignoring spans. This means Content sorts like strings.
- `is_same(other)` compares both text and spans for exact visual equality.
- `__hash__` is based on plain text only.

### Rendering

| Method | Description |
|---|---|
| `render(base_style, end="\n", parse_style=None)` | Yields `(text, Style)` tuples. Resolves span stacking via a style stack algorithm. |
| `render_segments(base_style, end="")` | Returns a list of Rich `Segment` objects suitable for terminal output. |
| `render_strips(width, height, style, options)` | **Visual protocol.** Wraps, formats, and converts content into `list[Strip]`. |

### Visual Protocol Integration

`Content` implements the `Visual` abstract class, providing:

- `render_strips(width, height, style, options)` -- wraps/formats text and returns strips.
- `get_optimal_width(rules, container_width)` -- width of the longest unwrapped line.
- `get_minimal_width(rules)` -- width of the longest single word.
- `get_height(rules, width)` -- number of lines after wrapping at the given width.

The `RenderOptions` dataclass carries:
- `get_style` -- callable to resolve CSS variables in style strings.
- `rules` -- the widget's style rules (text-align, text-overflow, text-wrap, line-pad).
- `selection` / `selection_style` -- optional text selection range and highlight style.
- `post_style` -- optional style applied after rendering.

## Span

**NamedTuple:** `Span(start: int, end: int, style: Style | str)`

Represents a style applied to character offsets `[start, end)` within a `Content`'s plain text. Spans may overlap; resolution uses a stack-based algorithm where later spans in the list take priority.

Methods:
- `extend(cells)` -- returns a new Span with the end extended by `cells`.

## Content Markup

Markup is specified as text with square-bracket tags that modify styling. It is parsed by `Content.from_markup()`.

### Markup Playground

Textual includes an interactive markup playground for experimenting with content markup. Launch it with:

```
python -m textual.markup
```

The playground provides a textarea for entering markup and a live preview pane showing the rendered result. A "Variables" tab allows experimenting with template variable substitution.

### Tag Syntax

- **Opening:** `[bold]`, `[italic]`, `[red]`, `[on blue]`, etc.
- **Closing:** `[/bold]`, `[/italic]`, or auto-close `[/]` (closes the most recent tag).
- Tags can be **combined:** `[bold italic]` applies both styles.
- **Nesting:** overlapping tags combine their styles.

### Supported Styles

| Style | Abbreviation |
|---|---|
| `bold` | `b` |
| `dim` | `d` |
| `italic` | `i` |
| `underline` | `u` |
| `strike` | `s` |
| `reverse` | `r` |

Styles can be inverted with `not`, e.g. `[not bold]`.

### Colors

- Any CSS `<color>` value: `[#ff0000]`, `[rgba(0,255,0)]`, named colors like `[chartreuse]`.
- Alpha component for transparency: `[rgba(0,255,0,0.5)]` or percentage shorthand `[red 50%]`.
- `auto` picks white or black for best contrast.
- Background colors prefixed with `on`: `[on #ff0000]`, `[on blue 20%]`.
- CSS variables: `[$accent]`, `[$warning on $warning-muted]`.

### Links and Actions

- `[link="https://..."]text[/link]` -- clickable hyperlink (terminal support required).
- `[@click=app.bell]text[/]` -- runs a Textual action on click.

### Escaping

- Precede `[` with `\` to prevent tag interpretation: `\[bold]` renders as literal `[bold]`.
- Use `textual.markup.escape()` programmatically.
- Methods with a `markup` parameter (e.g., `notify(text, markup=False)`) can disable markup.

### Template Variables

`Content.from_markup("Hello $name", name=user_input)` substitutes variables safely -- any square brackets in the variable values are treated as literal text, preventing injection of style tags.

## Strip Class

**Module:** `textual.strip`

A `Strip` is an immutable horizontal line of Rich `Segment` objects. It is the fundamental output unit of the rendering pipeline -- widgets produce strips, the compositor arranges them, and the driver writes them to the terminal.

### Construction

| Constructor | Description |
|---|---|
| `Strip(segments, cell_length=None)` | From an iterable of `Segment`. Cell length computed on demand if not provided. |
| `Strip.blank(cell_length, style=None)` | Spaces of given width. Cached via `lru_cache`. |
| `Strip.from_lines(lines, cell_length=None)` | Convert a list of segment lists into strips. |
| `Strip.join(strips)` | Concatenate multiple strips into one. |

### Key Properties

| Property | Type | Description |
|---|---|---|
| `cell_length` | `int` | Display width in terminal cells (O(n), cached). |
| `cell_count` | `int` | Sum of character counts across segments. |
| `text` | `str` | Concatenated segment text. |
| `link_ids` | `set[str]` | Set of link IDs present in segment styles. |

### Manipulation Methods

All return new `Strip` instances (immutability enables caching).

| Method | Description |
|---|---|
| `crop(start, end=None)` | Slice between two cell positions. Cached. |
| `crop_extend(start, end, style)` | Crop with automatic extension if strip is shorter than `end`. |
| `divide(cuts)` | Split at cell positions into multiple strips. Cached. |
| `adjust_cell_length(cell_length, style=None)` | Pad or truncate to exact cell width. Cached. |
| `extend_cell_length(cell_length, style=None)` | Pad to minimum cell width (never truncates). |
| `simplify()` | Merge adjacent segments with identical styles. |
| `apply_style(style)` | Apply a Rich `Style` to all segments. Cached. |
| `apply_meta(meta)` | Apply metadata dict to all segments (via `Style.from_meta`). |
| `apply_filter(filter, background)` | Apply a `LineFilter` (e.g., dimming, focus effects). Cached. |
| `style_links(link_id, link_style)` | Apply hover style to segments matching a link ID. |
| `crop_pad(cell_length, left, right, style)` | Combined crop-to-width and pad operation. |
| `text_align(width, align)` | Pad to width with left/center/right alignment. |
| `apply_offsets(x, y)` | Attach cell-position metadata for text selection. |
| `discard_meta()` | Remove all meta from segment styles. |

### Operators

- `strip_a + strip_b` -- concatenation via `Strip.join`.
- `strip[start:end]` -- cell-position slicing via `crop`.
- `len(strip)` -- number of segments.
- `iter(strip)` -- iterates over `Segment` objects.
- `bool(strip)` -- `True` if strip has any segments.

### Alignment

`Strip.align(strips, style, width, height, horizontal, vertical)` is a class method that arranges a list of strips within a bounding box, adding padding for horizontal (left/center/right) and vertical (top/middle/bottom) alignment.

### Rendering to Terminal

`Strip.render(console)` converts segments into an ANSI escape sequence string, cached after first call. Uses `render_ansi(style, color_system)` and `render_style(style, text, color_system)` as low-level helpers.

### StripRenderable

`StripRenderable(strips, width=None)` is a Rich renderable wrapper around a list of strips, allowing them to be printed with `rich.print()` or rendered by a Rich `Console`.

## Rendering Pipeline

The full path from widget content to terminal output:

1. **Widget.render()** returns a `str` (markup), `Content`, Rich `Text`, or any Rich renderable.
2. **visualize()** converts the render result into a `Visual` instance:
   - `str` -> `Content.from_markup(str)` (or `Content(str)` if markup disabled).
   - `Content` -> returned as-is (already a `Visual`).
   - Rich `Text` -> `Content.from_rich_text(text)`.
   - Other Rich renderables -> wrapped in `RichVisual`.
3. **Visual.render_strips()** converts the visual into `list[Strip]`:
   - For `Content`: wraps text, applies alignment/overflow rules, resolves styles, produces strips.
   - For `RichVisual`: renders through Rich's console protocol into segments, then wraps in strips.
4. **Compositor** crops, offsets, and layers strips for each widget's screen region.
5. **Driver** calls `Strip.render(console)` to produce ANSI sequences written to the terminal.

## Visual Protocol

`Visual` is the abstract base class for renderable objects in Textual. It requires:

- `render_strips(width, height, style, options) -> list[Strip]`
- `get_optimal_width(rules, container_width) -> int`
- `get_height(rules, width) -> int`

Optional:
- `get_minimal_width(rules) -> int` (defaults to 1).

The `SupportsVisual` protocol allows any object to participate by exposing a `visualize(widget, obj)` method that returns a `Visual`.

## Type Aliases

| Alias | Definition | Usage |
|---|---|---|
| `ContentType` | `Content \| str` | Parameters accepting content or plain strings. |
| `ContentText` | `Content \| Text \| str` | Parameters accepting content, Rich Text, or strings. |
| `VisualType` | `RenderableType \| SupportsVisual \| Visual` | Anything that can produce visual output. |

## Caching Strategy

Both `Content` and `Strip` use `FIFOCache` instances on their internal fields to memoize expensive operations (divide, crop, style application, split, rendering). Immutability is the enabler -- because neither object changes after construction, cached results remain valid indefinitely. `Strip.blank` and `Strip.render_ansi` additionally use `lru_cache` for cross-instance sharing.
