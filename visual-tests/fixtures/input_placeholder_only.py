"""Fixture: Input displaying only a placeholder (no value, unfocused)."""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputPlaceholderOnlyApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(placeholder="Enter your name")


app = InputPlaceholderOnlyApp

interactions = []
