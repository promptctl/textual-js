"""Fixture: Digits widget displaying '3.14'."""

from textual.app import App, ComposeResult
from textual.widgets import Digits


class DigitsBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Digits("3.14")


app = DigitsBasicApp

interactions = []
