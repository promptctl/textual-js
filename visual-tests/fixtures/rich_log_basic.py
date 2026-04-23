"""Fixture: RichLog with three plain-text lines written on mount."""

from textual.app import App, ComposeResult
from textual.widgets import RichLog


class RichLogBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield RichLog()

    def on_mount(self) -> None:
        log = self.query_one(RichLog)
        log.write("first line")
        log.write("second line")
        log.write("third line")


app = RichLogBasicApp

interactions = []
