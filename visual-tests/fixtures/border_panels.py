"""Fixture: the border styles with a reversed cell, one Placeholder each, in a truecolor border.

panel and tall have a reversed `▊` down the left edge, and tab and wide have one
down the right. The border colour fills that cell and the glyph is cut out of it,
so a border colour that reached the terminal as foreground only would show a thin
bar there instead of a wide one.
"""

from textual.app import App, ComposeResult
from textual.widgets import Placeholder

STYLES = ["panel", "tab", "tall", "wide"]


class BorderPanelsApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Placeholder {
        height: 5;
    }
    """ + "".join(f"#{style} {{ border: {style} #0178D4; }}\n" for style in STYLES)

    def compose(self) -> ComposeResult:
        for style in STYLES:
            yield Placeholder(label=style, id=style)


app = BorderPanelsApp

interactions = []
