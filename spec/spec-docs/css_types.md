# CSS Value Types

Textual CSS properties accept typed values. Each type is denoted by a keyword in angle brackets (e.g., `<color>`) in the formal syntax sections of the styles reference. This spec documents every CSS value type, its syntax, and its valid values.

## `<name>`

A identifier token: a non-empty sequence of characters starting with a letter (`a-z`, `A-Z`) or underscore (`_`), followed by zero or more letters, digits (`0-9`), underscores, or hyphens (`-`).

Examples: `onlyLetters`, `Letters-and-hyphens`, `_lead_under`, `letters-1-digit`

## `<integer>`

Any valid integer, positive or negative (e.g., `-10`, `42`). Individual CSS rules may impose bounds.

Python type: `int`.

## `<number>`

A real number: an `<integer>` optionally followed by a decimal point and one or more digits (e.g., `0.5`, `3`). Supertype of `<integer>`.

Python type: `int` or `float`.

## `<percentage>`

A `<number>` immediately followed by `%` (no space). Represents a relative value. Some rules clamp to `0%`..`100%`.

Examples: `70%`, `-30%`, `12.5%`

Not to be confused with `<scalar>` (which also accepts `%` but supports additional units).

## `<scalar>`

Represents a length. A `<number>` with a unit suffix, or the keyword `auto`. Used by `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height`, and other size/offset rules.

| Unit | Name | Description |
|------|------|-------------|
| *(none)* | Cell | Absolute cell count (columns or rows). Floats truncated to int. |
| `fr` | Fraction | Proportional share of remaining space (e.g., `1fr`, `3fr`). |
| `%` | Percent | Percentage of the container's corresponding dimension. |
| `w` | Width | Percentage of the container's **width** (usable on both axes). |
| `h` | Height | Percentage of the container's **height** (usable on both axes). |
| `vw` | Viewport width | Percentage of the viewport width (terminal width minus docked left/right widgets). |
| `vh` | Viewport height | Percentage of the viewport height (terminal height minus docked top/bottom widgets). |
| `auto` | Auto | Computes optimal size to fit content without scrolling. |

Examples: `60`, `1fr`, `50%`, `25w`, `75vh`, `auto`

Python: integers/floats set cell units directly; strings set any unit (e.g., `"1fr"`, `"50%"`).

## `<color>`

Represents a color value. Accepted formats:

| Format | Syntax | Example |
|--------|--------|---------|
| Named color | A recognized color name | `red`, `dodgerblue` |
| Hex RGB (3 digit) | `#RGB` | `#A2F` (expands to `#AA22FF`) |
| Hex RGB (6 digit) | `#RRGGBB` | `#F35573` |
| Hex RGBA (4 digit) | `#RGBA` | `#F35A` |
| Hex RGBA (8 digit) | `#RRGGBBAA` | `#F35573A0` |
| RGB function | `rgb(r, g, b)` | `rgb(23, 78, 200)` — channels 0-255 |
| RGBA function | `rgba(r, g, b, a)` | `rgba(0, 255, 32, 0.5)` — alpha 0-1 |
| HSL function | `hsl(h, s%, l%)` | `hsl(290, 70%, 80%)` — hue 0-360 |
| HSLA function | `hsla(h, s%, l%, a)` | `hsla(128, 100%, 50%, 0.5)` — alpha 0-1 |
| CSS variable | `$variable-name` | `$accent`, `$primary` |

Textual's default themes provide many CSS variables with predefined colors.

Python: accepts color strings or `textual.color.Color` instances. `Color.parse(...)` can parse any CSS color string.

## `<border>`

A border style keyword. Used by `border`, `border-top`, `border-right`, `border-bottom`, `border-left`, `outline`, and related rules. Typically paired with a `<color>`.

| Value | Description |
|-------|-------------|
| `ascii` | Plus, hyphen, and vertical bar characters. |
| `blank` | Invisible border (reserves space). |
| `dashed` | Dashed line. |
| `double` | Double line. |
| `heavy` | Heavy (thicker) line. |
| `hidden` | Alias for `none`. |
| `hkey` | Horizontal key-line border. |
| `inner` | Thick solid border. |
| `none` | No border. |
| `outer` | Solid with additional space around content. |
| `panel` | Solid with thick top. |
| `round` | Rounded corners. |
| `solid` | Standard solid border. |
| `tall` | Solid with extra space top and bottom. |
| `thick` | Consistently thick across all edges. |
| `vkey` | Vertical key-line border. |
| `wide` | Solid with extra space left and right. |

The `textual borders` CLI command displays all border types interactively.

## `<hatch>`

A hatching pattern character used by the `hatch` rule. Paired with a `<color>`.

| Value | Description |
|-------|-------------|
| `cross` | Diagonal crossed lines. |
| `horizontal` | Horizontal lines. |
| `left` | Left-leaning diagonal lines. |
| `right` | Right-leaning diagonal lines. |
| `vertical` | Vertical lines. |

## `<keyline>`

A line style for the `keyline` rule. Paired with a `<color>`.

| Value | Description |
|-------|-------------|
| `none` | No keyline (disabled). |
| `thin` | Thin line. |
| `heavy` | Heavy (thicker) line. |
| `double` | Double line. |

## `<horizontal>`

A horizontal alignment position.

| Value | Description |
|-------|-------------|
| `left` | Left-aligned (default). |
| `center` | Center-aligned. |
| `right` | Right-aligned. |

## `<vertical>`

A vertical alignment position.

| Value | Description |
|-------|-------------|
| `top` | Top-aligned (default). |
| `middle` | Middle-aligned. |
| `bottom` | Bottom-aligned. |

## `<text-align>`

Text alignment within a widget.

| Value | Description |
|-------|-------------|
| `left` | Left alignment. |
| `center` | Center alignment. |
| `right` | Right alignment. |
| `justify` | Justified text. |
| `start` | Alias for `left` (will map to RTL-aware start when supported). |
| `end` | Alias for `right` (will map to RTL-aware end when supported). |

## `<text-style>`

Visual styles applied to text. Value is `none` for unstyled text, or a space-separated combination of one or more of the following:

| Value | Description |
|-------|-------------|
| `bold` | Bold text. |
| `italic` | Italic text. |
| `reverse` | Reverse video (swap foreground/background). |
| `strike` | Strikethrough text. |
| `underline` | Underlined text. |

Values can be combined: `bold italic underline`.

## `<overflow>`

Overflow behavior for scrollable containers.

| Value | Description |
|-------|-------------|
| `auto` | Automatically determine overflow behavior. |
| `hidden` | Clip content; no scrolling. |
| `scroll` | Allow scrolling when content overflows. |

## `<position>`

Determines how the `offset` rule is applied to a widget.

| Value | Description |
|-------|-------------|
| `relative` | Offset from the widget's normal layout position. |
| `absolute` | Offset from the origin (top-left) of the container. |

## `<pointer>`

Mouse cursor shape displayed when hovering over a widget. Requires terminal support for the Kitty pointer shapes protocol.

| Value | Description |
|-------|-------------|
| `default` | Default pointer. |
| `pointer` | Pointing hand (links). |
| `text` | I-beam (text selection). |
| `crosshair` | Crosshair. |
| `help` | Help (question mark). |
| `wait` | Busy/wait. |
| `progress` | Background activity. |
| `move` | Four-directional arrows. |
| `grab` | Open hand (grabbable). |
| `grabbing` | Closed hand (grabbing). |
| `cell` | Cell selection. |
| `vertical-text` | Vertical text selection. |
| `alias` | Alias/shortcut. |
| `copy` | Copy. |
| `no-drop` | No drop allowed. |
| `not-allowed` | Prohibited. |
| `n-resize` | North resize. |
| `s-resize` | South resize. |
| `e-resize` | East resize. |
| `w-resize` | West resize. |
| `ne-resize` | Northeast resize. |
| `nw-resize` | Northwest resize. |
| `se-resize` | Southeast resize. |
| `sw-resize` | Southwest resize. |
| `ew-resize` | Horizontal resize. |
| `ns-resize` | Vertical resize. |
| `nesw-resize` | Diagonal NE-SW resize. |
| `nwse-resize` | Diagonal NW-SE resize. |
| `zoom-in` | Zoom in (magnifier with +). |
| `zoom-out` | Zoom out (magnifier with -). |
