"""Fixture: Buttons with all five variants."""

from textual.app import App, ComposeResult
from textual.widgets import Button
from textual.containers import Horizontal


class ButtonVariantsApp(App):
    CSS = """
    Screen {
        background: $background;
    }
    Horizontal {
        height: auto;
    }
    """

    def compose(self) -> ComposeResult:
        with Horizontal():
            yield Button("Default", variant="default")
            yield Button("Primary", variant="primary")
            yield Button("Success", variant="success")
            yield Button("Warning", variant="warning")
            yield Button("Error", variant="error")


app = ButtonVariantsApp

interactions = []
