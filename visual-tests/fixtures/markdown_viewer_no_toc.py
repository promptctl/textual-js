"""Fixture: MarkdownViewer with table of contents disabled."""

from textual.app import App, ComposeResult
from textual.widgets import MarkdownViewer

MARKDOWN_CONTENT = """\
# Introduction

Opening paragraph.

## Background

Some context.

## Details

More info.
"""


class MarkdownViewerNoTocApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield MarkdownViewer(MARKDOWN_CONTENT, show_table_of_contents=False)


app = MarkdownViewerNoTocApp

interactions = []
