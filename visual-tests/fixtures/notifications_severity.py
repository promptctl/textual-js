"""Fixture: stacked toasts at all three severity levels."""

from textual.app import App, ComposeResult
from textual.widgets import Static


class NotificationsSeverityApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Background content")

    def on_mount(self) -> None:
        self.notify("Informational message", title="Info", severity="information")
        self.notify("Heads up about something", title="Warning", severity="warning")
        self.notify("Something failed", title="Error", severity="error")


app = NotificationsSeverityApp

interactions = [
    {"type": "wait", "ms": 100},
]
