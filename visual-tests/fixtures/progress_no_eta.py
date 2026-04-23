"""Fixture: ProgressBar at 50% with show_eta disabled."""

from textual.app import App, ComposeResult
from textual.widgets import ProgressBar


class ProgressNoEtaApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        bar = ProgressBar(total=100, show_eta=False)
        bar.progress = 50
        yield bar


app = ProgressNoEtaApp

interactions = []
