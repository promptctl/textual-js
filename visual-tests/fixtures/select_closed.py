"""Fixture: Select control built via from_values with dropdown closed (initial state)."""

from textual.app import App, ComposeResult
from textual.widgets import Select


class SelectClosedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Select.from_values(["a", "b", "c"])


app = SelectClosedApp

interactions = []
