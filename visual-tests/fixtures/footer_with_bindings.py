"""Fixture: Footer showing key bindings defined on the app."""

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Footer, Static


class FooterWithBindingsApp(App):
    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("s", "save", "Save"),
        Binding("ctrl+r", "reload", "Reload"),
    ]

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Body content")
        yield Footer()

    def action_save(self) -> None:
        pass

    def action_reload(self) -> None:
        pass


app = FooterWithBindingsApp

interactions = []
