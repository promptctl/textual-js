"""Fixture: OptionList with separators (None entries) between groups of options."""

from textual.app import App, ComposeResult
from textual.widgets import OptionList


class OptionListWithSeparatorsApp(App):
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
            None,
            "Charlie",
            "Delta",
            None,
            "Echo",
        )


app = OptionListWithSeparatorsApp

interactions = []
