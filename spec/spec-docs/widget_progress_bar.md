# ProgressBar Widget Spec

## Purpose

`ProgressBar` displays progress on a time-consuming task. It supports both determinate progress (known total) and indeterminate progress (unknown total, animated bouncing bar). It is not focusable and not a container.

## Construction

```python
ProgressBar(
    total: float | None = None,       # Total number of steps (None = indeterminate)
    *,
    show_bar: bool = True,             # Show the visual bar portion
    show_percentage: bool = True,      # Show the percentage label
    show_eta: bool = True,             # Show the ETA countdown label
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
    clock: Clock | None = None,        # For testing; leave default normally
    gradient: Gradient | None = None,  # Optional gradient (overrides CSS bar styling)
)
```

## Reactive Attributes

| Name         | Type            | Default | Description |
|--------------|-----------------|---------|-------------|
| `progress`   | `float`         | `0.0`   | Number of steps of progress completed so far. |
| `total`      | `float \| None` | `None`  | Total number of steps. `None` renders an indeterminate bar. Validated to be non-negative. |
| `percentage` | `float \| None` | `None`  | Read-only computed property. `progress / total` clamped to [0, 1], or `None` if `total` is `None`. Returns `1.0` if `total` is `0`. |
| `gradient`   | `Gradient \| None` | `None` | Optional gradient object; when set, overrides CSS styling for the bar fill. |

## Methods

### `advance(advance: float = 1) -> None`

Advance progress by the given number of steps. Shorthand for `update(advance=advance)`.

### `update(*, total=UNUSED, progress=UNUSED, advance=UNUSED) -> None`

Update the progress bar. All parameters are optional and keyword-only:

- `total`: Set a new total (resets ETA if changed or set to `None`).
- `progress`: Set the absolute progress value.
- `advance`: Increment the current progress by this amount.

When `progress` or `advance` is provided, a new ETA sample is recorded.

## Composition / Sub-Widgets

The progress bar is composed of three child widgets, each independently styleable:

| Widget class     | ID            | Description |
|------------------|---------------|-------------|
| `Bar`            | `#bar`        | Visual bar showing progress. Rendered only if `show_bar=True`. |
| `PercentageStatus` | `#percentage` | Label showing percentage (e.g. `50%` or `--%`). Rendered only if `show_percentage=True`. |
| `ETAStatus`      | `#eta`        | Label showing estimated time to completion (e.g. `00:05:30` or `--:--:--`). Rendered only if `show_eta=True`. |

All three sub-widgets use `data_bind` to stay synchronized with the parent `ProgressBar` reactives.

## Bar Component Classes

The `Bar` sub-widget defines these component classes for styling foreground and background colors:

| Class                  | Description |
|------------------------|-------------|
| `bar--bar`             | Style of the bar during normal (incomplete) progress. Default: `$primary` on `$surface`. |
| `bar--complete`        | Style of the bar when progress reaches 100%. Default: `$success` on `$surface`. |
| `bar--indeterminate`   | Style of the bar in indeterminate state (no total set). Default: `$error` on `$surface`. |

## Default CSS

```css
ProgressBar {
    width: auto;
    height: 1;
    layout: horizontal;
}

Bar {
    width: 32;
    height: 1;
}

PercentageStatus {
    width: 5;
    content-align-horizontal: right;
}

ETAStatus {
    width: 9;
    content-align-horizontal: right;
}
```

## Messages

This widget posts no messages.

## Bindings

This widget has no bindings.

## States

- **Indeterminate**: When `total` is `None`, the bar animates a bouncing highlight (at ~15fps via `auto_refresh`). The `bar--indeterminate` component class is applied.
- **In progress**: When `total` is set and `percentage < 1`, the bar fills proportionally. The `bar--bar` component class is applied.
- **Complete**: When `percentage >= 1`, the `bar--complete` component class is applied.

## Gradient Support

An optional `Gradient` object can be passed at construction or set via the `gradient` reactive. When set, the bar renders a smooth gradient fill instead of a solid color, overriding CSS component class colors.

## ETA Behavior

- ETA estimation is driven by an internal `ETA` object that collects `(time, fraction)` samples.
- The ETA display updates every 1 second via `set_interval`.
- ETA is reset when `total` changes or is set to `None`.
- Display format: `HH:MM:SS`, or `{hours}h` when hours exceed 99, or `+999999h` when hours exceed 999999.

## Validation

- `total` is clamped to non-negative values (negative values become `0`).
- `percentage` on the `Bar` sub-widget is quantized to avoid unnecessary re-renders when the visual change would be sub-pixel.
