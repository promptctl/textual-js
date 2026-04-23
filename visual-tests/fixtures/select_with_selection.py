"""Fixture: Select control with value="b" preselected."""

from textual.app import App, ComposeResult
from textual.widgets import Select


class SelectWithSelectionApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Select.from_values(["a", "b", "c"], value="b")


app = SelectWithSelectionApp

interactions = []
