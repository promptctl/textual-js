"""Fixture: disabled Checkbox."""

from textual.app import App, ComposeResult
from textual.widgets import Checkbox


class CheckboxDisabledApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Checkbox("Disabled option", value=False, disabled=True)
        yield Checkbox("Disabled checked", value=True, disabled=True)


app = CheckboxDisabledApp

interactions = []
