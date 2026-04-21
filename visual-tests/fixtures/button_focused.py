"""Fixture: Button receiving focus via tab press."""

from textual.app import App, ComposeResult
from textual.widgets import Button


class ButtonFocusedApp(App):
    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield Button("Focus me", variant="primary", id="target")


async def capture(pilot) -> None:
    await pilot.press("tab")
    await pilot.pause(0.05)


app = ButtonFocusedApp
