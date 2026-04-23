"""Fixture: Link with custom CSS color."""

from textual.app import App, ComposeResult
from textual.widgets import Link


class LinkStyledApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Link {
        color: #ff55ff;
        text-style: bold underline;
    }
    """

    def compose(self) -> ComposeResult:
        yield Link("Styled link", url="https://example.com")


app = LinkStyledApp

interactions = []
