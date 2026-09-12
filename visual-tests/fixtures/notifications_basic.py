"""Fixture: Toast notification rendered via App.notify on mount."""

from textual.app import App, ComposeResult
from textual.widgets import Static

# [LAW:no-ambient-temporal-coupling] Textual's NOTIFICATION_TIMEOUT is 5s, and the
# real-terminal path needs roughly that long to reach a stable frame twice (a
# 1500ms settle plus 5 identical polls, once for the initial render and again after
# the `wait` interaction). At the default the screenshot lands on whichever side of
# the dismissal it happens to land on, so the frame is decided by timing luck. A
# toast that never expires within the capture makes the toast the resting state,
# which is the only frame worth holding a baseline to.
TOAST_HELD_OPEN_SECONDS = 3600


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
        self.notify(
            "File saved successfully",
            title="Success",
            severity="information",
            timeout=TOAST_HELD_OPEN_SECONDS,
        )


app = NotificationsBasicApp

interactions = [
    {"type": "wait", "ms": 100},
]
