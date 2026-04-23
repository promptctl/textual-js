"""Fixture: Markdown with ordered and unordered lists."""

from textual.app import App, ComposeResult
from textual.widgets import Markdown

MARKDOWN_CONTENT = """\
Unordered:

- Apple
- Banana
- Cherry

Ordered:

1. First
2. Second
3. Third
"""


class MarkdownListsApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Markdown(MARKDOWN_CONTENT)


app = MarkdownListsApp

interactions = []
