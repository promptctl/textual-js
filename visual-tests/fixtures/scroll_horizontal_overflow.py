"""Fixture: HorizontalScroll containing wide content to force horizontal overflow."""

from textual.app import App, ComposeResult
from textual.widgets import Static
from textual.containers import HorizontalScroll


class ScrollHorizontalOverflowApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Static {
        width: 20;
        height: 3;
    }
    """

    def compose(self) -> ComposeResult:
        with HorizontalScroll():
            for i in range(10):
                yield Static(f"Column {i:02d}")


app = ScrollHorizontalOverflowApp

interactions = []
