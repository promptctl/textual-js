"""Fixture: TextArea with language='python' and a short snippet."""

from textual.app import App, ComposeResult
from textual.widgets import TextArea


SNIPPET = """def greet(name):
    return f\"Hello, {name}!\"

print(greet(\"world\"))
"""


class TextAreaSyntaxPythonApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield TextArea(SNIPPET, language="python")


app = TextAreaSyntaxPythonApp

interactions = []
