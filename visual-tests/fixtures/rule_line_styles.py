"""Fixture: horizontal rules with a variety of line_style values."""

from textual.app import App, ComposeResult
from textual.widgets import Label, Rule


class RuleLineStylesApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Label("solid")
        yield Rule(line_style="solid")
        yield Label("dashed")
        yield Rule(line_style="dashed")
        yield Label("heavy")
        yield Rule(line_style="heavy")
        yield Label("double")
        yield Rule(line_style="double")
        yield Label("ascii")
        yield Rule(line_style="ascii")
        yield Label("thick")
        yield Rule(line_style="thick")


app = RuleLineStylesApp

interactions = []
