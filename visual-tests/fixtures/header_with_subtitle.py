"""Fixture: Header rendering both a title and a sub_title."""

from textual.app import App, ComposeResult
from textual.widgets import Header, Static


class HeaderWithSubtitleApp(App):
    TITLE = "My Application"
    SUB_TITLE = "Status: ready"

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header()
        yield Static("Body content")


app = HeaderWithSubtitleApp

interactions = []
