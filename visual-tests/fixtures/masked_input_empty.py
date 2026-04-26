"""Fixture: empty MaskedInput with a credit-card-style template."""

from textual.app import App, ComposeResult
from textual.widgets import MaskedInput


class MaskedInputEmptyApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield MaskedInput(template="9999-9999-9999-9999;0")


app = MaskedInputEmptyApp

interactions = []
