"""Fixture: tab moves focus out of a focused Input and on to the next one.

The first Tab focuses the first Input; the second must leave it. A widget that
swallowed Tab would render this frame with the focus ring still on the first
Input, which is exactly the divergence this pair exists to catch.
"""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputTabOutApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(placeholder="First input", id="first")
        yield Input(placeholder="Second input", id="second")


app = InputTabOutApp

interactions = [
    {"type": "key", "keys": "Tab"},
    {"type": "wait", "ms": 50},
    {"type": "key", "keys": "Tab"},
    {"type": "wait", "ms": 50},
]
