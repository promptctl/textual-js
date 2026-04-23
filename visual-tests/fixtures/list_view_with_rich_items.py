"""Fixture: ListView containing ListItems with Horizontal layouts of two Statics each."""

from textual.app import App, ComposeResult
from textual.widgets import Static, ListView, ListItem
from textual.containers import Horizontal


class ListViewWithRichItemsApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    ListItem Horizontal {
        height: auto;
    }
    ListItem Static {
        width: 1fr;
    }
    """

    def compose(self) -> ComposeResult:
        yield ListView(
            ListItem(Horizontal(Static("Alpha"), Static("[green]ready[/]"))),
            ListItem(Horizontal(Static("Bravo"), Static("[yellow]pending[/]"))),
            ListItem(Horizontal(Static("Charlie"), Static("[red]error[/]"))),
        )


app = ListViewWithRichItemsApp

interactions = []
