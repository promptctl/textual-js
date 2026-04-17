"""Fixture: Static widget displaying plain text."""

from textual.app import App, ComposeResult
from textual.widgets import Static


class StaticBasicApp(App):
    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Hello World")
        yield Static("Second line of text")
        yield Static("")  # empty static


app = StaticBasicApp
