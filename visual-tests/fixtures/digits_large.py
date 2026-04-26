"""Fixture: Digits widget rendering '12:34'."""

from textual.app import App, ComposeResult
from textual.widgets import Digits


class DigitsLargeApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Digits {
        color: #55ffff;
    }
    """

    def compose(self) -> ComposeResult:
        yield Digits("12:34")


app = DigitsLargeApp

interactions = []
