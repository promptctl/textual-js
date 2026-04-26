"""Fixture: Switch in on and off states."""

from textual.app import App, ComposeResult
from textual.widgets import Switch, Static
from textual.containers import Horizontal


class SwitchStatesApp(App):
    CSS = """
    Screen {
        background: $background;
    }
    Horizontal {
        height: auto;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("Switch states:")
        with Horizontal():
            yield Switch(value=False)
            yield Switch(value=True)


app = SwitchStatesApp

interactions = []
