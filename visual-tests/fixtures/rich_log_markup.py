"""Fixture: RichLog with markup=True; written strings use [bold]/[italic]/color tags."""

from textual.app import App, ComposeResult
from textual.widgets import RichLog


class RichLogMarkupApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield RichLog(markup=True)

    def on_mount(self) -> None:
        log = self.query_one(RichLog)
        log.write("[bold]bold text[/bold] and plain")
        log.write("[italic #ff5555]italic red[/]")
        log.write("[on blue]on blue background[/]")


app = RichLogMarkupApp

interactions = []
