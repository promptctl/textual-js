"""Fixture: Input receiving focus via tab press."""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputFocusedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(placeholder="Focused input", id="target")


async def capture(pilot) -> None:
    await pilot.press("tab")
    await pilot.pause(0.05)


app = InputFocusedApp
