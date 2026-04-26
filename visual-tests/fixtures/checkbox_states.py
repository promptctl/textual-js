"""Fixture: Checkboxes in checked and unchecked states."""

from textual.app import App, ComposeResult
from textual.widgets import Checkbox


class CheckboxStatesApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Checkbox("Unchecked option", value=False)
        yield Checkbox("Checked option", value=True)


app = CheckboxStatesApp

interactions = []
