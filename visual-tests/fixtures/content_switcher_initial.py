"""Fixture: ContentSwitcher initially showing the first child."""

from textual.app import App, ComposeResult
from textual.widgets import Label, ContentSwitcher


class ContentSwitcherInitialApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with ContentSwitcher(initial="panel-a"):
            yield Label("A", id="panel-a")
            yield Label("B", id="panel-b")


app = ContentSwitcherInitialApp

interactions = []
