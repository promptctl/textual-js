"""Fixture: read-only TextArea with text."""

from textual.app import App, ComposeResult
from textual.widgets import TextArea


class TextAreaReadOnlyApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield TextArea("This TextArea is read-only.\nYou cannot edit it.", read_only=True)


app = TextAreaReadOnlyApp

interactions = []
