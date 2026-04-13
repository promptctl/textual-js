# ProgressBar

## Overview

`ProgressBar` displays progress toward completion of a task. It supports both determinate mode (known total) and indeterminate mode (unknown total), and is composed of optional sub-widgets for the bar, percentage label, and ETA label.

### Construction

- `ProgressBar()` creates an indeterminate progress bar with `total=None` and `progress=0`.
- `ProgressBar(total=100)` creates a determinate progress bar with the given total and `progress=0`.
- Optional boolean parameters `show_bar`, `show_percentage`, and `show_eta` control which sub-widgets are rendered. Each defaults to `True`.

### Total

- `pb.total` is the target value representing 100% completion, or `None` for indeterminate mode.
- Setting `total` to a negative value clamps it to `0`.
- Setting `total` to `None` returns the bar to indeterminate mode.
- `total` can be set directly (`pb.total = 100`) or via `update(total=100)`.

### Progress

- `pb.progress` is the current progress value, starting at `0`.
- Can be set directly (`pb.progress = 50`) or via `update(progress=73)`.
- Setting `progress` via `update` replaces the current value (it does not accumulate).

### Percentage

- `pb.percentage` is a derived, read-oriented property computed from `progress` and `total`.
- When `total` is `None` (indeterminate mode), `percentage` is `None`.
- When `total` is set, `percentage` equals `progress / total`, expressed as a float between `0` and `1`.
- Percentage is clamped: it never exceeds `1` (even if `progress > total`) and never goes below `0` (even if `progress` is negative).

### Advance

- `pb.advance(amount)` increments `progress` by the given amount.
- Supports positive integers, floats, and negative values (to move backwards).
- Successive calls accumulate: `advance(10)` then `advance(42)` yields `progress == 52`.

### Update

- `pb.update(...)` accepts keyword arguments `total`, `progress`, and `advance`, applied in that order.
- `total` sets the new total (or `None` for indeterminate).
- `progress` sets the absolute progress value.
- `advance` increments the current progress by the given amount.
- All three can be combined in a single call: `update(total=100, progress=30, advance=20)` sets total to `100`, progress to `30`, then advances by `20`, resulting in `progress == 50`.

### Sub-widgets

The progress bar is composed of three optional child widgets, each identified by a CSS ID:

- `#bar` -- the visual bar fill. Present when `show_bar=True`.
- `#percentage` -- a text label showing the completion percentage. Present when `show_percentage=True`.
- `#eta` -- a text label showing the estimated time remaining. Present when `show_eta=True`.

When a sub-widget is disabled via its `show_*` parameter, querying for it raises `NoMatches`.

### Styling

- The `Bar` sub-widget supports a gradient via `Gradient.from_colors(...)`. The `_apply_gradient` helper applies color stops across the bar text.
- The `Bar` sub-widget width can be styled with CSS (e.g., `ProgressBar Bar { width: 1fr; }`).

## Constraints

- `total` is never negative. Negative values are clamped to `0`.
- `percentage` is the single derived representation of `progress` relative to `total`. It is `None` when `total` is `None`, and clamped to the range `[0, 1]` otherwise.
- `progress` and `total` are the two canonical values; `percentage` is always derived from them and never independently settable.
- Overflow (`progress > total`) and underflow (`progress < 0`) are handled by clamping `percentage`, not by clamping `progress` itself.
- Sub-widget presence is determined solely by the `show_bar`, `show_percentage`, and `show_eta` constructor parameters.
