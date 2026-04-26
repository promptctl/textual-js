"""Fixture: Button receiving focus via tab press."""

from textual.app import App, ComposeResult
from textual.widgets import Button


class ButtonFocusedApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield Button("Focus me", variant="primary", id="target")


app = ButtonFocusedApp

interactions = [
    {"type": "key", "keys": "Tab"},
    {"type": "wait", "ms": 50},
]
