"""Fixture: the line-drawn border styles, one Placeholder each, in a truecolor border.

#0178D4 has no exact 16-colour neighbour, so a border colour quantised on its way
to the terminal shows as a pixel difference on every edge cell.
"""

from textual.app import App, ComposeResult
from textual.widgets import Placeholder

STYLES = ["ascii", "blank", "dashed", "double", "heavy", "round", "solid", "none"]


class BorderLinesApp(App):
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


app = BorderLinesApp

interactions = []
