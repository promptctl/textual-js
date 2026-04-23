"""Fixture: Markdown with a fenced python code block (syntax highlighting)."""

from textual.app import App, ComposeResult
from textual.widgets import Markdown

MARKDOWN_CONTENT = """\
Example:

```python
def greet(name):
    return f"Hello, {name}"
```
"""


class MarkdownCodeBlockApp(App):
    CSS = """
    Screen {
        background: #121212;
        color: #e0e0e0;
    }
    """

    def compose(self) -> ComposeResult:
        yield Markdown(MARKDOWN_CONTENT)


app = MarkdownCodeBlockApp

interactions = []
