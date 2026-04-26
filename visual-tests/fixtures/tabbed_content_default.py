"""Fixture: TabbedContent with two TabPanes; first active by default."""

from textual.app import App, ComposeResult
from textual.widgets import Static, TabbedContent, TabPane


class TabbedContentDefaultApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with TabbedContent():
            with TabPane("First", id="pane-one"):
                yield Static("Content of pane one")
            with TabPane("Second", id="pane-two"):
                yield Static("Content of pane two")


app = TabbedContentDefaultApp

interactions = []
