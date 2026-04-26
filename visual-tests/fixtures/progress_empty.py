"""Fixture: ProgressBar at 0% progress."""

from textual.app import App, ComposeResult
from textual.widgets import ProgressBar


class ProgressEmptyApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        bar = ProgressBar(total=100, show_eta=False)
        bar.progress = 0
        yield bar


app = ProgressEmptyApp

interactions = []
