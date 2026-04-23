"""Fixture: Footer rendered with no app-level bindings."""

from textual.app import App, ComposeResult
from textual.widgets import Footer, Static


class FooterEmptyApp(App):
    BINDINGS = []

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Body content")
        yield Footer(show_command_palette=False)


app = FooterEmptyApp

interactions = []
