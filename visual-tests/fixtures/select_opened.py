"""Fixture: Select control with dropdown opened via capture()."""

from textual.app import App, ComposeResult
from textual.widgets import Select


class SelectOpenedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Select.from_values(["a", "b", "c"])


    def on_mount(self) -> None:
        # Expand the dropdown from the app itself; pilot is not available in
        # real-terminal mode and the initial-state fixture is simpler.
        select = self.query_one(Select)
        select.focus()
        select.expanded = True


app = SelectOpenedApp


interactions = []
