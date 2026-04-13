# Compositor

The compositor is responsible for combining widget placements into a renderable screen. It manages regions (rectangular areas occupied by widgets), converts those regions into horizontal spans for efficient rendering, tracks which widgets are visible, and handles scroll-aware placement so that widgets remain correctly positioned as the viewport moves.

### Region Management

The compositor maintains a collection of widget placements, each associated with a `Region` (defined by x, y, width, height). It exposes a `visible_widgets` property that returns the set of widgets whose regions intersect the current viewport. Widgets that have been scrolled partially but not fully out of view remain in the visible set. For example, a widget placed at an offset within a scrollable container is still reported as visible after a partial scroll that does not move it entirely off-screen.

### Region-to-Span Conversion

The static method `Compositor._regions_to_spans` converts a list of `Region` objects into an iterable of span tuples `(y, x_start, x_end)`. Each span represents a horizontal line segment that must be redrawn. The conversion follows these rules:

- **Empty input.** An empty region list produces no spans.
- **Single region.** A region of width W and height H produces H spans, one per row, each covering `(y, 0, W)` offset by the region's origin.
- **Partially overlapping regions.** When two regions share some rows and columns, the spans for shared rows are merged to cover the union of their horizontal extents. For example, `Region(0, 0, 2, 2)` and `Region(1, 1, 2, 2)` produce: row 0 spans `(0, 0, 2)`, row 1 spans `(1, 0, 3)` (merged), and row 2 spans `(2, 1, 3)`.
- **Fully overlapping regions.** Multiple regions that overlap on the same rows produce merged spans covering the full horizontal extent across all contributing regions.
- **Disjoint regions on different rows.** Regions that share no rows produce independent spans, one set per region.
- **Disjoint regions on the same row.** Regions on the same row but with a horizontal gap produce separate spans for that row, preserving the gap. For example, `Region(0, 0, 1, 2)` and `Region(2, 0, 1, 1)` produce two spans on row 0: `(0, 0, 1)` and `(0, 2, 3)`.
- **Adjacent regions are merged.** Regions that are directly adjacent horizontally have their spans merged into a single continuous span per row. For example, `Region(0, 0, 1, 2)` and `Region(1, 0, 1, 2)` produce `(0, 0, 2)` and `(1, 0, 2)`.

### Compositing Layers and Scroll-Aware Placement

The compositor accounts for scroll position when determining widget visibility and placement. A screen with `overflow: scroll` that has been scrolled does not discard widgets that remain within the visible viewport. The compositor recalculates placements relative to the scroll offset so that partially visible widgets continue to appear in the `visible_widgets` set and are rendered at their correct screen coordinates.

### Screen Rendering

The compositor is accessed via `screen._compositor` and is the final stage before terminal output. It consumes the placed widget regions, applies scroll offsets, converts dirty regions to spans for efficient incremental updates, and determines which widgets contribute visible content to the current frame.

## Constraints

- `_regions_to_spans` must merge horizontally adjacent or overlapping spans on the same row into a single span; gaps between disjoint spans on the same row must be preserved.
- `visible_widgets` must reflect scroll-adjusted placement; a widget that has not been fully scrolled out of the viewport must remain in the visible set.
- Span tuples are `(y, x_start, x_end)` where `x_end` is exclusive (equal to `x_start + width` of the covered extent).
