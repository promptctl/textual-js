"""Fixture: default horizontal Rule between two Labels."""

from textual.app import App, ComposeResult
from textual.widgets import Label, Rule


class RuleHorizontalApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Label("Above the rule")
        yield Rule()
        yield Label("Below the rule")


app = RuleHorizontalApp

interactions = []
