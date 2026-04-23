"""Fixture: OptionList with the second option highlighted via arrow key."""

from textual.app import App, ComposeResult
from textual.widgets import OptionList


class OptionListHighlightedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield OptionList(
            "Alpha",
            "Bravo",
            "Charlie",
            "Delta",
            "Echo",
        )


    def on_mount(self) -> None:
        # OptionList needs focus before arrow keys move the highlight.
        self.query_one(OptionList).focus()


app = OptionListHighlightedApp

interactions = [
    {"type": "key", "keys": "Down"},
    {"type": "wait", "ms": 50},
]
