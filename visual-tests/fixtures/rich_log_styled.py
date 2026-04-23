"""Fixture: RichLog writing Rich Text with explicit colors."""

from rich.text import Text

from textual.app import App, ComposeResult
from textual.widgets import RichLog


class RichLogStyledApp(App):
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
        log.write(Text("red line", style="red"))
        log.write(Text("green line", style="green"))
        log.write(Text("blue line", style="bold blue"))


app = RichLogStyledApp

interactions = []
