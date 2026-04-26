"""Fixture: ProgressBar at 100% progress."""

from textual.app import App, ComposeResult
from textual.widgets import ProgressBar


class ProgressCompleteApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        bar = ProgressBar(total=100, show_eta=False)
        bar.progress = 100
        yield bar


app = ProgressCompleteApp

interactions = []
