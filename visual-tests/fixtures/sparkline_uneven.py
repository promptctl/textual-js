"""Fixture: Sparkline with a single large spike among small values."""

from textual.app import App, ComposeResult
from textual.widgets import Sparkline


class SparklineUnevenApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Sparkline {
        width: 40;
        height: 3;
    }
    """

    def compose(self) -> ComposeResult:
        yield Sparkline(
            data=[1, 1, 2, 1, 2, 1, 2, 1, 50, 1, 2, 1, 2, 1, 1, 2],
        )


app = SparklineUnevenApp

interactions = []
