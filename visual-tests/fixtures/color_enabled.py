from rich.text import Text
from textual.app import App, ComposeResult
from textual.containers import Horizontal
from textual.widgets import Static


class ColorEnabledApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }

    Horizontal {
        height: auto;
    }

    Static {
        width: auto;
    }
    """

    def compose(self) -> ComposeResult:
        with Horizontal():
            yield Static(Text("same", style="#ff5555 on #330000"))
            yield Static(" ")
            yield Static(Text("same", style="#55ff55 on #003300"))


app = ColorEnabledApp

interactions = []
