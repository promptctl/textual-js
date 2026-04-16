# Docs Spec: Sparkline Widget

## Purpose
Describe the Sparkline widget, a non-focusable, miniature bar-chart widget
that visualizes a sequence of numeric values as colored Unicode block bars.
Covers data chunking, the summary function, color interpolation between min
and max, and styling hooks.

## Audience
Application authors adding inline numeric trend visualizations: dashboards,
activity meters, recent-usage indicators, or any compact graph.

## Required sections
1. Overview (what a sparkline looks like and what it is for)
2. Data input (a numeric array; empty/absent renders empty)
3. How data maps to bars (one bar per cell of widget width; equally sized
   chunks; the summary function reduces each chunk to a single value)
4. The summary function (default is `max`; any `(number[]) => number` works;
   common alternatives `min`, mean)
5. Color inputs: constructor props `minColor` / `maxColor` take precedence;
   otherwise the two component classes supply colors via their `color` CSS
   property
6. Color interpolation (linear blend between the two color stops based on
   relative value)
7. Props / constructor parameters
8. Observable attributes (`data`, `summaryFunction`)
9. Default TCSS and component classes
10. Constraints and edge cases (empty data, data shorter than width, data
    longer than width, all-equal values)
11. Examples

## Key concepts
- Width in cells determines bar count; the widget always produces exactly
  `width` bars (data is rescaled, never truncated to "missing" bars)
- The summary function is the single source of truth for how each chunk
  becomes a bar height
- Two color stops define the gradient; interpolation is linear
- Precedence rule: constructor color prop wins, else component-class color
- Only the `color` style on the component classes is consulted; other
  properties on them have no effect
- No messages, no bindings, not focusable

## Behaviors and contracts
- The rendering is a single deterministic pipeline: chunk data by width ->
  reduce each chunk via the summary function -> scale bar height by
  relative magnitude -> pick color by linear interpolation. The same code
  path runs every time; variability lives in the data, not in branches.
- Empty or missing `data` produces an empty render (no bars drawn)
- Color inputs follow a strict precedence: constructor prop > component
  class color > implicit default
- Changing `data` or `summaryFunction` triggers a re-render
- Default height is 1 row
- Default colors: `$primary` at max, `$primary` at 30% opacity at min

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- Minimal sparkline with a small numeric array
- Sparkline using `min` as the summary function
- Sparkline using a custom mean function
- Styling via CSS component classes (min and max colors)
- Overriding colors via constructor props
- Updating `data` over time (e.g., rolling window of samples from a timer
  or signal) and observing the re-render

## Cross-references
- spec/docs-spec/animation.md (tie-in for animated sparklines if supported)
- spec/spec-src/07-workers-timers-and-signals.md (common data sources)
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not describe Python `Sequence[float]` or `Callable` types; use
  TypeScript types (`number[]`, `(values: number[]) => number`).
- Do not describe Python `Color` class; colors are CSS color strings or
  values accepted by the TCSS color parser.
- Make the bar count = widget width invariant unambiguous - new users often
  expect one bar per data point; the widget rescales instead.
- Be explicit that the two component classes are read only for their
  `color` value; other properties on them are silently ignored.
- Avoid phrasing the color precedence as "if constructor color then X, else
  Y" - present it as a single ordered lookup (data-driven), not a control
  flow branch.
- Linear interpolation between exactly two stops is a hard limit; do not
  suggest multi-stop gradients are possible.
