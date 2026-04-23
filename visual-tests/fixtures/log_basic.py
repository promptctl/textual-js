"""Fixture: Log widget with multiple lines written via write_line on mount."""

from textual.app import App, ComposeResult
from textual.widgets import Log


class LogBasicApp(App):
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
        log.write_line("boot: starting services")
        log.write_line("boot: loading config")
        log.write_line("boot: ready")


app = LogBasicApp

interactions = []
