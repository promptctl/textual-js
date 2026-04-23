"""Fixture: Center container horizontally centring a Button."""

from textual.app import App, ComposeResult
from textual.widgets import Button
from textual.containers import Center


class ContainersCenterApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        with Center():
            yield Button("Centered", variant="primary")


app = ContainersCenterApp

interactions = []
