"""Fixture: RadioSet with three options and no initial selection."""

from textual.app import App, ComposeResult
from textual.widgets import RadioSet


class RadioSetDefaultApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield RadioSet("Option A", "Option B", "Option C")


app = RadioSetDefaultApp

interactions = []
