"""Fixture: Static with embedded newlines."""

from textual.app import App, ComposeResult
from textual.widgets import Static


class StaticMultilineApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("line one\nline two\nline three")


app = StaticMultilineApp

interactions = []
