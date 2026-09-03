"""Fixture: every character Textual's 3x3 Digits font defines.

Between them the two widgets cover all 27 characters of
`textual.renderables.digits.DIGITS`, split so each row fits 80 columns —
the first is 45 cells, the second 36. This is the ground truth for the
glyph table in src/widgets/digits.ts: a mistranscribed glyph anywhere in
the font shows up here as a pixel diff.
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
