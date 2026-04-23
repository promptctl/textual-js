"""Fixture: TextArea pre-populated with multi-line text."""

from textual.app import App, ComposeResult
from textual.widgets import TextArea


SAMPLE = """The quick brown fox
jumps over the lazy dog.
Line three has more words.
Line four ends it."""


class TextAreaFilledApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield TextArea(SAMPLE)


app = TextAreaFilledApp

interactions = []
