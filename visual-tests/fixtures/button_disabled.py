"""Fixture: disabled Button in each variant."""

from textual.app import App, ComposeResult
from textual.containers import Horizontal
from textual.widgets import Button


class ButtonDisabledApp(App):
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
            yield Button("Default", variant="default", disabled=True)
            yield Button("Primary", variant="primary", disabled=True)
            yield Button("Success", variant="success", disabled=True)
            yield Button("Warning", variant="warning", disabled=True)
            yield Button("Error", variant="error", disabled=True)


app = ButtonDisabledApp

interactions = []
