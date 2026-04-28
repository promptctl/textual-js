"""Fixture: Toast notification rendered via App.notify on mount."""

from textual.app import App, ComposeResult
from textual.widgets import Static


class NotificationsBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Background content")

    def on_mount(self) -> None:
        self.notify("File saved successfully", title="Success", severity="information")


app = NotificationsBasicApp

interactions = [
    {"type": "wait", "ms": 100},
]
