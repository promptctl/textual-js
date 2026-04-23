"""Fixture: Input receiving focus via tab press."""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputFocusedApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(placeholder="Focused input", id="target")


app = InputFocusedApp

interactions = [
    {"type": "key", "keys": "Tab"},
    {"type": "wait", "ms": 50},
]
