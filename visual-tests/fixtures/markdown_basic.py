"""Fixture: Markdown with a paragraph and inline styling (bold, italic, code)."""

from textual.app import App, ComposeResult
from textual.widgets import Markdown

MARKDOWN_CONTENT = """\
A paragraph with **bold**, *italic*, and `inline code` styling.
"""


class MarkdownBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Markdown(MARKDOWN_CONTENT)


app = MarkdownBasicApp

interactions = []
