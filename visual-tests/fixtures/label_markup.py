"""Fixture: Label rendering Rich markup."""

from textual.app import App, ComposeResult
from textual.widgets import Label


class LabelMarkupApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Label("[bold #55ffff]Label[/] with [italic #ff55ff]markup[/]")


app = LabelMarkupApp

interactions = []
