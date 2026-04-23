"""Fixture: loose RadioButton widgets in checked and unchecked states."""

from textual.app import App, ComposeResult
from textual.widgets import RadioButton


class RadioButtonStatesApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield RadioButton("Unselected option", value=False)
        yield RadioButton("Selected option", value=True)


app = RadioButtonStatesApp

interactions = []
