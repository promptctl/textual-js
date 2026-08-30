"""Fixture: Input under a `text-style` rule.

Pins that the cascade's `text-style` reaches the Input's value and renders the
same weight Textual gives it — dropping it on the JS side moves 748 pixels.

It does **not** pin the other half of the rule, that the style stays off the
▔ ▁ ▊ ▎ border glyphs: those are solid block characters, which xterm draws
identically bold or not, so a style that leaked onto them is pixel-identical
here. That half is asserted at the escape-sequence level instead, by
"scopes a text-style rule to the value" in tests/input-render.test.tsx.
Both were confirmed by mutation — this one catches the style being dropped,
that one catches it spreading.
"""

from textual.app import App, ComposeResult
from textual.widgets import Input


class InputTextStyleApp(App):
    AUTO_FOCUS = None

    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Input {
        text-style: bold;
    }
    """

    def compose(self) -> ComposeResult:
        yield Input(value="hello world")


app = InputTextStyleApp

interactions = []
