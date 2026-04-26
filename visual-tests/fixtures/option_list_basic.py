"""Fixture: OptionList with five plain string options."""

from textual.app import App, ComposeResult
from textual.widgets import OptionList


class OptionListBasicApp(App):
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


app = OptionListBasicApp

interactions = []
