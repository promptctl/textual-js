# Content and Strip

Content and Strip are the low-level rendering primitives in Textual. `Content` represents styled text with span-based formatting. `Strip` wraps a sequence of Rich `Segment` objects into a single horizontal line. The `_segment_tools` module provides utility functions for manipulating raw segment lists.

## Content

### Construction

- `Content("")` produces blank content: `str` is `""`, `plain` is `""`, `bool` is `False`, `markup` is `""`, `len` is `0`, `spans` is `[]`.
- `Content("foo")` produces unstyled content: `str` is `"foo"`, `plain` is `"foo"`, `bool` is `True`, `len` is `3`, `spans` is `[]`.
- `Content.styled("Hello", "red")` creates content with a single span covering the full text. The span is `Span(0, 5, "red")`.
- `Content.from_markup("[red]Hello[/red] [blue]World[/blue]")` parses inline markup tags into spans. Plain text is `"Hello World"` with two spans for the respective styles.
- `Content.from_rich_text(text)` converts a Rich `Text` object into `Content`, translating Rich styles into Textual `Style` objects with `Color` values.
- `Content.from_text(value)` accepts a markup string, an existing `Content` (returned as-is), or a Rich `Text` object. When `markup=False` is passed, tags are treated as literal text.
- `Content.assemble(...)` accepts a mix of plain strings, `Content` objects, and `(text, style)` tuples, concatenating them into a single `Content` with correct span offsets.
- `Content.blank(width, style=None)` produces content of the given width filled with spaces. When a style is provided, a single span covers the full width.
- `Content(text, spans=[...])` accepts an explicit list of `Span` objects at construction time.

### Properties

- `plain` returns the raw text without any style information.
- `cell_length` returns the display width in terminal cells. Double-width characters (e.g., emoji) count as 2: `Content("💩").cell_length == 2`.
- `markup` returns a round-trippable markup string. Parsing markup and reading it back produces the original markup.
- `spans` returns the list of `Span` objects applied to the content.
- `first_line` returns a new `Content` containing only the text before the first newline, with spans clipped accordingly.

### Truthiness and Equality

- Empty content is falsy; non-empty content is truthy.
- `Content` supports equality with other `Content` instances and with plain strings: `Content("foo") == "foo"` is `True`.
- `Content` supports sorting via `functools.total_ordering`, ordered by plain text.

### Styling

- `stylize(style)` with no position arguments applies the style to the full text. It returns a new `Content`; the original is unchanged.
- `stylize(style, start, end)` applies the style to a sub-range, appending a new span after existing spans.
- `stylize_before(style, start, end)` inserts the span before existing spans rather than after, giving it lower priority.
- `add_spans(spans)` appends a list of additional `Span` objects to the existing spans.

### Indexing and Slicing

- `content[0]` returns a single-character `Content` with spans clipped to that character.
- `content[-1]` indexes from the end.
- `content[:2]` slices the content, clipping spans to the slice boundaries.

### Concatenation

- `Content + Content` concatenates text and adjusts span offsets in the right operand.
- `Content + str` and `str + Content` are supported via `__add__` and `__radd__`. Spans from the `Content` operand are offset correctly.
- Concatenating styled pieces preserves all spans: `Content.styled("foo", "red") + " " + Content.styled("bar", "blue")` yields spans `[Span(0, 3, "red"), Span(4, 7, "blue")]`.

### Join

- `Content(separator).join(pieces)` joins an iterable of strings or `Content` objects with the separator.
- Joining an empty list returns `""`. Joining a single item returns that item.
- Spans from each piece are offset to their position in the joined result.

### Truncation

- `truncate(width)` clips content to the given cell width.
- `truncate(width, ellipsis=True)` replaces the last character with an ellipsis when truncation occurs. At width 0 with ellipsis, the result is empty. At width 1 with ellipsis, the result is a single ellipsis character.
- `truncate(width, pad=True)` pads with spaces when the content is shorter than the requested width.
- Truncating to a width greater than or equal to the content length returns the content unchanged (unless `pad=True`).

### Wrapping and Folding

- `wrap(width)` performs word-wrapping, splitting at word boundaries. Each resulting line is a separate `Content` with spans adjusted to local offsets starting at 0.
- `fold(width)` performs hard-wrapping at exact cell positions, ignoring word boundaries. It correctly handles double-width characters: a wide character that would straddle the boundary is pushed to the next line.
- Both methods return a `list[Content]`.
- Folding empty content returns `[Content("")]`. Folding content shorter than the width returns a single-element list.

### Tab Expansion

- `expand_tabs(tab_width)` replaces tab characters with spaces aligned to tab stops. Spans after a tab are offset to account for the expanded width.
- Tab stops are calculated from the start of the line. A tab at column 0 with width 8 expands to 8 spaces; a tab at column 1 expands to 7 spaces.
- Tabs within multi-line content (containing `\n`) are expanded per-line.

### Rendering

- `render_strips(y, width, base_style, render_options)` renders the content into a list of `Strip` objects. Content that contains tab characters is expanded during rendering without error.

### Simplification

- `simplify()` merges adjacent spans that share the same style into a single span. This is a mutating operation on the content.

### Control Code Handling

- Carriage return characters (`\r`) are stripped from content on construction. `Content("foo\r\nbar").plain` yields `"foo\nbar"`.

### Markup Escaping

- A backslash before an opening square bracket (`\[`) escapes it, producing a literal `[` in the plain text with no style span. This works for all bracket patterns: `\[`, `\[foo]`, `\[/foo]`, `\[]`, `\[0]`.

## Strip

### Construction

- `Strip(segments)` wraps a list of Rich `Segment` objects. Cell length is lazily computed on first access.
- `Strip.join(strips)` concatenates multiple strips into one, merging their segment lists.

### Properties and Protocol

- `cell_length` returns the total display width across all segments. It is cached after first computation.
- `text` returns the concatenated text of all segments: `Strip([Segment("foo"), Segment("bar")]).text == "foobar"`.
- `len(strip)` returns the number of segments (not the cell length).
- `bool(strip)` is `False` for an empty segment list, `True` otherwise.
- Strips support iteration, reversed iteration, and equality comparison.
- `repr(strip)` includes the segment list and cell length.

### Cell Length Adjustment

- `adjust_cell_length(target)` pads with spaces or crops to fit exactly the target cell width. When cropping cuts through a double-width character, it is replaced with a single space.
- `extend_cell_length(target)` pads with spaces if the strip is shorter than the target. If the strip is already at or above the target width, it is returned unchanged (no cropping).

### Cropping

- `crop(start, end)` extracts a horizontal sub-range by cell position. Segments that straddle the boundaries are split.
- Cropping beyond the strip's length returns the available content without error.
- Cropping a range entirely outside the strip returns an empty strip.

### Division

- `divide(cuts)` splits a strip at the given cell positions, returning a list of sub-strips.

### Index to Cell Position

- `index_to_cell_position(index)` maps a character index (across all segments) to its cell position, accounting for double-width characters.
- Raises `NoCellPositionForIndex` when the strip has no segments or the index exceeds the total character count.

### Simplification

- `simplify()` merges adjacent segments that share the same style into a single segment.

### Filtering

- `apply_filter(filter, background)` transforms segment styles through a filter (e.g., `Monochrome`), returning a new strip.

### Link Styling

- `style_links(link_id, hover_style)` applies an additional style to segments whose style matches the given link ID.

### Rendering

- `render(console)` produces a string representation of the strip via the Rich console. Segments with no explicit style are rendered without error.

## Segment Tools

### line_crop

- `line_crop(segments, start, end, total)` extracts a horizontal slice from a list of segments by cell position. Segments that straddle the crop boundaries are split, preserving their style.
- When a crop boundary falls in the middle of a double-width character (e.g., emoji), the character is replaced with a space to maintain alignment.
- Cropping beyond the total length returns an empty list.

### line_trim

- `line_trim(segments, left, right)` removes exactly one cell from the left, the right, or both sides of the segment list.
- Trimming an empty list returns an empty list.

### line_pad

- `line_pad(segments, left, right, style)` prepends and/or appends padding segments of the given width and style.
- When both left and right are 0, the original segment list is returned unchanged.

### align_lines

- `align_lines(lines, style, size, horizontal, vertical)` positions a list of segment lines within a bounding box defined by `Size`.
- Horizontal alignment supports `"left"`, `"center"`, and `"right"`. Padding segments are added to the appropriate side(s).
- Vertical alignment supports `"top"` and `"middle"`. Blank lines of the full width fill the remaining vertical space.
- When content fits the available space exactly, no extra padding segments are produced.

## Constraints

- `Content` is immutable with respect to its callers: `stylize`, `stylize_before`, `truncate`, `wrap`, `fold`, `expand_tabs`, slicing, and concatenation all return new `Content` instances. The exception is `simplify()`, which mutates in place.
- `Span` positions use character indices, not cell positions. Double-width characters occupy one index but two cells.
- `Strip.cell_length` is lazily computed and cached. It must not be set externally.
- `line_crop` requires the caller to provide the pre-computed `total` cell length of the segment list.
- `adjust_cell_length` replaces a double-width character with a space when cropping falls on its second cell, preserving the target width exactly.
- `NoCellPositionForIndex` is raised rather than returning a sentinel when `index_to_cell_position` receives an invalid index.
- Markup escaping uses `\[` (backslash before opening bracket). All other bracket patterns are parsed as style tags.
- Control codes (`\r`) are stripped at construction time in both `Content()` and `Content.from_markup()`.
