"""Fixture: Tree with root 'root' and 3 children."""

from textual.app import App, ComposeResult
from textual.widgets import Tree


class TreeBasicApp(App):
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
        tree.root.add_leaf("child-one")
        tree.root.add_leaf("child-two")
        tree.root.add_leaf("child-three")


app = TreeBasicApp

interactions = []
