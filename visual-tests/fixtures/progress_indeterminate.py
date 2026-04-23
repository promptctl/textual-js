"""Fixture: ProgressBar in indeterminate mode (total=None)."""

from textual.app import App, ComposeResult
from textual.widgets import ProgressBar


class ProgressIndeterminateApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield ProgressBar(total=None, show_eta=False)


app = ProgressIndeterminateApp

interactions = []
