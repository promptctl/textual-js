"""Fixture: empty TextArea."""

from textual.app import App, ComposeResult
from textual.widgets import TextArea


class TextAreaEmptyApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield TextArea()


app = TextAreaEmptyApp

interactions = []
