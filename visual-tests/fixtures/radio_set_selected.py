"""Fixture: RadioSet with three options and one pre-selected."""

from textual.app import App, ComposeResult
from textual.widgets import RadioButton, RadioSet


class RadioSetSelectedApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield RadioSet(
            RadioButton("Option A"),
            RadioButton("Option B", value=True),
            RadioButton("Option C"),
        )


app = RadioSetSelectedApp

interactions = []
