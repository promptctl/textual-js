# Docs Spec: Geometry (Offset, Size, Region, Spacing)

## Purpose
Document the immutable geometry value types and helpers used throughout layout, rendering, input routing, and scrolling: `Offset`, `Size`, `Region`, `Spacing`, plus the `clamp` helper and module constants.

## Audience
Widget authors implementing layout/hit-testing, scroll container authors, animation and transition authors, and anyone computing cell-accurate positions.

## Required sections
1. Overview: all geometry types are immutable value types; arithmetic returns new values. Units are terminal cells unless noted.
2. `clamp(value, minimum, maximum)` — including the reversed min/max behavior.
3. Module constants: `NULL_OFFSET`, `NULL_REGION`, `NULL_SIZE`, `NULL_SPACING`.
4. Type alias `SpacingDimensions` — the CSS-like shorthand forms.
5. `Offset`:
   - Fields `x`, `y`.
   - Properties: `isOrigin`, `clamped` (non-negative), `transpose`.
   - Operators: add, subtract, scalar/component multiplication, unary negation, truthiness.
   - Methods: `blend(destination, factor)`, `getDistanceTo(other)`, `clamp(width, height)`.
6. `Size`:
   - Fields `width`, `height`.
   - Properties: `area`, `region` (a `Region` at origin), `lineRange`.
   - Operators: add/subtract with auto-clamp to zero, `contains`-like `in` semantics, truthiness (by area).
   - Methods: `withWidth`, `withHeight`, `contains(x, y)`, `containsPoint(point)`, `clampOffset(offset)`.
7. `Region`:
   - Fields `x`, `y`, `width`, `height`.
   - Rich set of derived properties: `right`, `bottom`, `area`, `offset`, `size`, `center`, `corners`, `columnSpan`, `lineSpan`, `columnRange`, `lineRange`, `bottomLeft`, `topRight`, `bottomRight`, `bottomRightInclusive`, `resetOffset`.
   - Operators: translate by tuple, point-containment, region-containment, truthiness.
   - Static constructors: `fromUnion(regions)`, `fromCorners(x1, y1, x2, y2)`, `fromOffset(offset, size)`, `getScrollToVisible(windowRegion, region, { top })`.
   - Instance methods: `contains`, `containsPoint`, `containsRegion`, `overlaps`, `translate`, `atOffset`, `cropSize`, `expand`, `clip`, `grow(spacing)`, `shrink(spacing)`, `intersection`, `union`, `split`, `splitVertical`, `splitHorizontal`, `getSpacingBetween`, `translateInside`, `inflect`, `constrain`.
8. `Spacing`:
   - Fields `top`, `right`, `bottom`, `left`.
   - Properties: `width`, `height`, `maxWidth`, `maxHeight`, `topLeft`, `bottomRight`, `totals`, `css` (CSS-shorthand string).
   - Operators: add/subtract element-wise, truthiness.
   - Static constructors: `unpack(pad)` (supports CSS 1/2/4-length shorthand), `vertical(n)`, `horizontal(n)`, `all(n)`.
   - Method: `growMaximum(other)`.
9. Common patterns: clamping an offset to a region, computing a scroll-into-view delta with `getScrollToVisible`, laying out with `grow` / `shrink`, splitting a region for side panels.

## Key concepts
- Immutability — every method returns a new value; aliasing is safe.
- Cells are the unit; `pixelSize` is exposed elsewhere (in `Resize` events) for special cases.
- Operator overloads map cleanly to TS helper methods (e.g., `offset.add(other)`, `offset.sub(other)`, `offset.scale(k)`) — document the chosen idiom in the doc and use it consistently.
- Non-integer `center` is preserved (floating point) for precise midpoints.
- Several `Region` operations are LRU-cached for layout hot paths.
- `Spacing.unpack` mirrors CSS's 1/2/4-value shorthand; other lengths fail loudly.
- Negative cuts in `Region.split*` count from the far edge.
- `Region.inflect` and `Region.constrain` underpin popover/tooltip placement.

## Behaviors and contracts
- All arithmetic is component-wise; `Size` arithmetic clamps to zero (no negative sizes).
- `clamp` auto-swaps reversed `minimum`/`maximum`.
- `Size.contains` uses half-open bounds (`0 <= x < width`).
- `Region.bottomRight` is the exclusive corner; `bottomRightInclusive` is the last cell.
- `Region.fromUnion([])` must throw; empty unions are not meaningful.
- `Region.getScrollToVisible(..., { top: true })` scrolls the target to the top of the window; otherwise it scrolls only far enough to reveal the region.
- `Spacing.unpack(tupleOfInvalidLength)` throws.
- `Region.split*` results include both halves, even when a half has zero area (to keep the shape of the return value stable — dataflow, not control flow).

## Example requirements
- JSX/TypeScript snippets that:
  - Construct offsets/regions/sizes and combine them.
  - Translate and clip a region to a viewport.
  - Compute scroll-into-view deltas for a list item.
  - Derive padded/margined regions with `grow` / `shrink`.
  - Split a region into side-by-side panes (`splitVertical(-20)` to carve off a right panel).
  - Constrain a tooltip to stay inside the screen using `constrain` and `inflect`.
- Ascii diagrams showing corner semantics (exclusive vs. inclusive bottom-right).
- A table of every `Region` property and its formula.

## Cross-references
- `spec/docs-spec/api_map_geometry.md` (MapGeometry / coordinate transforms).
- `spec/docs-spec/api_events.md` (events carry `Offset` and `Size`).
- `spec/docs-spec/api_scroll_view.md` and `spec/docs-spec/api_scrollbar.md` (scroll-into-view consumers).
- `spec/docs-spec/api_coordinate.md` (grid coordinates — distinct from geometry).
- `spec/spec-src/05-layout-render-and-compositor.md` (layout consuming `Region`/`Size`/`Spacing`).
- `spec/spec-src/08-drivers-io-and-platform-behavior.md` (Ink/Yoga flexbox integration).

## Notes for writers
- Do not reference Python `NamedTuple`. Describe these as immutable TS classes/records with accessor methods.
- Replace Python operator examples (`offset + offset`, `offset - offset`, `-offset`, `bool(offset)`) with method idioms appropriate to TS (`add`, `sub`, `negate`, `isZero`), and do so uniformly.
- `tuple[int, int]` arguments in Python become `[number, number]` tuples or plain objects `{ x, y }` in TS — pick and document the framework's chosen convention.
- Truncation rules for multiplication by a float are preserved: results are integer cells. State this explicitly.
- The `contains` / `overlaps` LRU caching is implementation detail; only mention it in a performance note.
- Do not conflate pixel coordinates with cell coordinates anywhere in the doc.
