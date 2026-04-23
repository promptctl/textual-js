"""Fixture: Markdown with a blockquote and a horizontal rule."""

from textual.app import App, ComposeResult
from textual.widgets import Markdown

MARKDOWN_CONTENT = """\
> A wise quote that spans
> a couple of lines.

---

Paragraph after the rule.
"""


class MarkdownBlockquoteApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Markdown(MARKDOWN_CONTENT)


app = MarkdownBlockquoteApp

interactions = []
