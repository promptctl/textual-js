# textual.content

Content is a container for text with spans marked up with color/style. It is the Textual equivalent of Rich's `Text` object, with support for more Textual features. Unlike Rich `Text`, Content is **immutable** -- most methods return a new Content instance. This makes it similar to the builtin `str` and allows significant optimizations.

## Type Aliases

- `ContentType: TypeAlias = Union[Content, str]` -- Used where Content and str are interchangeable.
- `ContentText: TypeAlias = Union[Content, Text, str]` -- A type that may be used to construct Content from Rich Text, str, or Content.

## Module-Level Constants

- `ANSI_DEFAULT: Style` -- A Style for ANSI default background and foreground (both `Color(0, 0, 0, 0, ansi=-1)`).
- `TRANSPARENT_STYLE: Style` -- A null style (`Style()`).
- `EMPTY_CONTENT: Final` -- A singleton empty `Content("")` instance.

## Span

`Span(NamedTuple)` (`textual.content`) -- A style applied to a range of character offsets.

### Fields

- `start: int` -- Start character offset (inclusive).
- `end: int` -- End character offset (exclusive).
- `style: Style | str` -- The style to apply to the range.

### Methods

- `extend(cells: int) -> Span` -- Return a new Span with the `end` extended by the given number of cells. Returns self if `cells` is 0.

### Internal Methods

- `_shift(distance: int) -> Span` -- Shift the span by `distance` characters. Start is clamped to 0 for negative distances.

## Content

`Content(Visual)` (`textual.content`) -- Text content with marked-up spans. Decorated with `@total_ordering`.

### Constructor

- `__init__(text: str = "", spans: list[Span] | None = None, cell_length: int | None = None, strip_control_codes: bool = True)` -- Initialize a Content object. `text` is the string content. `spans` is an optional list of `Span` objects. `cell_length` is the precomputed cell length if known. `strip_control_codes` strips bell, backspace, vertical tab, form feed, and carriage return characters.

### Class Methods (Constructors)

- `empty() -> Content` -- Return the singleton `EMPTY_CONTENT`.
- `from_text(markup_content_or_text: ContentText, markup: bool = True) -> Content` -- Construct Content from a `str`, Rich `Text`, or `Content`. If `markup` is `True`, strings are parsed as markup. Returns Content unchanged if already Content. Raises `TypeError` for unsupported types.
- `from_markup(markup: str | Content, **variables: object) -> Content` -- Create Content from markup string, optionally with template variables. If `markup` is already Content, returns it (raises `ValueError` if variables are also provided). Optimizes for strings without `[` or variables.
- `from_rich_text(text: str | Text, console: Console | None = None) -> Content` -- Convert a Rich `Text` object (or str parsed as Rich markup) to Content. Uses the active app's console for style resolution if available.
- `styled(text: str, style: Style | str = "", cell_length: int | None = None, strip_control_codes: bool = True) -> Content` -- Create Content from text with a single style applied to the entire string. Returns `EMPTY_CONTENT` for empty text.
- `blank(width: int, style: Style | str | None = None) -> Content` -- Create Content consisting of `width` spaces, optionally styled. Returns `EMPTY_CONTENT` if `width` is 0.
- `assemble(*parts: str | Content | tuple[str, str | Style], end: str = "", strip_control_codes: bool = True) -> Content` -- Construct Content from a sequence of strings, Content instances, or `(text, style)` tuples. An optional `end` string is appended.

### Properties

- `markup -> str` -- (cached_property) Get the markup string that would recreate this Content instance. Inverse of `from_markup`.
- `spans -> Sequence[Span]` -- The sequence of spans. Must not be mutated.
- `cell_length -> int` -- The cell length of the content (computed on demand and cached).
- `plain -> str` -- The text as a plain string, without any style information.
- `without_spans -> Content` -- A copy of this Content with all spans removed. Returns self if already spanless.
- `first_line -> Content` -- The content up to the first newline. Returns self if there is no newline.

### Operators

- `__len__() -> int` -- Returns `len(self.plain)`.
- `__bool__() -> bool` -- Returns `True` if text is non-empty.
- `__hash__() -> int` -- Hash of the plain text only.
- `__eq__(other) -> bool` -- Compares plain text only (not spans). Works with `str` and `Content`.
- `__lt__(other) -> bool` -- Lexicographic comparison of plain text only.
- `__getitem__(slice: int | slice) -> Content` -- Index or slice the content, preserving spans. Step != 1 raises `TypeError`.
- `__add__(other: Content | str) -> Content` -- Concatenate with another Content or str.
- `__radd__(other: str) -> Content` -- Support `str + Content`.

### Content Manipulation Methods

- `simplify() -> Content` -- Join contiguous spans with the same style. Modifies internal state in-place (consistent with immutability). Returns self.
- `add_spans(spans: Sequence[Span]) -> Content` -- Return a new Content with additional spans appended.
- `is_same(content: Content) -> bool` -- Compare text and spans for identity. Unlike `==`, this also compares spans.
- `append(content: Content | str) -> Content` -- Append text or content. For many appends, prefer `join`.
- `append_text(text: str, style: Style | str = "") -> Content` -- Append styled text.
- `join(lines: Iterable[Content | str]) -> Content` -- Join an iterable of Content/str with self as separator. Works like `str.join`.
- `wrap(width: int, *, align: TextAlign = "left", overflow: TextOverflow = "fold") -> list[Content]` -- Wrap text to fit within `width` cells. Returns a list of Content lines.
- `fold(width: int) -> list[Content]` -- Fold content at a given cell width without word wrapping. Minimum width is 2.
- `split(separator: str = "\n", *, include_separator: bool = False, allow_blank: bool = False) -> list[Content]` -- Split into lines preserving styles. Results are cached.
- `divide(offsets: Sequence[int]) -> list[Content]` -- Divide content at given character offsets. Returns `len(offsets) + 1` pieces.
- `truncate(max_width: int, *, ellipsis: bool = False, pad: bool = False) -> Content` -- Truncate at a cell width. Optionally insert ellipsis or pad with spaces.
- `rstrip(chars: str | None = None) -> Content` -- Strip characters from the end.
- `rstrip_end(size: int) -> Content` -- Remove trailing whitespace beyond a given size.

### Padding and Alignment Methods

- `pad_left(count: int, character: str = " ") -> Content` -- Pad the left side with `count` characters.
- `pad_right(count: int, character: str = " ") -> Content` -- Pad the right side with `count` characters.
- `pad(left: int, right: int, character: str = " ") -> Content` -- Pad both sides.
- `extend_right(count: int, character: str = " ") -> Content` -- Add characters to the right, extending the style of the last character.
- `extend_style(spaces: int) -> Content` -- Add spaces at the end, extending spans that reach the end of the text.
- `center(width: int, ellipsis: bool = False) -> Content` -- Center-align to `width`, optionally truncating with ellipsis.
- `right(width: int, ellipsis: bool = False) -> Content` -- Right-align to `width`, optionally truncating with ellipsis.
- `right_crop(amount: int = 1) -> Content` -- Remove characters from the end.

### Styling Methods

- `stylize(style: Style | str, start: int = 0, end: int | None = None) -> Content` -- Apply a style to the text or a portion. Supports negative indexing. Style is applied after existing styles.
- `stylize_before(style: Style | str, start: int = 0, end: int | None = None) -> Content` -- Apply a style before existing styles (lower priority).
- `highlight_regex(highlight_regex: re.Pattern[str] | str, *, style: Style | str, maximum_highlights: int | None = None) -> Content` -- Apply a style to text matching a regular expression.

### Style Query Methods

- `get_style_at_offset(offset: int) -> Style` -- Get the combined style at a given character offset. Supports negative indexing.

### Tab Methods

- `expand_tabs(tab_size: int = 8) -> Content` -- Convert tabs to spaces, preserving styles and alignment.

### Rendering Methods

- `render(base_style: Style = Style.null(), end: str = "\n", parse_style: Callable[[str | Style], Style] | None = None) -> Iterable[tuple[str, Style]]` -- Render into an iterable of `(text, style)` pairs. Uses a stack-based approach to resolve overlapping spans.
- `render_segments(base_style: Style = Style.null(), end: str = "") -> list[Segment]` -- Render into a list of Rich `Segment` objects.
- `render_strips(width: int, height: int | None, style: Style, options: RenderOptions) -> list[Strip]` -- Render into a list of `Strip` objects. Part of the Visual protocol.

### Visual Protocol Methods

- `get_optimal_width(rules: RulesMap, container_width: int) -> int` -- Get optimal width (widest line). Adds `line_pad` from rules.
- `get_minimal_width(rules: RulesMap) -> int` -- Get minimal width (longest single word). Adds `line_pad` from rules.
- `get_height(rules: RulesMap, width: int) -> int` -- Get the height in lines when rendered at a given width.

### Internal Methods

- `_wrap_and_format(width, align, overflow, no_wrap, line_pad, tab_size, selection, selection_style, post_style, get_style) -> list[_FormattedLine]` -- Core wrapping and formatting logic. Handles word wrapping, folding, alignment, tab expansion, and selection highlighting.
- `_trim_spans(text: str, spans: list[Span]) -> list[Span]` -- (classmethod) Remove or clamp spans that extend past the end of the text.
- `_divide_spans(offsets: tuple[int, ...]) -> list[tuple[Span, int, int]]` -- Divide spans according to line offsets using binary search. Results are cached.

## _FormattedLine (Internal)

`_FormattedLine` (`textual.content`) -- A line of content with additional formatting information. Used internally within Content.

### Constructor

- `__init__(get_style, content, width, x=0, y=0, align="left", line_end=False, link_style=None)`

### Instance Attributes

- `get_style: Callable` -- Style resolver.
- `content: Content` -- The line's content.
- `width: int` -- Target width.
- `x: int` -- Horizontal offset.
- `y: int` -- Vertical offset (line number).
- `align: TextAlign` -- Text alignment.
- `line_end: bool` -- Whether this is the last line of a paragraph (affects justify alignment).
- `link_style: Style | None` -- Style for links.

### Properties

- `plain -> str` -- The plain text of the content.

### Methods

- `to_strip(style: Style) -> tuple[list[Segment], int]` -- Convert to a list of segments and total width. Handles left, center, right, and justify alignment.
