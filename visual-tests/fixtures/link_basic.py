"""Fixture: Link widget with text and url."""

from textual.app import App, ComposeResult
from textual.widgets import Link


class LinkBasicApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Link("Textual docs", url="https://textual.textualize.io")


app = LinkBasicApp

interactions = []
