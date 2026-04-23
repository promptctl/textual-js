"""Fixture: ListView with four ListItems wrapping Labels."""

from textual.app import App, ComposeResult
from textual.widgets import Label, ListView, ListItem


class ListViewBasicApp(App):
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
        )


app = ListViewBasicApp

interactions = []
