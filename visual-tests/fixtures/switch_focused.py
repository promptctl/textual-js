"""Fixture: Switch receiving focus via tab press."""

from textual.app import App, ComposeResult
from textual.widgets import Switch


class SwitchFocusedApp(App):
    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield Switch(value=False, id="target")


async def capture(pilot) -> None:
    await pilot.press("tab")
    await pilot.pause(0.05)


app = SwitchFocusedApp
