"""Fixture: Log widget receiving a single multi-line string via write()."""

from textual.app import App, ComposeResult
from textual.widgets import Log


BLOCK = """line one of the block
line two of the block
line three of the block
line four of the block"""


class LogMultilineApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Log()

    def on_mount(self) -> None:
        log = self.query_one(Log)
        log.write(BLOCK)


app = LogMultilineApp

interactions = []
