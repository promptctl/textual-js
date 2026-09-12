"""Fixture: stacked toasts at all three severity levels."""

from textual.app import App, ComposeResult
from textual.widgets import Static

# [LAW:no-ambient-temporal-coupling] See notifications_basic.py: at Textual's 5s
# default the screenshot races the dismissal, so the captured frame is luck. Held
# open, the three stacked toasts are the resting state.
TOAST_HELD_OPEN_SECONDS = 3600

# The rack stacks in notify order, so this tuple reads top-to-bottom on screen.
TOASTS = (
    ("Informational message", "Info", "information"),
    ("Heads up about something", "Warning", "warning"),
    ("Something failed", "Error", "error"),
)


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
        for message, title, severity in TOASTS:
            self.notify(
                message, title=title, severity=severity, timeout=TOAST_HELD_OPEN_SECONDS
            )


app = NotificationsSeverityApp

interactions = [
    {"type": "wait", "ms": 100},
]
