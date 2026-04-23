"""Fixture: two disabled Switches, one on and one off."""

from textual.app import App, ComposeResult
from textual.containers import Horizontal
from textual.widgets import Switch


class SwitchDisabledApp(App):
    CSS = """
    Screen {
        background: $background;
    }
    Horizontal {
        height: auto;
    }
    """

    def compose(self) -> ComposeResult:
        with Horizontal():
            yield Switch(value=False, disabled=True)
            yield Switch(value=True, disabled=True)


app = SwitchDisabledApp

interactions = []
