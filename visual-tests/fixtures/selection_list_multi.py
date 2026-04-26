"""Fixture: SelectionList with several options preselected."""

from textual.app import App, ComposeResult
from textual.widgets import SelectionList


class SelectionListMultiApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield SelectionList[str](
            ("Alpha", "alpha", True),
            ("Bravo", "bravo", False),
            ("Charlie", "charlie", True),
            ("Delta", "delta", True),
        )


app = SelectionListMultiApp

interactions = []
