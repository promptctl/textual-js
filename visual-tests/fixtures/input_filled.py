"""Fixture: Input pre-populated with a value."""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputFilledApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(value="hello world")


app = InputFilledApp

interactions = []
