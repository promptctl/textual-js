# Supporting Subsystems

This spec covers cross-cutting support modules used across the framework. Each section defines purpose, API surface, and key invariants.

// [LAW:one-way-deps] Supporting modules expose reusable primitives consumed by runtime/CSS/widget layers without inverting core dependency direction.

## Themes and Design Tokens

### Theme structure

```tsx
interface Theme {
  name: string;
  dark: boolean;
  primary: string | Color;
  secondary: string | Color;
  accent: string | Color;
  background: string | Color;
  surface: string | Color;
  panel: string | Color;
  foreground: string | Color;
  warning: string | Color;
  error: string | Color;
  success: string | Color;
  variables?: Record<string, string | number | Color>;  // Additional CSS variables
}
```

Palette strings are parsed into rich-js `Color` at theme registration. Internally, active theme palettes are stored as `Color` instances, and derived variables such as `$primary-lighten-2` are computed via `Color.lighten()`, `Color.darken()`, and `Color.blend()`.

### Built-in themes

`BUILTIN_THEMES` exposes the set of pre-registered themes. At minimum:

| Theme | `dark` | Description |
|-------|--------|-------------|
| `"default"` | `false` | Light default theme |
| `"dark"` | `true` | Dark default theme |
| `"textual-light"` | `false` | Textual-branded light |
| `"textual-dark"` | `true` | Textual-branded dark |

### Color type (rich-js Color)

The framework's `Color` value type is re-exported from rich-js. It is the single color representation used by TCSS cascade output, theme palettes, content styling, renderables, animation interpolation, and output filters. Strings are parsed at input boundaries; `Color` is the internal representation everywhere else.

A single `Color` type is used across the entire stack (CSS, styles, renderables, themes):

| Constructor | Example |
|-------------|---------|
| Hex | `Color.parse("#0178d4")`, `Color.parse("#ff000080")` |
| RGB/RGBA | `Color.fromRgb(1, 120, 212)`, `Color.fromRgba(255, 0, 0, 0.5)` |
| HSL/HSLA | `Color.fromHsl(210, 90, 47)` |
| Named | `Color.parse("red")`, `Color.parse("dodgerblue")` |
| Opacity suffix | `Color.parse("red 50%")` |

Operations:

| Method | Description |
|--------|-------------|
| `blend(other, factor)` | Blend two colors |
| `lighten(amount)` | Lighten by percentage |
| `darken(amount)` | Darken by percentage |
| `withAlpha(alpha)` | Return color with new alpha |
| `toHsl()` | Convert to HSL components |
| `toRgb()` | Convert to RGB components |
| `toAnsi()` | Convert to ANSI color code for terminal output |
| `contrastRatio(other)` | WCAG contrast ratio between two colors |
| `luminance` | Relative luminance (0–1) |

Named CSS color table is provided (all 148 CSS named colors).

// [LAW:one-source-of-truth] Single color type for the whole stack. No secondary color representations.

### Theme → CSS variable mapping

When a theme is active, its palette entries are exposed as CSS variables:

| Theme property | CSS variable | TCSS shorthand |
|---------------|-------------|----------------|
| `primary` | `--theme-primary` | `$primary` |
| `secondary` | `--theme-secondary` | `$secondary` |
| `accent` | `--theme-accent` | `$accent` |
| `background` | `--theme-background` | `$background` |
| `surface` | `--theme-surface` | `$surface` |
| `panel` | `--theme-panel` | `$panel` |
| `foreground` | `--theme-foreground` | `$foreground` |
| `warning` | `--theme-warning` | `$warning` |
| `error` | `--theme-error` | `$error` |
| `success` | `--theme-success` | `$success` |

Additional entries in `variables` are exposed as `--<key>` and `$<key>`.

## Notifications

### Notification model

```tsx
interface Notification {
  id: string;                                    // Unique identifier (auto-generated)
  message: string | Content;                     // Display text
  title?: string | Content;                      // Optional title
  severity: 'information' | 'warning' | 'error'; // Severity level
  timeout: number;                               // Auto-dismiss timeout in ms (0 = no auto-dismiss)
  markup: boolean;                               // Parse string fields as rich-js markup
  createdAt: number;                             // Timestamp (Date.now())
}
```

This matches spec 01's notification model. Notifications are rendered by the internal `ToastRack` widget; severity maps to rich-js `Color` values from the active theme.

### Notification lifecycle

| Step | Description |
|------|-------------|
| 1. Create | `notify(message, options?)` constructs a `Notification` with auto-generated ID |
| 2. Store | Added to the app-level notification store (MobX observable array) |
| 3. Message | `Notify` message posted to the app event pipeline |
| 4. Display | Toast display component (internal, not public) re-renders via `observer()` |
| 5. Expire | Timer removes the notification from the store after `timeout` ms |
| 6. Dismiss | `dismissNotification(id)` removes manually; `clearNotifications()` removes all. **Known divergence**: upstream only exposes `clear_notifications()` publicly; `dismissNotification(id)` is a textual-js addition. |

### Expiry behavior

- Notifications expire lazily — the collection reaps expired entries on access.
- The remaining time is computed from `createdAt + timeout - Date.now()`.
- Expired notifications are removed from the observable array, triggering a re-render of the toast display.
- `timeout: 0` means the notification persists until manually dismissed. **Known divergence**: upstream treats `time_left <= 0` as immediately expired; textual-js treats `timeout: 0` as "no auto-dismiss" for better developer ergonomics.
- **Known divergence — units**: timeout values are in milliseconds (upstream uses seconds). This conforms to JS ecosystem conventions.

### Severity styling

Severity maps to TCSS classes on the toast component:

| Severity | CSS class | Typical styling |
|----------|-----------|----------------|
| `information` | `.-information` | `$primary` background |
| `warning` | `.-warning` | `$warning` background |
| `error` | `.-error` | `$error` background |

## Validation Framework

### Validator base

```tsx
abstract class Validator<T = string> {
  abstract validate(value: T): ValidationResult;

  // Convenience helpers
  success(): ValidationResult;
  failure(message: string, value?: T, description?: string): ValidationResult;
}
```

### ValidationResult

```tsx
interface ValidationResult {
  failures: ValidationFailure[];
  isValid: boolean;

  // Merge with another result
  merge(other: ValidationResult): ValidationResult;
}

interface ValidationFailure {
  message: string | Content; // Human-readable error message
  value?: unknown;        // The value that failed
  description?: string;   // Additional context
  validator: Validator;   // Which validator produced this failure
}
```

Validators may return styled messages using markup or pre-built `Content`; Input renders them through rich-js.

### Built-in validators

| Validator | Parameters | Validates |
|-----------|-----------|-----------|
| `NumberValidator` | `min?`, `max?` | Value is a number (optionally within range) |
| `IntegerValidator` | `min?`, `max?` | Value is an integer (optionally within range) |
| `LengthValidator` | `min?`, `max?` | String length is within range |
| `RegexValidator` | `pattern`, `flags?`, `failureMessage?` | Value matches the regex pattern |
| `URLValidator` | — | Value is a valid URL |
| `FunctionValidator` | `fn: (value) => boolean`, `failureMessage?` | Custom validation function returns true |

### Integration with Input widget

`Input` accepts `validators` and `validEmpty` props:

```tsx
<Input
  type="number"
  validators={[new NumberValidator({ min: 0, max: 100 })]}
  validEmpty={false}
  validateOn="changed"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `validators` | `Validator[]` | `[]` | Validation rules |
| `validEmpty` | `boolean` | `true` | Whether empty string passes validation |
| `validateOn` | `"blur" \| "changed" \| "submitted"` | `"changed"` | When to run validation |

Validation state is reflected as CSS classes on the Input widget:

| State | CSS class | Applied when |
|-------|-----------|-------------|
| Valid | `.-valid` | All validators pass |
| Invalid | `.-invalid` | Any validator fails |

```css
Input.-valid { border: solid $success; }
Input.-invalid { border: solid $error; }
```

## Suggestions and Completion

### Suggester base

```tsx
abstract class Suggester {
  // Return a suggestion for the given input value, or null
  abstract getSuggestion(value: string): Promise<string | null>;

  // Optional cache for performance
  cache?: Map<string, string | null>;
}
```

When a suggestion is available, a `SuggestionReady` message is posted to the requesting widget. The widget displays the suggestion as ghost text at the cursor.
The returned suggestion remains a plain string at the API boundary, but the requesting widget typically renders it as inline styled content by applying the `suggestion` component class so rich-js resolves a dim or italic `Style`.

### SuggestFromList

Built-in prefix-match suggester:

```tsx
const countrySuggester = new SuggestFromList(
  ['United States', 'United Kingdom', 'Canada', 'Australia'],
  { caseInsensitive: true }
);

<Input suggester={countrySuggester} />
```

- Matches the input as a prefix against the candidate list.
- Returns the first matching candidate.
- Case-insensitive matching when configured.
- Results are cached by the normalized input value.

### Fuzzy search (command palette)

The command palette uses **uFuzzy** for ranked fuzzy matching:

```tsx
import uFuzzy from '@leeoniya/ufuzzy';

const uf = new uFuzzy();
const haystack = commands.map(c => c.name);

const [idxs, info, order] = uf.search(haystack, query);
// idxs: matching indices into haystack
// info: match details including highlight ranges
// order: sorted by match quality
```

uFuzzy provides:
- Sub-millisecond search across thousands of commands.
- Highlight ranges for rendering matched characters in results.
- Ranked results by match quality.

## Content and Rendering Helpers

### Text measurement

Cell-width measurement is provided by rich-js. The framework re-exports these helpers for widget authors.

Terminal-aware text measurement accounts for:

| Concern | Description |
|---------|-------------|
| Wide characters | CJK characters occupy 2 cells |
| Combining characters | Accents/diacritics occupy 0 cells |
| Emoji | Various widths (1–2 cells) |
| Tab characters | Expanded to `tabWidth` cells |
| ANSI escape sequences | Zero width (not counted) |

| Function | Description |
|----------|-------------|
| `cellLength(text)` | Number of terminal cells a string occupies |
| `columnIndex(text, cellIndex)` | String index at a given cell position |
| `cellIndex(text, stringIndex)` | Cell position at a given string index |

### Content primitives (rich-js)

All content primitives and renderables are provided by rich-js and re-exported from textual-js. The framework does not fork or wrap them.

| Primitive | Kind | Purpose |
|-----------|------|---------|
| `Content` | rich-js value type | Immutable styled text. The lingua franca for widget content. |
| `StyledText` | rich-js value type | Single styled text span; `Content` holds a sequence of these. |
| `Segment` | rich-js value type | `(text, style)` pair; a rendered line's atomic unit. |
| `Strip` | rich-js value type | Immutable line-of-segments with cached width; Line API widgets produce these. |
| `Style` | rich-js value type | Composable text style (fg, bg, bold, italic, underline, strike, dim, link). |
| `Bar` | rich-js renderable | Horizontal progress bar used by `ProgressBar`. |
| `Blank` | rich-js renderable | Empty space of a given size. |
| `Gradient` / `LinearGradient` / `VerticalGradient` | rich-js renderables | Color gradients used by header and progress chrome. |
| `Sparkline` | rich-js renderable | Inline chart primitive wrapped by the `Sparkline` widget. |
| `Digits` | rich-js renderable | Tall-glyph numeric display. |
| `Tint` | rich-js renderable | Color overlay renderable. |
| `TextOpacity` | rich-js renderable | Opacity-adjusted text renderable. |

### Slug generation

The framework provides a `slug(text)` helper and a `TrackedSlugs` class for generating Markdown-style anchor slugs from heading text. The `Markdown` widget uses these to build stable anchor IDs for its table of contents: `slug(text)` produces the canonical slug for a single heading, while `TrackedSlugs` maintains a running set across a document and disambiguates duplicate headings by appending a numeric suffix (e.g., `introduction`, `introduction-1`, `introduction-2`). Anchor IDs remain deterministic for a given document, so in-document links resolve consistently across re-renders.

// [LAW:one-source-of-truth] One slug algorithm shared by every heading-to-anchor producer; no widget re-implements anchor disambiguation.

## Geometry, Coordinates, and Types

### Value types

All geometry types are immutable:

| Type | Fields | Description |
|------|--------|-------------|
| `Offset` | `x: number, y: number` | 2D position (or delta) |
| `Size` | `width: number, height: number` | 2D dimensions |
| `Region` | `x: number, y: number, width: number, height: number` | Rectangle (position + size) |
| `Spacing` | `top: number, right: number, bottom: number, left: number` | TRBL insets (margin, padding, border) |

Each provides:
- Construction from components and from shorthand (1, 2, or 4 values for Spacing).
- Arithmetic operators: `add`, `subtract`, `multiply`.
- Comparison: `equals`.
- Conversion: `Region.offset`, `Region.size`, `Region.contains(offset)`, `Region.intersection(other)`.
- Static constants: `Offset.ZERO`, `Size.ZERO`, `Region.ZERO`.

### Coordinate

`Coordinate` is a `{ row: number, column: number }` pair used by DataTable and TextArea for cursor/cell positioning. Distinct from `Offset` (which is pixel/cell-based x/y).

### Box model

`BoxModel` computes nested boxes for a widget:

| Box | Description |
|-----|-------------|
| `contentBox` | Inner content area |
| `paddingBox` | Content + padding |
| `borderBox` | Content + padding + border |
| `marginBox` | Content + padding + border + margin |

## Animation and Timing

### Animator

The `Animator` is a MobX store on the app context. It is the single timing authority for all animation.

| Method | Description |
|--------|-------------|
| `animate(widget, property, target, duration, easing?, delay?, onComplete?)` | Start an animation |
| `stopAnimation(widget, property)` | Stop and snap to current value |
| `forceStopAnimation(widget, property)` | Stop, snap to target value, schedule `onComplete` via `callLater` |
| `isAnimating(widget, property)` | Check if an animation is active |

### Easing functions

| Name | Curve |
|------|-------|
| `linear` | Constant speed |
| `ease` | CSS `ease` cubic-bezier |
| `ease-in` | Slow start |
| `ease-out` | Slow end |
| `ease-in-out` | Slow start and end |
| `cubicBezier(x1, y1, x2, y2)` | Custom cubic bezier curve |

### Duration parsing

CSS-style duration strings are parsed:

| Input | Milliseconds |
|-------|-------------|
| `"1s"` | 1000 |
| `"500ms"` | 500 |
| `"0.3s"` | 300 |
| `300` | 300 (number passed directly) |

### Animation loop

The animator runs a `setInterval` loop (terminal has no `requestAnimationFrame`):

1. Each tick: compute interpolated values for all active animations.
2. Update MobX observables in a single `runInAction` batch.
3. `observer()` picks up changes → React re-renders → Ink updates terminal.
4. On completion: set final value, remove animation entry, schedule `onComplete`.

Color-valued animated properties interpolate via rich-js `Color.blend(from, to, t)` per tick. Numeric properties use linear interpolation (or the configured easing function), and object-valued properties interpolate component-wise before the result is written back to the observable.

// [LAW:one-source-of-truth] Single timing authority. No widget runs its own animation loop.

### ETA computation

`EtaCalculation` tracks progress over time for `ProgressBar`:

| Method | Description |
|--------|-------------|
| `update(progress, total?)` | Record a data point |
| `eta` | Estimated seconds remaining (or null if insufficient data) |
| `speed` | Progress units per second |
| `reset()` | Clear accumulated data |

## Async Coordination

`AwaitComplete` and `AwaitRemove` are optionally-awaitable handles returned from mount/remove APIs:

```tsx
// Fire-and-forget
mount(new MyWidget());

// Or await completion
await mount(new MyWidget());
// Widget is now fully composed, mounted, and styled
```

The handle resolves when the mounted/removed widget has fully processed its lifecycle messages (`Compose`, `Mount`, or `Unmount`).

## Environment and Configuration

// [LAW:single-enforcer] One module parses environment variables. No other module reads from `process.env` directly.

| Variable | Description |
|----------|-------------|
| `TEXTUAL_LOG` | Log sink path (file path or `"console"`) |
| `TEXTUAL_LOG_VERBOSITY` | Log verbosity level |
| `TEXTUAL_COLOR_DEPTH` | Override color depth detection |
| `TEXTUAL_PRESS` | Simulated key presses (for testing) |
| `TEXTUAL_SHOW_RETURN` | Show return value on exit |
| `NO_COLOR` | Disable colors (respects the `NO_COLOR` convention) |
| `FORCE_COLOR` | Force color output |

Feature flags are parsed from environment variables at startup and exposed as read-only properties on the app context.

## Output Filters

// [LAW:single-enforcer] All rendered output passes through the same filter pipeline at the output seam. Filters are not distributed through the rendering path or applied by individual widgets.

### Pipeline model

The framework supports a `LineFilter` pipeline at the output boundary — the seam between Ink's rendered output and the terminal. Filters post-process rendered output for accessibility or terminal-compatibility reasons without altering the upstream render tree.

```tsx
abstract class LineFilter {
  // Transform a rendered output line (segments with styles) and return the result.
  abstract process(line: Segment[]): Segment[];
}
```

The pipeline applies filters in declaration order — each filter reads the output of the previous filter. The same pipeline runs on every rendered line every frame; an empty pipeline is a no-op, so the code path is uniform whether filters are configured or not.

// [LAW:dataflow-not-control-flow] The pipeline always runs. Filter behavior varies by the filter list, not by conditionally skipping the pipeline.

### Built-in filters

| Filter | Description |
|--------|-------------|
| `Monochrome` | Strips all colors, rendering everything in black/white. For monochrome terminals or accessibility. |
| `NoColor` | Strips only ANSI color codes, keeping bold/italic/underline attributes. Respects the `NO_COLOR` environment-variable convention. |
| `DimFilter` | Forces all colors to their dim variant. Useful for reduced-contrast modes. |
| `ANSIToTruecolor` | Converts ANSI 16-color codes to their RGB truecolor equivalents using the active theme's ANSI palette. Produces consistent appearance across terminals. |

### Activation

Filters are activated through app configuration or automatic environment detection:

```tsx
class MyApp extends App {
  filters = [new Monochrome()];
}
```

| Source | Behavior |
|--------|----------|
| `App.filters` | Explicit list of filter instances configured on the app class/instance |
| `NO_COLOR` env var | Automatically prepends `NoColor` to the pipeline |
| `TEXTUAL_COLOR_DEPTH` | Influences whether `ANSIToTruecolor` is auto-activated for depth normalization |

Environment-driven filters and app-configured filters compose into a single ordered pipeline owned by the app context.

### Custom filters

Custom filters extend `LineFilter` and implement `process(line)`:

```tsx
class StripEmoji extends LineFilter {
  process(line: Segment[]): Segment[] {
    return line.map(segment => ({
      ...segment,
      text: segment.text.replace(EMOJI_REGEX, ''),
    }));
  }
}
```

A filter receives rich-js `Segment[]` and returns rich-js `Segment[]`. Filters can inspect or modify `Style` values (for example, stripping color while preserving bold/italic) before Ink converts the transformed segments back to ANSI. Filters do not reach back into the widget tree, the styles system, or the compositor — they operate only on post-render output.

// [LAW:one-way-deps] Filters consume rendered output; they do not call back into rendering or style resolution.

## Logging and Diagnostics

### Framework logger

Available to all widgets via `useTextual()`:

```tsx
const { log } = useTextual();
log.info('Widget mounted', { id: 'my-widget' });
log.warning('Deprecated API used');
log.error('Failed to load data', error);
```

| Method | Description |
|--------|-------------|
| `log.debug(message, data?)` | Debug-level log |
| `log.info(message, data?)` | Informational log |
| `log.warning(message, data?)` | Warning log |
| `log.error(message, data?)` | Error log |

- Output directed to the sink configured by `TEXTUAL_LOG` environment variable.
- When no sink is configured, log traffic is dropped (not buffered).
- Logger errors are caught and discarded — logging never crashes the app.
- Structured logging: data objects are serialized alongside the message.

### Exception taxonomy

| Error | Description |
|-------|-------------|
| `TextualError` | Base class for all framework errors |
| `InvalidBinding` | Malformed binding declaration |
| `ActionError` | Malformed action string or unknown namespace |
| `SkipAction` | Thrown inside action handler to indicate not-handled |
| `NoBinding` | Key lookup found no binding |
| `QueryError` | Base for query errors |
| `InvalidQueryFormat` | CSS selector parse failure |
| `NoMatches` | Singleton query found zero matches |
| `TooManyMatches` | `queryExactlyOne` found multiple matches |
| `WrongType` | Query match doesn't match expected type |
| `DuplicateIds` | Widget registered with a duplicate ID |
| `ReactiveError` | Invalid data binding or reactive declaration |
| `WorkerError` | Base for worker errors |
| `WorkerFailed` | Worker ended in ERROR state |
| `WorkerCancelled` | Worker ended in CANCELLED state |
| `SignalError` | Signal operation on unmounted widget |
| `ThemeDoesNotExist` | Unknown TextArea theme |
| `LanguageDoesNotExist` | Unknown TextArea language |
| `InvalidRuleOrientation` | Bad Rule widget orientation |
| `InvalidButtonVariant` | Bad Button variant |
| `SuspendNotSupported` | Environment doesn't support suspend |
| `StylesheetParseError` | TCSS syntax error |
| `UnresolvedVariableError` | Unknown TCSS variable reference |
