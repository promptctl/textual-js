"""Fixture: Welcome widget as the only mounted child."""

from textual.app import App, ComposeResult
from textual.widgets import Welcome


class WelcomeDefaultApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Welcome()


app = WelcomeDefaultApp

interactions = []
