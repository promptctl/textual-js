"""Fixture: ListView with the second ListItem highlighted via initial_index."""

from textual.app import App, ComposeResult
from textual.widgets import Label, ListView, ListItem


class ListViewHighlightedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield ListView(
            ListItem(Label("Alpha")),
            ListItem(Label("Bravo")),
            ListItem(Label("Charlie")),
            ListItem(Label("Delta")),
            initial_index=1,
        )


app = ListViewHighlightedApp

interactions = []
