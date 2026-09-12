"""Fixture: the block-drawn border styles, one Placeholder each, in a truecolor border.

`block` and `inner` paint cells over the ground beneath the widget rather than
over the widget's background, so those rows show both grounds.
"""

from textual.app import App, ComposeResult
from textual.widgets import Placeholder

STYLES = ["block", "hkey", "inner", "outer", "thick", "vkey", "hidden"]


class BorderBlocksApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    Placeholder {
        height: 3;
    }
    """ + "".join(f"#{style} {{ border: {style} #0178D4; }}\n" for style in STYLES)

    def compose(self) -> ComposeResult:
        for style in STYLES:
            yield Placeholder(label=style, id=style)


app = BorderBlocksApp

interactions = []
