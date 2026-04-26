"""Fixture: TextArea that is focused via pilot.press('tab')."""

from textual.app import App, ComposeResult
from textual.widgets import TextArea


class TextAreaFocusedApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield TextArea("focus me")


app = TextAreaFocusedApp

interactions = [
    {"type": "key", "keys": "Tab"},
    {"type": "wait", "ms": 50},
]
