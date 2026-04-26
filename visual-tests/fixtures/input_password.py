"""Fixture: Input in password mode obscuring its value."""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputPasswordApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(value="supersecret", password=True)


app = InputPasswordApp

interactions = []
