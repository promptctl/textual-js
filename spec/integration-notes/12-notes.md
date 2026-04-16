# Integration notes for spec-src/12-supporting-subsystems.md

## Critical context

- **Rich-js role**: This is where rich-js is MOST central. `Color` type IS rich-js `Color`. Renderables (`Bar`, `Gradient`, `Sparkline`) ARE rich-js renderables. Content primitives (`StyledText`, `Segment`) ARE rich-js. Animator interpolates colors via `Color.blend()`. Output filters operate on rich-js `Segment` streams.
- **Terminal-UI reality**: Validation failure messages may accept markup; suggestion rendering may be styled; notifications carry `Content`; filters transform terminal output.

## Gaps to fix

### 1. Color section — make rich-js explicit

**Where**: "Color type" subsection.
**Current state**: Describes the Color API; doesn't name rich-js as the provider.
**Why insufficient**: `Color` IS rich-js `Color`. The types listed are re-exports.
**Required change**: Rename the subsection to "Color type (rich-js Color)" and add the first sentence: "The framework's `Color` value type is re-exported from rich-js. It is the single color representation used by TCSS cascade output, theme palettes, content styling, renderables, animation interpolation, and output filters. Strings are parsed at input boundaries; `Color` is the internal representation everywhere else."

### 2. Content primitives — rich-js provenance

**Where**: "Content primitives" subsection.
**Current state**: Lists `StyledText`, `Bar`, `Blank`, `Gradient`.
**Why insufficient**: These are rich-js types and rich-js renderables, not framework-owned.
**Required change**: Rename to "Content primitives (rich-js)" and add: "All content primitives and renderables are provided by rich-js and re-exported from textual-js. The framework does not fork or wrap them."

Expand the table/list:
| Primitive | Kind | Purpose |
|-----------|------|---------|
| `Content` | rich-js value type | Immutable styled text (segments with styles). The lingua franca for widget content. |
| `StyledText` | rich-js value type | Single styled text span; Content holds a sequence. |
| `Segment` | rich-js value type | `(text, style)` pair; a line's atomic rendering unit. |
| `Strip` | rich-js value type | Immutable line-of-segments with cached width; Line API widgets produce these. |
| `Style` | rich-js value type | Composable text style (fg, bg, bold, etc.). |
| `Bar` | rich-js renderable | Horizontal progress bar; used by `ProgressBar`. |
| `Blank` | rich-js renderable | Empty space of a given size. |
| `Gradient` / `LinearGradient` / `VerticalGradient` | rich-js renderables | Color gradients; used by `Header`, `ProgressBar`, etc. |
| `Sparkline` | rich-js renderable | The widget IS this renderable wrapped in TCSS chrome. |
| `Digits` | rich-js renderable | Tall-glyph numeric display. |
| `Tint` | rich-js renderable | Color overlay. |
| `TextOpacity` | rich-js renderable | Opacity-adjusted text. |

### 3. Text measurement — rich-js helpers

**Where**: "Text measurement" section.
**Current state**: Lists `cellLength`, `columnIndex`, `cellIndex`.
**Why insufficient**: These are rich-js helpers, not framework-owned.
**Required change**: Add opening sentence: "Cell-width measurement is provided by rich-js. The framework re-exports these helpers for widget authors."

### 4. Animator — Color.blend interpolation

**Where**: "Animator" or "Animation and Timing" section.
**Current state**: Describes the animator loop at high level.
**Why insufficient**: Doesn't specify that color-valued animations use rich-js `Color.blend()` per tick.
**Required change**: Add to animator tick description: "Color-valued animated properties interpolate via rich-js `Color.blend(from, to, t)` per tick. Numeric properties use linear interpolation (or per-easing-function); object-valued properties (e.g., offsets) interpolate component-wise. The result is written to the MobX observable and triggers the normal render pipeline."

### 5. Output filters operate on rich-js segments

**Where**: "Output Filters" section (already exists).
**Current state**: Describes filters abstractly, `process(line: OutputSegment[])`.
**Why insufficient**: `OutputSegment` should be explicitly the rich-js `Segment` type, so custom filters can use rich-js segment APIs.
**Required change**: Change `OutputSegment` to rich-js `Segment` in the pipeline type signature and example. Add note: "Filters receive a line as `Segment[]` from rich-js. Filters can inspect/modify `Style` (e.g., strip colors while preserving bold/italic) and emit transformed segments. The pipeline terminal output is then converted to ANSI by Ink, respecting the filter-transformed styles."

### 6. Validation failure message type

**Where**: `ValidationFailure` interface.
**Current state**: `message: string`.
**Why insufficient**: Should allow markup so validators can emit styled error messages.
**Required change**: Change `message: string` to `message: string | Content`. Note: "Validators may return styled messages using markup; Input renders them via rich-js."

### 7. Suggester suggestion representation

**Where**: `Suggester` section.
**Current state**: `getSuggestion(value: string): Promise<string | null>`.
**Why insufficient**: Suggestions are displayed inline in Input as styled text (dimmed). Representation is fine as string for the API, but note the display mechanism.
**Required change**: Add one sentence: "The returned suggestion is rendered by the requesting widget (typically Input) as inline styled content — Input applies the `suggestion` component class so rich-js resolves a dim/italic `Style` at render time."

### 8. Notifications cross-reference

**Where**: "Notifications" section.
**Current state**: Describes the notification subsystem.
**Why insufficient**: Should cross-reference spec 01's `Notification` interface, which uses `string | Content`.
**Required change**: Update the Notification interface in this file (if present) to match spec 01 — `message: string | Content`, `title?: string | Content`, `markup: boolean`. Add: "Rendered by the internal `ToastRack` widget; severity maps to rich-js `Color` from the theme."

### 9. Theme section

**Where**: "Themes and Design Tokens" / Theme interface.
**Current state**: Color fields typed as `string`.
**Why insufficient**: Should match spec 01 — `string | Color` at input; `Color` internally.
**Required change**: Update the `Theme` interface fields to `string | Color` and add note: "Palette strings are parsed into rich-js `Color` at theme registration. Internally the theme stores `Color` instances. Derived variables (`$primary-lighten-2`, etc.) are computed via `Color.lighten/darken/blend`."

## Do not change

- Built-in themes table
- Theme → CSS variable mapping table
- Notification lifecycle table
- Severity → CSS class mapping
- Validator base class and built-in validators table
- Input validation integration (`validators`, `validEmpty`, `validateOn` props)
- Valid/invalid CSS class mapping
- uFuzzy integration (keep reference but covered in spec 06)
- Geometry value types and operations
- Coordinate type
- BoxModel
- Easing functions table
- Duration parsing table
- ETA computation section
- AwaitComplete / AwaitRemove
- Environment variables table
- Framework logger section
- Exception taxonomy table
- Slug generation
- Built-in filters table entries (Monochrome, NoColor, DimFilter, ANSIToTruecolor)
- Filter activation mechanisms
