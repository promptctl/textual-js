"""Fixture: single default Placeholder."""

from textual.app import App, ComposeResult
from textual.widgets import Placeholder


class PlaceholderDefaultApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Placeholder {
        height: 5;
    }
    """

    def compose(self) -> ComposeResult:
        yield Placeholder()


app = PlaceholderDefaultApp

interactions = []
