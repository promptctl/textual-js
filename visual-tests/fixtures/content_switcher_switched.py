"""Fixture: ContentSwitcher switched to the second child after mount."""

from textual.app import App, ComposeResult
from textual.widgets import Label, ContentSwitcher


class ContentSwitcherSwitchedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with ContentSwitcher(initial="panel-a", id="switcher"):
            yield Label("A", id="panel-a")
            yield Label("B", id="panel-b")


async def capture(pilot) -> None:
    switcher = pilot.app.query_one("#switcher", ContentSwitcher)
    switcher.current = "panel-b"
    await pilot.pause(0.05)


app = ContentSwitcherSwitchedApp
