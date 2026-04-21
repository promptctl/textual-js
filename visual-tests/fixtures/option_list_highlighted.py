"""Fixture: OptionList with the second option highlighted via arrow key."""

from textual.app import App, ComposeResult
from textual.widgets import OptionList


class OptionListHighlightedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield OptionList(
            "Alpha",
            "Bravo",
            "Charlie",
            "Delta",
            "Echo",
        )


async def capture(pilot) -> None:
    pilot.app.query_one(OptionList).focus()
    await pilot.pause(0.05)
    await pilot.press("down")
    await pilot.pause(0.05)


app = OptionListHighlightedApp
