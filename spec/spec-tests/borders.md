# Borders

The border system handles rendering of widget borders, border labels (titles and subtitles), and the composition of box-drawing characters when adjacent widgets share edges.

## Border Row Rendering

### `render_row`

`render_row` produces segments for a single horizontal border row given a three-tuple of segments (left corner, edge, right corner), a width, and flags indicating whether each corner is present.

- When neither corner is present, the output is a single segment consisting of the edge character repeated `width` times.
- When only the left corner is present, the output is the left corner segment followed by the edge character repeated `width - 1` times.
- When only the right corner is present, the output is the edge character repeated `width - 1` times followed by the right corner segment.
- When both corners are present, the output is the left corner, the edge character repeated `width - 2` times, and the right corner.

## Border Labels (Title and Subtitle)

### Setting Labels

- `border_title` and `border_subtitle` are properties on `Widget`.
- A widget's initial `border_title` is `None`. Setting it to `None` keeps it `None`.
- Setting to an empty string stores the empty string.
- Labels are always coerced to a single line. Any newline (`\n`), carriage-return-newline (`\r\n`), or newline-carriage-return (`\n\r`) sequence truncates the value to the text before the first line break.
- Markup strings are supported. When markup spans a line break, only the markup up to the break is retained, and open tags are auto-closed (e.g., `"[red]This also \n works"` becomes `"[red]This also [/red]"`).
- Rich `Text` objects are accepted and converted to markup strings (e.g., `Text.from_markup("[bold]Hello World")` becomes `"[bold]Hello World[/bold]"`).

### Class-Level Defaults

- `BORDER_TITLE` and `BORDER_SUBTITLE` class variables on a `Widget` subclass set the initial values for `border_title` and `border_subtitle` on every instance of that subclass.

### Rendering Labels via `render_border_label`

- An empty label (no visible text) produces no segments, regardless of width or corner configuration. This includes markup-only labels with no printable characters (e.g., `"[b][/]"`, `"[blue]"`).
- A label requires a minimum width to render. The minimum is the label's text length plus two blank-space characters (one on each side) plus the space consumed by whichever corners are present. If the available width is insufficient, the label is skipped entirely (no segments produced).
  - With both corners, a 3-character label like `"hey"` requires at least width 5 with no corners, 6 with one corner, or 7 with both corners. Widths below this threshold produce no output.
- When width is sufficient, the label is rendered with one blank space on each side. The blank spaces inherit the border style.
- Label text supports Rich markup styling. Styled segments are produced individually, each combining the border style with the label's own style. Style composition uses additive merging (`border_style + label_style`).
- When the label is too long for the available width, it is truncated with an ellipsis character (`…`). The truncated text plus ellipsis fits exactly within the allocated space.

## Box Drawing Character Composition

### Quad Representation

Box-drawing characters are represented as 4-tuples (quads) of integers, where each element corresponds to one arm of the character: the weight or style of the line extending in each of the four cardinal directions.

- A value of `0` means no line extends in that direction.
- Non-zero values represent line weights or styles (e.g., `1` for thin/light, `2` for thick/heavy).

### `combine_quads`

`combine_quads` merges two quad representations into one, used when adjacent borders share a character cell.

- For each direction, if either quad has a `0` (no line), the result takes the non-zero value from the other quad.
- If both quads have a non-zero value in the same direction, the smaller (lighter) value wins: `(0,0,0,2)` combined with `(0,0,0,1)` yields `(0,0,0,1)`.
- If both quads are all zeros, the result is all zeros.
- Results are cached: calling `combine_quads` with the same inputs a second time returns the same result.

## Constraints

- Border labels are always single-line; multiline input is silently truncated at the first line break.
- Labels with no visible text (empty string or markup-only with no printable characters) never produce rendered output.
- Label rendering requires a minimum width that accounts for corner presence and padding spaces; below this threshold the label is omitted entirely rather than partially rendered.
- Label overflow is handled by truncation with an ellipsis, never by wrapping.
- Quad combination is deterministic and cached. For conflicting non-zero values in the same direction, the smaller (lighter) value wins.
- Border styles compose additively with label styles; the border style is the base and label styling layers on top.
