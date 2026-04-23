"""Fixture: SelectionList with four Selection tuples, none selected."""

from textual.app import App, ComposeResult
from textual.widgets import SelectionList


class SelectionListNoneSelectedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield SelectionList[str](
            ("Alpha", "alpha"),
            ("Bravo", "bravo"),
            ("Charlie", "charlie"),
            ("Delta", "delta"),
        )


app = SelectionListNoneSelectedApp

interactions = []
