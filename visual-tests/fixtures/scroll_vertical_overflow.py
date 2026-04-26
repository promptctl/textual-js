"""Fixture: VerticalScroll containing 30 Static rows for vertical overflow."""

from textual.app import App, ComposeResult
from textual.widgets import Static
from textual.containers import VerticalScroll


class ScrollVerticalOverflowApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with VerticalScroll():
            for i in range(30):
                yield Static(f"Row {i:02d}")


app = ScrollVerticalOverflowApp

interactions = []
