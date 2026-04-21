"""Fixture: TabbedContent switched to the second tab via capture()."""

from textual.app import App, ComposeResult
from textual.widgets import Static, TabbedContent, TabPane


class TabbedContentSecondTabApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with TabbedContent(id="tabbed"):
            with TabPane("First", id="pane-one"):
                yield Static("Content of pane one")
            with TabPane("Second", id="pane-two"):
                yield Static("Content of pane two")


async def capture(pilot) -> None:
    tabbed = pilot.app.query_one("#tabbed", TabbedContent)
    tabbed.active = "pane-two"
    await pilot.pause(0.05)


app = TabbedContentSecondTabApp
