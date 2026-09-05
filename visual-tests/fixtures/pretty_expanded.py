"""Fixture: Pretty widget expanding an object too wide for one line.

pretty_basic and pretty_nested both fit inside 80 columns, so neither can show
whether the width-driven expansion is right — or present at all. This one does
not fit: the root expands, 'widgets' stays inline at depth one, and 'counts'
expands again, which is the only case that produces a closing brace carrying a
comma. It also carries the values the other two omit — None, True, False, and a
string containing square brackets.
"""

from textual.app import App, ComposeResult
from textual.widgets import Pretty


class PrettyExpandedApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Pretty(
            {
                "widgets": ["Header", "Footer", "Placeholder", "LoadingIndicator"],
                "counts": {
                    "shipped": 6,
                    "remaining": 2,
                    "skipped": None,
                    "unverified": True,
                },
                "note": "[draft]",
                "complete": False,
            }
        )


app = PrettyExpandedApp

interactions = []
