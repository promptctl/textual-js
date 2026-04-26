"""Fixture: default Header rendering the App title."""

from textual.app import App, ComposeResult
from textual.widgets import Header, Static


class HeaderDefaultApp(App):
    TITLE = "My Application"

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header()
        yield Static("Body content")


app = HeaderDefaultApp

interactions = []
