"""Fixture: Middle container vertically centring a Static."""

from textual.app import App, ComposeResult
from textual.widgets import Static
from textual.containers import Middle


class ContainersMiddleApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with Middle():
            yield Static("Vertically centered")


app = ContainersMiddleApp

interactions = []
