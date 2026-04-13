# FAQ: Common Issues, Limitations, and Patterns

## Image Support

Textual does not have built-in image rendering. The `rich-pixels` third-party package provides a Rich renderable for displaying images that is compatible with Textual.

## Version Compatibility

### ImportError for ComposeResult

An `ImportError` when importing `ComposeResult` from `textual.app` indicates an outdated Textual installation. Upgrade with:

```
pip install textual-dev -U
```

The `-U` flag forces pip to upgrade to the latest version.

### WorkerDeclarationError

Since version 0.31.0, the `@work` decorator requires explicit `thread=True` to create a threaded worker. Without it, the decorated function must be `async`:

```python
# Threaded worker (runs in a thread)
@work(thread=True)
def run_in_background():
    ...

# Async worker (runs in the event loop)
@work()
async def run_in_background():
    ...
```

Omitting `thread=True` on a non-async function raises `WorkerDeclarationError`. This was an intentional breaking change to prevent accidental creation of threaded workers.

## Text Selection and Clipboard

Textual supports native text selection via click-and-drag for most widgets. Press `Ctrl+C` to copy selected text.

For widgets that do not support Textual's built-in text selection, the terminal emulator's native selection can be used by holding a modifier key during click-and-drag:

| Terminal | Modifier Key |
|----------|-------------|
| iTerm | OPTION |
| Gnome Terminal | SHIFT |
| Windows Terminal | SHIFT |

## Terminal Compatibility

### Translucent Backgrounds

Terminal translucency effects do not work with Textual. Translucency requires ANSI background colors, which Textual does not use. Textual uses 24-bit (16.7 million) colors for consistent cross-platform rendering. See the ANSI themes section below for rationale.

### macOS Terminal.app Rendering

The default macOS Terminal.app has rendering issues with Textual, particularly with box-drawing characters causing misaligned blocks and lines.

**Workaround for Terminal.app**: Open Settings > Profiles > Text tab. Use Menlo Regular font with character spacing 1 and line spacing 0.805. Other fonts may require different line spacing values.

**Terminal.app limitations** (even with font fix):
- Limited to 256 colors (Textual uses 16.7 million)
- Slower rendering than modern alternatives

**Recommended macOS terminal emulators** (free, full color support):
- iTerm2
- Kitty
- WezTerm

### Key Combinations

Textual receives only key events that the terminal emulator forwards. Supported keys vary by terminal and operating system.

**Universally supported keys** (recommended for bindings):
- Letters, numbers
- Function keys (especially F1 through F10)
- Space, Return
- Arrow keys, Home, End, Page Up/Down
- Control, Shift modifiers

**Keys NOT typically forwarded by terminals**:
- Cmd and Option on macOS
- Windows key on Windows

The `textual keys` command (from `textual-dev`) allows testing which key combinations a terminal forwards.

## ANSI Color Themes

Textual intentionally does not generate escape sequences for the 16 themeable ANSI colors.

**Rationale**:
- ANSI color themes are user-specific. Color combinations readable on one system may be unreadable on another, with no programmatic fix available.
- ANSI colors cannot be manipulated (blended, shaded) the way Textual's color system requires. Textual blends colors to produce readable text, accessible interfaces, and light/dark shade variants.

**Textual's design system** guarantees readability across all platforms and terminals. It provides light and dark variants with plans for additional themes and per-app or per-system color customization.

**`ansi_color` opt-in** (added in version 0.80.0): Setting `App.ansi_color = True` disables Textual's ANSI color conversion, allowing ANSI theme colors to pass through. This disables transparency effects.

## Widget Centering

### Single Widget Centering

The `align` CSS property centers children within a container. It is set on the **parent**, not on the widget to be centered:

```python
class ButtonApp(App):
    CSS = """
    Screen {
        align: center middle;
    }
    """

    def compose(self) -> ComposeResult:
        yield Button("PUSH ME!")
```

### Multiple Widget Centering

When `align: center middle` is applied to a container with multiple children, the children are grouped and left-aligned relative to each other within the centered block.

To center each widget independently, wrap each in a `Center` container from `textual.containers`:

```python
from textual.containers import Center

class ButtonApp(App):
    CSS = """
    Screen {
        align: center middle;
    }
    """

    def compose(self) -> ComposeResult:
        yield Center(Button("PUSH ME!"))
        yield Center(Button("AND ME!"))
        yield Center(Button("ALSO PLEASE PUSH ME!"))
```

## Passing Arguments to an App

Override `__init__` on the `App` subclass. Call `super().__init__()` after setting instance attributes:

```python
class Greetings(App[None]):
    def __init__(self, greeting: str = "Hello", to_greet: str = "World") -> None:
        self.greeting = greeting
        self.to_greet = to_greet
        super().__init__()

    def compose(self) -> ComposeResult:
        yield Static(f"{self.greeting}, {self.to_greet}")
```

The app accepts standard positional and keyword arguments:

```python
Greetings().run()
Greetings(to_greet="davep").run()
Greetings("Well hello", "there").run()
```
