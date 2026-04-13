# How-To Guides

Textual provides a set of how-to guides that cover practical patterns at a higher level than the core guide or API reference. This spec documents the key patterns and recommendations from each guide.

## Containers

Containers are compound widgets with preset CSS styles that arrange their children. They are implemented as simple `Widget` subclasses with `DEFAULT_CSS` and nothing else.

### Container Types

| Container | Layout | Sizing | Scrolling |
|---|---|---|---|
| `Horizontal` | Left to right | Expands to fill available space (`1fr` x `1fr`) | No (overflow hidden) |
| `Vertical` | Top to bottom | Expands to fill available space (`1fr` x `1fr`) | No (overflow hidden) |
| `HorizontalGroup` | Left to right | Fits to content height | No |
| `VerticalGroup` | Top to bottom | Fits to content height | No |
| `HorizontalScroll` | Left to right | Expands to fill | Yes (horizontal scrollbar) |
| `VerticalScroll` | Top to bottom | Expands to fill | Yes (vertical scrollbar) |

### Alignment Containers

- `Center`: Aligns children to horizontal center. Expands horizontally, fits vertically.
- `Right`: Aligns children to right edge. Expands horizontally, fits vertically.
- `Middle`: Aligns children to vertical center. Expands vertically, fits horizontally.
- There is no `Left` container because left alignment is the default.

### Expanding vs Group Behavior

- `Horizontal` and `Vertical` divide available screen space equally among sibling containers of the same type (two `Horizontal` containers split the space in half, three split it into thirds, etc.). This makes them suitable for macro-level layout.
- `HorizontalGroup` and `VerticalGroup` use only as much space as their children require. This makes them suitable for tightly packed rows or columns.

### Scrolling Behavior

- `Horizontal`, `Vertical`, and the Group variants do not scroll by default. Content that overflows is clipped and inaccessible.
- Replace with `HorizontalScroll` or `VerticalScroll` when content may exceed available space.
- Scrolling can also be controlled via the `overflow` CSS property.

### Custom Containers

Custom containers are created by subclassing `Widget` and providing `DEFAULT_CSS`:

```python
class MyContainer(Widget):
    """My custom container."""
    DEFAULT_CSS = """
    MyContainer {
        # Your rules here
    }
    """
```

## Designing a Layout

The recommended workflow for building an application layout follows five steps.

### Step 1: Sketch First

Draw the layout before writing code. A rectangle for the terminal, rectangles for each UI region, annotated with content description and scroll direction. Pen and paper or a tool like Excalidraw both work.

### Step 2: Work Outside In

Start with the outermost fixed elements (header, footer, sidebar) and work inward toward the content area. This mirrors how CSS layout resolution works -- outer constraints establish the frame for inner content.

### Step 3: Dock Fixed Elements

Widgets that do not move or scroll should be docked to a screen edge using the `dock` CSS rule (e.g., `dock: top` for a header, `dock: bottom` for a footer). Docked widgets reduce the available area for remaining widgets automatically.

Set an explicit `height` on docked widgets to control their size (e.g., `height: 3` for a header bar).

### Step 4: Use FR Units for Flexible Regions

Set flexible regions to `width: 1fr` and `height: 1fr`. A single `1fr` widget fills all remaining space. Multiple `1fr` siblings divide the space equally. This is the same behavior that `Horizontal` and `Vertical` containers use internally.

### Step 5: Use Containers for Scrollable Regions

Replace custom widget wrappers with built-in containers (`HorizontalScroll`, `VerticalScroll`) when content may overflow. Containers provide the correct FR sizing and overflow behavior out of the box.

### Layout Progression Pattern

The typical progression is:

1. Dock header/footer with explicit heights.
2. Add a container (e.g., `HorizontalScroll`) for the main content area.
3. Inside the container, add child containers (e.g., `VerticalScroll` columns).
4. Set explicit widths on children where needed (override the default `1fr`).
5. Replace `Placeholder` widgets with real content.

## Centering Things

There are three distinct centering mechanisms, each operating at a different level.

### Widget Alignment (`align`)

- Applied to the **parent** container (not the widget being centered).
- Syntax: `align: center middle;` (horizontal then vertical).
- The widget must be **smaller than its container** for alignment to have a visible effect. A widget with `width: 100%` cannot be horizontally centered because it already fills the space.
- Set `width: auto` on the widget to shrink it to content size, enabling horizontal centering.
- When applied to a container with multiple children, all children move as a group (their relative positions are preserved).

### Text Alignment (`text-align`)

- Applied to the **widget itself**.
- Aligns text on a **line-by-line** basis within the widget.
- Values: `left` (default), `center`, `right`, `justify`.
- Does not affect widget position, only the text rendering inside it.

### Content Alignment (`content-align`)

- Applied to the **widget itself**.
- Treats the rendered text as a rectangular block and positions it within the widget's border box.
- Useful when the widget is **larger than its content** (e.g., a widget with an explicit `height` greater than the text needs).
- Syntax: `content-align: center middle;` or the axis-specific `content-align-vertical: middle;`.

### Centering Multiple Widgets Independently

- `align` on a parent centers all children as one group.
- To center each widget independently, wrap each in its own `Center` container. The `Center` container applies `align: center middle` and expands horizontally while fitting vertically.

### Debugging Tip

Add a `border` to a widget to visualize its actual dimensions when alignment is not behaving as expected.

## Render vs Compose

These two widget methods serve different purposes and operate at different levels.

### `render()`

- Returns a Rich renderable (string, `Text`, `Table`, or any Rich-compatible object).
- The return value is displayed inside the widget's border, combined with CSS styles.
- Used for leaf widgets that display content directly.

### `compose()`

- Yields child widgets to build a compound widget.
- The yielded widgets define the visual appearance.
- Used for widgets that are composed of other widgets.

### Combining Both

When both methods are implemented on the same widget:

- `render()` provides the **background** layer.
- `compose()` provides the **foreground** widgets layered on top.

This enables patterns like animated gradient backgrounds behind composed widget content.

### Decision Rule

- Display simple text or a Rich renderable: use `render()`.
- Build a widget from other widgets: use `compose()`.
- Need a decorated background behind child widgets: implement both.

## Styling Inline Apps

Inline mode runs an app below the terminal prompt instead of taking over the full screen. Enabled by passing `inline=True` to `App.run()`.

### Default Inline Behavior

- The app occupies a fixed number of lines (default based on content).
- Textual adds a blank line of padding above the inline app. Remove it by setting `INLINE_PADDING = 0` on the app class.

### The `:inline` Pseudo-Selector

CSS rules targeting only inline mode use the `:inline` pseudo-selector. This allows the same app to have different styles when run inline vs fullscreen.

Common inline-specific adjustments:

- **Height**: Set `Screen { height: <N>; }` within `:inline` to control line count.
- **Border**: Set `border: none;` to remove the default border in inline mode.
- **Colors/styles**: Any CSS property can differ between inline and fullscreen modes.

Example pattern:

```css
Screen.:inline {
    height: 10;
    border: none;
}

#my-widget.:inline {
    color: green;
}
```

### Key Point

Most apps run inline without modification. The `:inline` selector is needed only when the default height, border, or styling needs adjustment for the inline context.

## Packaging with Hatch

Textual apps are packaged and distributed via PyPI like any Python library, with the addition of a CLI entry point.

### Project Initialization

- `hatch new "project name"` scaffolds the standard directory structure: `pyproject.toml`, `src/<project_name>/`, `tests/`, `LICENSE.txt`, `README.md`.
- For existing projects: `hatch new --init <project name>` generates only `pyproject.toml` in the current directory.
- Hatch uses hyphens in the top-level directory name and underscores in the Python package directory (hyphens are not valid in Python imports).

### Directory Structure

```
project-name/
  pyproject.toml
  src/
    project_name/
      __about__.py    # version string
      __init__.py
      app.py
      app.tcss
  tests/
    __init__.py
```

### Dependencies

Listed in the `dependencies` array of the `[project]` section in `pyproject.toml`. Pin versions with `==` when needed (e.g., `"textual==0.47.1"`).

### Entry Points

To make the app launchable from the command line:

1. Create a function that instantiates and runs the app.
2. Add a `[project.scripts]` section to `pyproject.toml` mapping a command name to the function: `command = "package.module:function"`.
3. Run `pip install -e .` to register the entry point in the current environment.

### Virtual Environments

- `hatch env create` creates a virtual environment for the project.
- `hatch shell` activates it.
- Virtual environments prevent dependency conflicts between projects.

### Build and Publish Workflow

1. `hatch build` produces distribution archives in `dist/`.
2. Create a PyPI account and generate an API token.
3. `hatch publish -u __token__ -a <API_TOKEN>` uploads to PyPI.
4. Update `__about__.py` version before each new release, then repeat build and publish.

### Packaging Notes

- Hatch automatically includes `.tcss` files. Other build tools may require explicit configuration to include non-`.py` files.
- Recommend users install with `pipx` instead of `pip` to avoid dependency conflicts: `pipx install project-name`.
- For first uploads, use an "Entire project" scoped API token. After the first upload, create a project-scoped token for tighter security.

### Alternative to Packaging

`textual-serve` can turn a Textual app into a web application, avoiding the packaging process entirely.
