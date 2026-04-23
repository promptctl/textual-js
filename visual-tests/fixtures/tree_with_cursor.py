"""Fixture: Tree with cursor arrowed down to highlight the second node."""

from textual.app import App, ComposeResult
from textual.widgets import Tree


class TreeWithCursorApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Tree("root")

    def on_mount(self) -> None:
        tree = self.query_one(Tree)
        tree.root.add_leaf("first")
        tree.root.add_leaf("second")
        tree.root.add_leaf("third")
        tree.root.expand()
        tree.focus()


app = TreeWithCursorApp

interactions = [
    {"type": "key", "keys": "Down"},
    {"type": "key", "keys": "Down"},
    {"type": "wait", "ms": 50},
]
