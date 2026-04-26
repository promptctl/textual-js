"""Fixture: Horizontal container with three Static children in a row."""

from textual.app import App, ComposeResult
from textual.widgets import Static
from textual.containers import Horizontal


class ContainersHorizontalRowApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Horizontal {
        height: auto;
    }
    Static {
        width: 1fr;
    }
    """

    def compose(self) -> ComposeResult:
        with Horizontal():
            yield Static("Left")
            yield Static("Middle")
            yield Static("Right")


app = ContainersHorizontalRowApp

interactions = []
