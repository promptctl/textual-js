"""Fixture: Pretty widget rendering a nested dict."""

from textual.app import App, ComposeResult
from textual.widgets import Pretty


class PrettyNestedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Pretty(
            {
                "name": "widget",
                "counts": {"hits": 1, "misses": 2},
                "tags": ["a", "b", "c"],
            }
        )


app = PrettyNestedApp

interactions = []
