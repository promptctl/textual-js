# Sparkline Widget

## Overview

`Sparkline` is a widget that visually represents numerical data as a miniature bar chart using Unicode block characters. It maps a sequence of numeric values to colored bars, where bar height and color encode relative magnitude. The widget is not focusable and is not a container.

Importable from `textual.widgets`.

### Data

- The `data` parameter accepts a `Sequence[float] | None`. When `None` or empty, the sparkline renders as empty.
- Data is split into equally-sized chunks based on the widget's width. Each chunk is represented by one bar.
- The number of bars equals the widget's width in character cells. If the data has 12 points and the widget is 3 cells wide, each bar summarizes 4 data points.

### Summary Function

- The `summary_function` reactive attribute determines how each chunk of data points is reduced to a single value that sets the bar height.
- The default summary function is `max`: each bar shows the largest value in its chunk.
- Any callable with signature `(Sequence[float]) -> float` is valid. Common alternatives include `min` and a mean function (e.g., `lambda data: sum(data) / len(data)`).
- The summary function can be set at construction time or reassigned at runtime.

### Colors

Colors are determined by two sources, in order of precedence:

1. **Constructor parameters**: `min_color` and `max_color` accept a `Color` or color string. When provided, these override CSS-based colors.
2. **Component classes**: When constructor color parameters are `None` (the default), colors are read from the `sparkline--min-color` and `sparkline--max-color` component classes.

Each bar's color is interpolated between the min and max colors based on its relative value within the data range. The minimum data value receives `min_color`; the maximum receives `max_color`; intermediate values are blended proportionally.

### Default CSS

```css
Sparkline {
    height: 1;
}
Sparkline > .sparkline--max-color {
    color: $primary;
}
Sparkline > .sparkline--min-color {
    color: $primary 30%;
}
```

The default height is 1 row. The default color gradient runs from 30% opacity `$primary` (min) to full `$primary` (max).

## Constructor Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `Sequence[float] \| None` | `None` | Initial data to populate the sparkline. |
| `min_color` | `Color \| str \| None` | `None` | Color for minimum values. Overrides CSS when set. |
| `max_color` | `Color \| str \| None` | `None` | Color for maximum values. Overrides CSS when set. |
| `summary_function` | `Callable[[Sequence[float]], float] \| None` | `None` | Function to summarize each chunk. Defaults to `max` when `None`. |
| `name` | `str \| None` | `None` | Widget name. |
| `id` | `str \| None` | `None` | Widget DOM ID. |
| `classes` | `str \| None` | `None` | CSS classes. |
| `disabled` | `bool` | `False` | Whether the widget is disabled. |

## Reactive Attributes

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `Sequence[float] \| None` | `None` | The data represented by the sparkline. Changing this triggers a re-render. |
| `summary_function` | `Callable[[Sequence[float]], float]` | `max` | The function that computes the representative value for each bar. Changing this triggers a re-render. |

## Messages

This widget posts no messages.

## Bindings

This widget has no bindings.

## Component Classes

| Class | Description |
| --- | --- |
| `sparkline--max-color` | The `color` style on this class sets the color used for the largest values in the data. |
| `sparkline--min-color` | The `color` style on this class sets the color used for the smallest values in the data. |

Only the `color` style property is read from these component classes. Setting other style properties on them has no effect.

## Constraints

- `data` must be a `Sequence[float]` or `None`. Arbitrary iterables are not accepted.
- The number of rendered bars is determined entirely by the widget's width. The data is always rescaled to match.
- When `min_color` or `max_color` is provided via the constructor, it takes precedence over the corresponding component class. This is the single source of truth for color: constructor parameter if set, otherwise component class.
- The summary function is the single source of truth for how data chunks become bar heights. It must accept a `Sequence[float]` and return a `float`.
- Color interpolation is linear between exactly two color stops (min and max). There is no support for arbitrary color ramps.
