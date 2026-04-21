"""Fixture: TextArea that is focused via pilot.press('tab')."""

from textual.app import App, ComposeResult
from textual.widgets import TextArea


class TextAreaFocusedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield TextArea("focus me")


async def capture(pilot) -> None:
    await pilot.press("tab")
    await pilot.pause(0.05)


app = TextAreaFocusedApp
