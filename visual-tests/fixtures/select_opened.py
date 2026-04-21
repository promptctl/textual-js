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


async def capture(pilot) -> None:
    select = pilot.app.query_one(Select)
    select.focus()
    await pilot.pause(0.05)
    select.expanded = True
    await pilot.pause(0.1)


app = SelectOpenedApp
