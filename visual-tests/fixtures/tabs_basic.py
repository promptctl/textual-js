"""Fixture: Tabs with three Tab widgets; first tab active by default."""

from textual.app import App, ComposeResult
from textual.widgets import Tabs, Tab


class TabsBasicApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Tabs(
            Tab("One", id="tab-one"),
            Tab("Two", id="tab-two"),
            Tab("Three", id="tab-three"),
        )


app = TabsBasicApp

interactions = []
