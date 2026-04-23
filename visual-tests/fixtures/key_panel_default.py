"""Fixture: KeyPanel rendering app bindings."""

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import KeyPanel, Static


class KeyPanelDefaultApp(App):
    BINDINGS = [
        Binding("q", "quit", "Quit the app"),
        Binding("r", "refresh", "Refresh view"),
        Binding("s", "save", "Save document"),
    ]

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Main content area")
        yield KeyPanel()


app = KeyPanelDefaultApp

interactions = []
