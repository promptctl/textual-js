"""Fixture: LoadingIndicator on its own."""

from textual.app import App, ComposeResult
from textual.widgets import LoadingIndicator


class LoadingIndicatorApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    LoadingIndicator {
        height: 3;
    }
    """

    def compose(self) -> ComposeResult:
        yield LoadingIndicator()


app = LoadingIndicatorApp

interactions = []
