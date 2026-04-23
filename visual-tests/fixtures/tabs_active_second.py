"""Fixture: Tabs with second tab activated via capture()."""

from textual.app import App, ComposeResult
from textual.widgets import Tabs, Tab


class TabsActiveSecondApp(App):
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


    def on_mount(self) -> None:
        self.query_one(Tabs).active = "tab-two"


app = TabsActiveSecondApp


interactions = []
