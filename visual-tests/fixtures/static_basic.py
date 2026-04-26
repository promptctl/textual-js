"""Fixture: Static widget displaying plain text."""

from textual.app import App, ComposeResult
from textual.widgets import Static


class StaticBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Hello World")
        yield Static("Second line of text")
        yield Static("")  # empty static


app = StaticBasicApp

interactions = []
