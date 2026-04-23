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


    def on_mount(self) -> None:
        self.query_one("#tabbed", TabbedContent).active = "pane-two"


app = TabbedContentSecondTabApp


interactions = []
