"""Fixture: every character Textual's 3x3 Digits font defines.

Between them the two widgets cover all 27 characters of
`textual.renderables.digits.DIGITS`, split so each row fits the 80-column
screen: 45 cells and 37. This is the ground truth for the glyph table in
src/widgets/digits.ts, so a mistranscribed glyph anywhere in the font
shows up here as a pixel diff.

The second row is 37 rather than 36 because `)` draws four cells wide
while `Digits.get_width` counts it as three — the upstream quirk this
fixture exists to pin down.
"""

from textual.app import App, ComposeResult
from textual.widgets import Digits


class DigitsCharsetApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Digits("0123456789+-^x:")
        yield Digits("ABCDEF $£€()")


app = DigitsCharsetApp

interactions = []
