"""Fixture: disabled RadioSet with three options."""

from textual.app import App, ComposeResult
from textual.widgets import RadioSet


class RadioSetDisabledApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield RadioSet("Option A", "Option B", "Option C", disabled=True)


app = RadioSetDisabledApp

interactions = []
