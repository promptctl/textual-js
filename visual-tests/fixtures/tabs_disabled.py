"""Fixture: Tabs where the middle tab is disabled."""

from textual.app import App, ComposeResult
from textual.widgets import Tabs, Tab


class TabsDisabledApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Tabs(
            Tab("One", id="tab-one"),
            Tab("Two", id="tab-two", disabled=True),
            Tab("Three", id="tab-three"),
        )


app = TabsDisabledApp

interactions = []
