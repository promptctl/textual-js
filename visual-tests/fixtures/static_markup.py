"""Fixture: Static with inline Rich markup."""

from textual.app import App, ComposeResult
from textual.widgets import Static


class StaticMarkupApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("[bold]Bold[/] plain [italic]italic[/] text")
        yield Static("[#ff5555]Red[/] and [#55ff55]green[/] words")
        yield Static("[bold #ffaa00]Warning:[/] combined styles")


app = StaticMarkupApp

interactions = []
