"""Fixture: Sparkline with monotonically increasing data."""

from textual.app import App, ComposeResult
from textual.widgets import Sparkline


class SparklineBasicApp(App):
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
        yield Sparkline(data=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10])


app = SparklineBasicApp

interactions = []
