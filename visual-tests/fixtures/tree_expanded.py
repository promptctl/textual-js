"""Fixture: Tree where root and children are expanded on mount."""

from textual.app import App, ComposeResult
from textual.widgets import Tree


class TreeExpandedApp(App):
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
        branch_a = tree.root.add("branch-a", expand=True)
        branch_a.add_leaf("a-1")
        branch_a.add_leaf("a-2")
        branch_b = tree.root.add("branch-b", expand=True)
        branch_b.add_leaf("b-1")
        branch_b.add_leaf("b-2")
        tree.root.expand()


app = TreeExpandedApp

interactions = []
