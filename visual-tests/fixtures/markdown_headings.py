"""Fixture: Markdown with h1 and h2 headings."""

from textual.app import App, ComposeResult
from textual.widgets import Markdown

MARKDOWN_CONTENT = """\
# Heading One

Intro paragraph.

## Heading Two

Second paragraph.
"""


class MarkdownHeadingsApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Markdown(MARKDOWN_CONTENT)


app = MarkdownHeadingsApp

interactions = []
