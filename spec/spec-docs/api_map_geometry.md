# textual.map_geometry

Data structure describing the absolute geometry of a widget on screen, as returned by `Screen.find_widget`.

## MapGeometry Class

`MapGeometry` (`textual.map_geometry`) is a `NamedTuple` that defines the absolute location and spatial properties of a widget.

### Fields

- `region: Region` -- The screen region occupied by the widget.
- `order: tuple[tuple[int, int, int], ...]` -- Tuple of triples defining the painting order of the widget. Each successive triple represents painting order information with respect to ancestors in the DOM hierarchy. The last triple provides painting order information for this specific widget.
- `clip: Region` -- A region to clip the widget by. Used when a widget is within a scrollable container to restrict its visible area.
- `virtual_size: Size` -- The virtual size (scrollable area) of the widget, if it is a container.
- `container_size: Size` -- The container size (area not occupied by scrollbars).
- `virtual_region: Region` -- The region relative to the container. This region represents the widget's position in virtual (scrollable) space, which may not be entirely visible.
- `dock_gutter: Spacing` -- Space from the container reserved by docked widgets.

### Properties

#### visible_region

```python
@property
def visible_region(self) -> Region
```

The widget region after clipping. Computed as the intersection of `clip` and `region`. Returns only the portion of the widget that is actually visible on screen.
