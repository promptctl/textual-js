"""Fixture: vertical Rule between two Labels inside a Horizontal."""

from textual.app import App, ComposeResult
from textual.containers import Horizontal
from textual.widgets import Label, Rule


class RuleVerticalApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Horizontal {
        height: 5;
    }
    """

    def compose(self) -> ComposeResult:
        with Horizontal():
            yield Label("Left side")
            yield Rule(orientation="vertical")
            yield Label("Right side")


app = RuleVerticalApp

interactions = []
