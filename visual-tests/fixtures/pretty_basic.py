"""Fixture: Pretty widget rendering a simple list."""

from textual.app import App, ComposeResult
from textual.widgets import Pretty


class PrettyBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Pretty(["alpha", "beta", "gamma"])


app = PrettyBasicApp

interactions = []
