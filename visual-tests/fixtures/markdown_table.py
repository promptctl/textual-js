"""Fixture: Markdown with a small 3x3 table."""

from textual.app import App, ComposeResult
from textual.widgets import Markdown

MARKDOWN_CONTENT = """\
| Name  | Role | Team |
| ----- | ---- | ---- |
| Alice | Dev  | Blue |
| Bob   | Ops  | Red  |
| Carol | QA   | Gold |
"""


class MarkdownTableApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Markdown(MARKDOWN_CONTENT)


app = MarkdownTableApp

interactions = []
