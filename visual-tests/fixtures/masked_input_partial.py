"""Fixture: MaskedInput with a partially typed value."""

from textual.app import App, ComposeResult
from textual.widgets import MaskedInput


class MaskedInputPartialApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield MaskedInput(template="9999-9999-9999-9999;0", value="1234-56")


app = MaskedInputPartialApp

interactions = []
