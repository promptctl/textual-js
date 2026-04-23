"""Fixture: Vertical container stacking three Static children."""

from textual.app import App, ComposeResult
from textual.widgets import Static
from textual.containers import Vertical


class ContainersVerticalStackApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with Vertical():
            yield Static("First")
            yield Static("Second")
            yield Static("Third")


app = ContainersVerticalStackApp

interactions = []
