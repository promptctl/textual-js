"""Fixture: empty Input with placeholder."""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputEmptyApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(placeholder="Type something...")


app = InputEmptyApp

interactions = []
