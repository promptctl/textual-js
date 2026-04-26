"""Fixture: Placeholders in each available variant (default, size, text)."""

from textual.app import App, ComposeResult
from textual.widgets import Placeholder


class PlaceholderVariantsApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Placeholder {
        height: 5;
    }
    """

    def compose(self) -> ComposeResult:
        yield Placeholder(variant="default", label="Default")
        yield Placeholder(variant="size", label="Size")
        yield Placeholder(variant="text", label="Text")


app = PlaceholderVariantsApp

interactions = []
