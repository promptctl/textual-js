"""Fixture: Collapsible in the expanded state."""

from textual.app import App, ComposeResult
from textual.widgets import Static, Collapsible


class CollapsibleExpandedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with Collapsible(title="Details", collapsed=False):
            yield Static("Hidden detail content")


app = CollapsibleExpandedApp

interactions = []
