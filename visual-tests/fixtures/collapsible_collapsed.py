"""Fixture: Collapsible in the collapsed state."""

from textual.app import App, ComposeResult
from textual.widgets import Static, Collapsible


class CollapsibleCollapsedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with Collapsible(title="Details", collapsed=True):
            yield Static("Hidden detail content")


app = CollapsibleCollapsedApp

interactions = []
