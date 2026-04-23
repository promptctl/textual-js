"""Fixture: RichLog with highlight=True and a Python-ish log line."""

from textual.app import App, ComposeResult
from textual.widgets import RichLog


class RichLogHighlightApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield RichLog(highlight=True)

    def on_mount(self) -> None:
        log = self.query_one(RichLog)
        log.write("x = 42 and name = 'alice'")
        log.write("user = {'id': 7, 'active': True}")
        log.write("path = '/tmp/foo.txt'")


app = RichLogHighlightApp

interactions = []
