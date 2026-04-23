"""Fixture: Sparkline summarising buckets with min()."""

from textual.app import App, ComposeResult
from textual.widgets import Sparkline


class SparklineSummaryMinApp(App):
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
            data=[5, 1, 4, 2, 8, 3, 9, 2, 7, 1, 6, 4, 8, 2, 9, 3],
            summary_function=min,
        )


app = SparklineSummaryMinApp

interactions = []
