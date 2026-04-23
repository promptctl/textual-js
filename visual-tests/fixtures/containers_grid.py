"""Fixture: Grid container with a 2x2 grid layout."""

from textual.app import App, ComposeResult
from textual.widgets import Static
from textual.containers import Grid


class ContainersGridApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Grid {
        grid-size: 2 2;
    }
    """

    def compose(self) -> ComposeResult:
        with Grid():
            yield Static("Cell 1")
            yield Static("Cell 2")
            yield Static("Cell 3")
            yield Static("Cell 4")


app = ContainersGridApp

interactions = []
