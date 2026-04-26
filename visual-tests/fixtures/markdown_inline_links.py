"""Fixture: Markdown with inline links."""

from textual.app import App, ComposeResult
from textual.widgets import Markdown

MARKDOWN_CONTENT = """\
Visit the [Textual docs](https://textual.textualize.io) or the
[GitHub repo](https://github.com/Textualize/textual) for more info.
"""


class MarkdownInlineLinksApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Markdown(MARKDOWN_CONTENT)


app = MarkdownInlineLinksApp

interactions = []
