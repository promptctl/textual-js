"""Fixture: Switch receiving focus via tab press."""

from textual.app import App, ComposeResult
from textual.widgets import Switch


class SwitchFocusedApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: $background;
    }
    """

    def compose(self) -> ComposeResult:
        yield Switch(value=False, id="target")


app = SwitchFocusedApp

interactions = [
    {"type": "key", "keys": "Tab"},
    {"type": "wait", "ms": 50},
]
