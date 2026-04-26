"""Fixture: single Label with plain text."""

from textual.app import App, ComposeResult
from textual.widgets import Label


class LabelBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Label("Hello Label")


app = LabelBasicApp

interactions = []
